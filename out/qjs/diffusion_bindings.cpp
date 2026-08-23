#include "js/diffusion_bindings.h"
#include "util/interrupt.h"
#include "util/asset_mounts.h"
#include <brodiffusion/pipeline.h>
#include <brodiffusion/controlnet.h>
#include <brotensor/safetensors.h>
#include <brodiffusion/scheduler.h>
#include <brodiffusion/lcm_scheduler.h>
#include <brodiffusion/flow_match_scheduler.h>
#include <brodiffusion/scm_scheduler.h>
#include <brodiffusion/model_config.h>
#include <brolm/tokenizer.h>
#include <brodiffusion/unet.h>
#include <brodiffusion/version.h>
#include <brotensor/ops/elementwise.h>
#include <brotensor/runtime.h>
#include <brotensor/tensor.h>
#include <cstdint>
#include <exception>
#include <memory>
#include <string>
#include <variant>
#include <vector>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

namespace bdp   = brodiffusion::pipeline;
namespace bds   = brotensor::safetensors;
namespace bdc   = brolm::clip;
namespace bdsch = brodiffusion::scheduler;

struct PipelineWrapper {
    std::unique_ptr<bdp::Pipeline> pipeline;
    bool weights_loaded = false;
};

static int xattnBlocks(const PipelineWrapper* w) {
    return w->pipeline->num_xattn_blocks();
}

struct PipelineStateWrapper {
    bdp::PipelineState  state;
    bdp::GenerateOptions opts;
};

static bool getStr(JSContext* ctx, JSValueConst obj, const char* key, std::string& out) {
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    bool ok = false;
    if (JS_IsString(v)) {
        const char* s = JS_ToCString(ctx, v);
        if (s) { out = s; JS_FreeCString(ctx, s); ok = true; }
    }
    JS_FreeValue(ctx, v);
    return ok;
}

static bool argStr(JSContext* ctx, JSValueConst v, std::string& out) {
    if (!JS_IsString(v)) return false;
    const char* s = JS_ToCString(ctx, v);
    if (!s) return false;
    out = s;
    JS_FreeCString(ctx, s);
    return true;
}

static thread_local std::string s_basePath;
static thread_local const util::AssetMounts* s_mounts = nullptr;

static std::string resolveAppPath(const std::string& src) {
    if (src.size() >= 2 && src[1] == ':') return src;
    if (!src.empty() && (src[0] == '/' || src[0] == '\\')) {
        if (s_mounts) {
            std::string m = s_mounts->resolve(src);
            if (!m.empty()) return m;
        }
        return src;
    }
    if (s_basePath.empty()) return src;
    std::string path = s_basePath;
    if (path.back() != '/' && path.back() != '\\') path += '/';
    return path + src;
}

static void getInt(JSContext* ctx, JSValueConst obj, const char* key, int& dst) {
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsNumber(v)) { int32_t t = dst; JS_ToInt32(ctx, &t, v); dst = t; }
    JS_FreeValue(ctx, v);
}

static void getNum(JSContext* ctx, JSValueConst obj, const char* key, float& dst) {
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsNumber(v)) { double t = dst; JS_ToFloat64(ctx, &t, v); dst = (float)t; }
    JS_FreeValue(ctx, v);
}

static bool getBool(JSContext* ctx, JSValueConst obj, const char* key, bool def = false) {
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    bool out = def;
    if (!JS_IsUndefined(v) && !JS_IsNull(v)) out = JS_ToBool(ctx, v) == 1;
    JS_FreeValue(ctx, v);
    return out;
}

static void getSeed(JSContext* ctx, JSValueConst obj, const char* key, std::uint64_t& dst) {
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsBigInt(v)) {
        uint64_t u = dst;
        if (JS_ToBigUint64(ctx, &u, v) == 0) dst = u;
    } else if (JS_IsNumber(v)) {
        int64_t t = (int64_t)dst;
        if (JS_ToInt64(ctx, &t, v) == 0) dst = (std::uint64_t)t;
    }
    JS_FreeValue(ctx, v);
}

