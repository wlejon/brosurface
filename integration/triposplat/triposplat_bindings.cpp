#include "js/triposplat_bindings.h"
#include "js/imagebitmap_bindings.h"
#include "util/interrupt.h"
#include <brovisionml/dinov3.h>
#include <brovisionml/birefnet.h>
#include <brodiffusion/triposplat/vae_encoder.h>
#include <brodiffusion/triposplat/flow_model.h>
#include <brodiffusion/triposplat/octree_decoder.h>
#include <brodiffusion/triposplat/sampler.h>
#include <brotensor/runtime.h>
#include <brotensor/safetensors.h>
#include <brotensor/tensor.h>
#include <broimage/encode.h>
#include <include/core/SkData.h>
#include <include/core/SkImage.h>
#include <include/core/SkImageInfo.h>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

namespace bt  = ::brotensor;
namespace st  = ::brotensor::safetensors;
namespace tsp = ::brodiffusion::triposplat;
namespace dv3 = ::brovisionml::dinov3;
namespace brn = ::brovisionml::birefnet;

namespace {

bool tsGetStr(JSContext* ctx, JSValueConst obj, const char* key, std::string& out) {
    if (!JS_IsObject(obj)) return false;
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    bool ok = false;
    if (JS_IsString(v)) {
        const char* s = JS_ToCString(ctx, v);
        if (s) { out = s; JS_FreeCString(ctx, s); ok = true; }
    }
    JS_FreeValue(ctx, v);
    return ok;
}

void tsGetInt(JSContext* ctx, JSValueConst obj, const char* key, int& dst) {
    if (!JS_IsObject(obj)) return;
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsNumber(v)) { int32_t t = dst; JS_ToInt32(ctx, &t, v); dst = t; }
    JS_FreeValue(ctx, v);
}

void tsGetFloat(JSContext* ctx, JSValueConst obj, const char* key, float& dst) {
    if (!JS_IsObject(obj)) return;
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    if (JS_IsNumber(v)) { double t = dst; JS_ToFloat64(ctx, &t, v); dst = (float)t; }
    JS_FreeValue(ctx, v);
}

std::atomic<bool> g_cancelRequested{false};

struct TripoSplatWrapper {
    bt::Device device = bt::Device::CPU;
    std::unique_ptr<dv3::Backbone> dino;
    std::unique_ptr<tsp::Flux2VaeEncoder> vae;
    std::unique_ptr<tsp::FlowDiT> flow;
    std::unique_ptr<tsp::OctreeGaussianDecoder> decoder;
    std::unique_ptr<brn::BiRefNet> rmbg;
};

bt::Device tsAutoDevice() {
    if (bt::is_available(bt::Device::CUDA))  return bt::Device::CUDA;
    if (bt::is_available(bt::Device::Metal)) return bt::Device::Metal;
    return bt::Device::CPU;
}

JSValue tsFloat32Array(JSContext* ctx, const float* data, size_t count) {
    size_t bytes = count * sizeof(float);
    JSValue abuf = JS_NewArrayBufferCopy(ctx, reinterpret_cast<const uint8_t*>(data), bytes);
    if (JS_IsException(abuf)) return abuf;
    JSValue lenVal = JS_NewInt64(ctx, static_cast<int64_t>(count));
    JSValue arr = JS_NewTypedArrayWithBuffer(ctx, abuf, 0, 1, &lenVal, JS_TYPED_ARRAY_FLOAT32);
    JS_FreeValue(ctx, lenVal);
    JS_FreeValue(ctx, abuf);
    return arr;
}