static std::vector<float> downloadTensorFloats(const brotensor::Tensor& t) {
    if (t.dtype == brotensor::Dtype::FP16) {
        std::vector<std::uint16_t> bits = t.to_host_vector_fp16();
        std::vector<float> out(bits.size());
        for (std::size_t i = 0; i < bits.size(); ++i) {
            std::uint16_t b = bits[i];
            std::uint32_t sign = (b & 0x8000) << 16;
            std::int32_t  exp  = (b >> 10) & 0x1f;
            std::uint32_t mant = b & 0x3ff;
            std::uint32_t fbits;
            if (exp == 0) fbits = (mant == 0) ? sign : (sign | ((127 - 14) << 23));
            else if (exp == 31) fbits = sign | 0x7f800000 | (mant << 13);
            else fbits = sign | ((exp - 15 + 127) << 23) | (mant << 13);
            float val;
            std::memcpy(&val, &fbits, sizeof(val));
            out[i] = val;
        }
        return out;
    }
    return t.to_host_vector();
}

static JSValue makeImageResult(JSContext* ctx, const bdp::Image& img) {
    JSValue lenVal = JS_NewInt64(ctx, static_cast<std::int64_t>(img.data.size()));
    JSValue arr = JS_NewTypedArray(ctx, 1, &lenVal, JS_TYPED_ARRAY_UINT8_CLAMPED);
    JS_FreeValue(ctx, lenVal);
    if (JS_IsException(arr)) return arr;
    size_t byteOff = 0, viewLen = 0;
    JSValue abuf = JS_GetTypedArrayBuffer(ctx, arr, &byteOff, &viewLen, nullptr);
    if (JS_IsException(abuf)) { JS_FreeValue(ctx, arr); return abuf; }
    size_t abufLen = 0;
    uint8_t* ptr = JS_GetArrayBuffer(ctx, &abufLen, abuf);
    if (ptr) std::memcpy(ptr + byteOff, img.data.data(), img.data.size());
    JS_FreeValue(ctx, abuf);
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "width",  JS_NewInt32(ctx, img.width));
    JS_SetPropertyStr(ctx, obj, "height", JS_NewInt32(ctx, img.height));
    JS_SetPropertyStr(ctx, obj, "data",   arr);
    return obj;
}

static PipelineWrapper* getSelf(JSContext* ctx, JSValueConst this_val) {
    return qjsbind::unwrap<PipelineWrapper>(ctx, this_val);
}

static JSValue js_pipeline_loadWeights(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = getSelf(ctx, this_val);
    if (!w || !w->pipeline) return JS_ThrowTypeError(ctx, "Pipeline is closed");
    std::string path;
    if (argc < 1 || !argStr(ctx, argv[0], path)) return JS_ThrowTypeError(ctx, "path must be a string");
    path = resolveAppPath(path);
    try {
        bds::File sf = bds::File::open(path);
        w->pipeline->load_weights(sf);
        w->weights_loaded = true;
        return JS_UNDEFINED;
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "loadWeights failed: %s", e.what());
    }
}

static JSValue js_pipeline_generate(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = getSelf(ctx, this_val);
    if (!w || !w->pipeline) return JS_ThrowTypeError(ctx, "Pipeline is closed");
    if (!w->weights_loaded) return JS_ThrowInternalError(ctx, "loadWeights() must be called before generate()");
    bdp::GenerateOptions opts;
    if (argc > 0 && JS_IsObject(argv[0])) {
        JSValueConst o = argv[0];
        getStr(ctx, o, "prompt", opts.prompt);
        getStr(ctx, o, "negativePrompt", opts.negative_prompt);
        getInt(ctx, o, "width", opts.width);
        getInt(ctx, o, "height", opts.height);
        getInt(ctx, o, "steps", opts.steps);
        getNum(ctx, o, "guidanceScale", opts.guidance_scale);
        getSeed(ctx, o, "seed", opts.seed);
    }
    try {
        bdp::Image img = w->pipeline->generate(opts);
        return makeImageResult(ctx, img);
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "generate failed: %s", e.what());
    }
}

static void registerPipelineClass(JSContext* ctx) {
    qjsbind::Class<PipelineWrapper> c(ctx, "Pipeline", qjsbind::NoGlobal);
    c.method_raw("loadWeights", js_pipeline_loadWeights, 1);
    c.method_raw("generate",    js_pipeline_generate,    1);
    c.get("weightsLoaded", [](PipelineWrapper* w) -> bool { return w->weights_loaded; });
}