JSValue tsGenerate(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = qjsbind::unwrap<TripoSplatWrapper>(ctx, this_val);
    if (!w || !w->dino || !w->vae || !w->flow || !w->decoder)
        return JS_ThrowTypeError(ctx, "TripoSplat pipeline is not loaded");
    if (argc < 1) return JS_ThrowTypeError(ctx, "generate(image, opts?): image required");
    int width = 0, height = 0;
    const uint8_t* rgba = nullptr;
    std::vector<uint8_t> rgbaStorage;
    if (auto* ib = qjsbind::unwrap<ImageBitmap>(ctx, argv[0])) {
        if (ib->isClosed()) return JS_ThrowTypeError(ctx, "ImageBitmap is closed");
        if (!ib->image()) return JS_ThrowTypeError(ctx, "ImageBitmap has no backing image");
        auto sk = ib->image();
        width = sk->width(); height = sk->height();
        rgbaStorage.resize(static_cast<size_t>(width) * height * 4);
        SkImageInfo info = SkImageInfo::Make(width, height, kRGBA_8888_SkColorType, kUnpremul_SkAlphaType);
        if (!sk->readPixels(info, rgbaStorage.data(), width * 4, 0, 0))
            return JS_ThrowInternalError(ctx, "failed to read ImageBitmap pixels");
        rgba = rgbaStorage.data();
    } else if (JS_IsObject(argv[0])) {
        tsGetInt(ctx, argv[0], "width", width);
        tsGetInt(ctx, argv[0], "height", height);
        JSValue dataV = JS_GetPropertyStr(ctx, argv[0], "data");
        size_t byteOff = 0, byteLen = 0;
        JSValue abuf = JS_GetTypedArrayBuffer(ctx, dataV, &byteOff, &byteLen, nullptr);
        if (!JS_IsException(abuf)) {
            size_t abufLen = 0;
            uint8_t* ptr = JS_GetArrayBuffer(ctx, &abufLen, abuf);
            if (ptr && byteOff + byteLen <= abufLen) rgba = ptr + byteOff;
            JS_FreeValue(ctx, abuf);
        }
        JS_FreeValue(ctx, dataV);
    }
    if (!rgba || width <= 0 || height <= 0)
        return JS_ThrowTypeError(ctx, "expected an ImageBitmap or { width, height, data: Uint8Array|Uint8ClampedArray }");
    tsp::SamplerConfig cfg;
    if (argc > 1 && JS_IsObject(argv[1])) {
        JSValueConst opts = argv[1];
        int seed = 42, steps = 25, numG = 0;
        float cfgScale = 3.0f, shift = 1.0f;
        tsGetInt(ctx, opts, "seed", seed);
        tsGetInt(ctx, opts, "steps", steps);
        tsGetInt(ctx, opts, "numGaussians", numG);
        tsGetFloat(ctx, opts, "guidanceScale", cfgScale);
        tsGetFloat(ctx, opts, "shift", shift);
        cfg.seed = static_cast<uint64_t>(seed);
        cfg.steps = steps;
        cfg.guidance_scale = cfgScale;
        cfg.shift = shift;
        if (numG > 0) cfg.num_gaussians = numG;
    }
    try {
        bt::DeviceScope scope(w->device);
        g_cancelRequested.store(false, std::memory_order_relaxed);
        tsp::GaussianSplats splats = tsp::sample_image(rgba, width, height, *w->dino, *w->vae, *w->flow, *w->decoder, w->rmbg.get(), cfg, []() { return g_cancelRequested.load(std::memory_order_relaxed); });
        JSValue out = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, out, "positions", tsFloat32Array(ctx, splats.positions.data(), splats.positions.size()));
        JS_SetPropertyStr(ctx, out, "scales",    tsFloat32Array(ctx, splats.scales.data(), splats.scales.size()));
        JS_SetPropertyStr(ctx, out, "rotations", tsFloat32Array(ctx, splats.rotations.data(), splats.rotations.size()));
        JS_SetPropertyStr(ctx, out, "opacities", tsFloat32Array(ctx, splats.opacities.data(), splats.opacities.size()));
        JS_SetPropertyStr(ctx, out, "sh",        tsFloat32Array(ctx, splats.sh.data(), splats.sh.size()));
        JS_SetPropertyStr(ctx, out, "shDegree",  JS_NewInt32(ctx, splats.shDegree));
        JS_SetPropertyStr(ctx, out, "count",     JS_NewInt64(ctx, static_cast<int64_t>(splats.count())));
        return out;
    } catch (const tsp::SampleCancelled&) {
        JSValue out = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, out, "cancelled", JS_TRUE);
        return out;
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "triposplat.generate failed: %s", e.what());
    }
}

JSValue tsCancel(JSContext*, JSValueConst, int, JSValueConst*) {
    g_cancelRequested.store(true, std::memory_order_relaxed);
    return JS_UNDEFINED;
}

static void tsRegisterClass(JSContext* ctx) {
    qjsbind::Class<TripoSplatWrapper>(ctx, "TripoSplatPipeline", qjsbind::NoGlobal)
        .get("device", [](TripoSplatWrapper* w) {
            switch (w->device.type) {
                case bt::DeviceType::CUDA:  return std::string("CUDA");
                case bt::DeviceType::Metal: return std::string("Metal");
                default:                    return std::string("CPU");
            }
        })
        .get("backgroundRemoval", [](TripoSplatWrapper* w) { return w->rmbg != nullptr; })
        .method_raw("generate", tsGenerate, 2);
}

JSValue tsInit(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    try { bt::init(); } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "triposplat.init failed: %s", e.what());
    }
    return JS_UNDEFINED;
}

JSValue tsLoad(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1 || !JS_IsObject(argv[0]))
        return JS_ThrowTypeError(ctx, "load({ dinov3, vae, flow, decoder }) requires an options object");
    std::string p_dino, p_vae, p_flow, p_dec, dev;
    if (!tsGetStr(ctx, argv[0], "dinov3", p_dino) || !tsGetStr(ctx, argv[0], "vae", p_vae) ||
        !tsGetStr(ctx, argv[0], "flow", p_flow)   || !tsGetStr(ctx, argv[0], "decoder", p_dec))
        return JS_ThrowTypeError(ctx, "load: dinov3, vae, flow and decoder paths are all required");
    try {
        bt::init();
        bt::Device device = tsAutoDevice();
        if (tsGetStr(ctx, argv[0], "device", dev)) {
            if (dev == "cpu") device = bt::Device::CPU;
            else if (dev == "cuda") device = bt::Device::CUDA;
            else if (dev == "metal") device = bt::Device::Metal;
        }
        bt::set_default_device(device);
        auto w = std::make_unique<TripoSplatWrapper>();
        w->device = device;
        w->dino = std::make_unique<dv3::Backbone>(dv3::Config::vit_h());
        w->dino->load_file(p_dino);
        w->dino->to(device);
        w->vae = std::make_unique<tsp::Flux2VaeEncoder>();
        { st::File f = st::File::open(p_vae); w->vae->load_weights(f); }
        w->flow = std::make_unique<tsp::FlowDiT>();
        { st::File f = st::File::open(p_flow); w->flow->load_weights(f); }
        w->decoder = std::make_unique<tsp::OctreeGaussianDecoder>();
        { st::File f = st::File::open(p_dec); w->decoder->load_weights(f); }
        std::string p_rmbg;
        if (tsGetStr(ctx, argv[0], "birefnet", p_rmbg) && !p_rmbg.empty()) {
            w->rmbg = std::make_unique<brn::BiRefNet>();
            w->rmbg->load(p_rmbg);
            w->rmbg->to(device);
        }
        return qjsbind::wrap<TripoSplatWrapper>(ctx, w.release());
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "triposplat.load failed: %s", e.what());
    }
}

} // namespace

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void installTriposplatBindings(JSContext* ctx) {
    tsRegisterClass(ctx);
    
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
        if (JS_IsUndefined(broObj)) {
            broObj = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
        }
    
        JSValue ns = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, ns, "init", JS_NewCFunction(ctx, tsInit, "init", 0));
        JS_SetPropertyStr(ctx, ns, "load", JS_NewCFunction(ctx, tsLoad, "load", 1));
        JS_SetPropertyStr(ctx, ns, "cancel", JS_NewCFunction(ctx, tsCancel, "cancel", 0));
        JS_SetPropertyStr(ctx, broObj, "triposplat", ns);
    
        JS_FreeValue(ctx, broObj);
        JS_FreeValue(ctx, global);
}


} // namespace bro::js