static void registerPipelineStateClass(JSContext* ctx) {
    qjsbind::Class<PipelineStateWrapper> c(ctx, "PipelineState", qjsbind::NoGlobal);
    c.get("step", [](PipelineStateWrapper* w) -> int { return w->state.step; });
    c.get("done", [](PipelineStateWrapper* w) -> bool { return w->state.done; });
}

static JSValue js_init(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    try { brotensor::init(); } catch (const std::exception& e) { return JS_ThrowInternalError(ctx, "init failed: %s", e.what()); }
    return JS_UNDEFINED;
}

static JSValue js_createPipeline(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1 || !JS_IsObject(argv[0])) return JS_ThrowTypeError(ctx, "createPipeline: config object required");
    try {
        auto w = std::make_unique<PipelineWrapper>();
        brodiffusion::ModelConfig cfg = brodiffusion::ModelConfig::sd15();
        w->pipeline = std::make_unique<bdp::Pipeline>(cfg);
        return qjsbind::wrap<PipelineWrapper>(ctx, w.release());
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "createPipeline failed: %s", e.what());
    }
}

static JSValue js_loadModel(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    std::string dir;
    if (argc < 1 || !argStr(ctx, argv[0], dir)) return JS_ThrowTypeError(ctx, "loadModel: dir string required");
    dir = resolveAppPath(dir);
    try {
        auto w = std::make_unique<PipelineWrapper>();
        brodiffusion::ModelConfig cfg = brodiffusion::ModelConfig::sd15();
        w->pipeline = std::make_unique<bdp::Pipeline>(cfg);
        std::string weightsPath = dir + "/model.safetensors";
        if (bds::File::exists(weightsPath)) {
            bds::File sf = bds::File::open(weightsPath);
            w->pipeline->load_weights(sf);
            w->weights_loaded = true;
        }
        return qjsbind::wrap<PipelineWrapper>(ctx, w.release());
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "loadModel failed: %s", e.what());
    }
}

static JSValue js_expandNoise(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 2 || !JS_IsObject(argv[1])) return JS_ThrowTypeError(ctx, "expandNoise(src, opts)");
    std::size_t cnt = 0;
    const float* src = qjsbind::read_float32_view(ctx, argv[0], cnt);
    if (!src || cnt == 0) return JS_ThrowTypeError(ctx, "expandNoise: src must be a Float32Array");
    auto readNum = [&](const char* key) -> double {
        JSValue v = JS_GetPropertyStr(ctx, argv[1], key);
        double d = 0;
        if (JS_IsNumber(v)) JS_ToFloat64(ctx, &d, v);
        JS_FreeValue(ctx, v);
        return d;
    };
    const double c = readNum("channels"), h = readNum("height"), w = readNum("width"), k = readNum("factor"), seed = readNum("seed");
    if (c < 1 || h < 1 || w < 1 || k < 1) return JS_ThrowTypeError(ctx, "expandNoise: invalid dimensions");
    try {
        return qjsbind::make_float32_array(ctx, bdp::expand_init_noise(src, static_cast<int>(c), static_cast<int>(h), static_cast<int>(w), static_cast<int>(k), static_cast<std::uint64_t>(seed)));
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "expandNoise: %s", e.what());
    }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void installDiffusionBindings(JSContext* ctx) {
    registerPipelineClass(ctx);
        registerPipelineStateClass(ctx);
    
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
        if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
            JS_FreeValue(ctx, broObj);
            broObj = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
        }
    
        JSValue diff = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, diff, "version", JS_NewString(ctx, brodiffusion::version_string()));
        JS_SetPropertyStr(ctx, diff, "init", JS_NewCFunction(ctx, js_init, "init", 0));
        JS_SetPropertyStr(ctx, diff, "createPipeline", JS_NewCFunction(ctx, js_createPipeline, "createPipeline", 1));
        JS_SetPropertyStr(ctx, diff, "loadModel", JS_NewCFunction(ctx, js_loadModel, "loadModel", 2));
        JS_SetPropertyStr(ctx, diff, "expandNoise", JS_NewCFunction(ctx, js_expandNoise, "expandNoise", 2));
        JS_SetPropertyStr(ctx, broObj, "diffusion", diff);
    
        JS_FreeValue(ctx, broObj);
        JS_FreeValue(ctx, global);
}


} // namespace bro::js
