#include "js/worldgen_bindings.h"
#include "js/async_job.h"
#include "js/runtime.h"
#include <brodiffusion/terrain/world_pipeline.h>
#include <brotensor/runtime.h>
#include <api/api.h>
#include <atomic>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>
#include <qjsbind/qjsbind.h>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

namespace {

namespace td = brodiffusion::terrain;

bool argStr(JSContext* ctx, JSValueConst v, std::string& out) {
    if (!JS_IsString(v)) return false;
    const char* s = JS_ToCString(ctx, v);
    if (!s) return false;
    out = s;
    JS_FreeCString(ctx, s);
    return true;
}

struct WorldWrapper {
    std::string dir;
    std::unique_ptr<td::WorldPipeline> pipe;
    std::atomic<bool> busy{false};
};

constexpr std::int64_t kDefaultMargin = 8;

struct ElevJob {
    WorldWrapper* w = nullptr;
    std::int64_t  i1 = 0, j1 = 0, i2 = 0, j2 = 0;
    std::int64_t  margin = kDefaultMargin;
    td::TileBuffer out;
    JSValue onDone  = JS_UNDEFINED;
    JSValue onError = JS_UNDEFINED;
    bool    hasDone = false, hasError = false;
    JSValue worldRef = JS_UNDEFINED;
};

td::TileBuffer cropMargin(const td::TileBuffer& src, std::int64_t margin) {
    if (margin <= 0) return src;
    const std::int64_t h = src.shape[1], w = src.shape[2];
    const std::int64_t oh = h - 2 * margin, ow = w - 2 * margin;
    td::TileBuffer out;
    out.shape = {1, oh, ow};
    out.data.resize(static_cast<std::size_t>(oh) * ow);
    for (std::int64_t z = 0; z < oh; ++z) {
        const float* row = src.data.data() + (z + margin) * w + margin;
        std::memcpy(out.data.data() + static_cast<std::size_t>(z) * ow, row,
                    static_cast<std::size_t>(ow) * sizeof(float));
    }
    return out;
}

JSValue makeElevResult(JSContext* ctx, const td::TileBuffer& tile, double cellSize) {
    if (tile.shape.size() != 3 || tile.shape[0] != 1) {
        return JS_ThrowInternalError(ctx, "worldgen: elevation returned an unexpected shape");
    }
    const std::int64_t h = tile.shape[1];
    const std::int64_t w = tile.shape[2];
    JSValue lenVal = JS_NewInt64(ctx, static_cast<std::int64_t>(tile.data.size()));
    JSValue arr = JS_NewTypedArray(ctx, 1, &lenVal, JS_TYPED_ARRAY_FLOAT32);
    JS_FreeValue(ctx, lenVal);
    if (JS_IsException(arr)) return arr;
    size_t byteOff = 0, viewLen = 0;
    JSValue abuf = JS_GetTypedArrayBuffer(ctx, arr, &byteOff, &viewLen, nullptr);
    if (JS_IsException(abuf)) { JS_FreeValue(ctx, arr); return abuf; }
    size_t abufLen = 0;
    uint8_t* ptr = JS_GetArrayBuffer(ctx, &abufLen, abuf);
    if (ptr) std::memcpy(ptr + byteOff, tile.data.data(), tile.data.size() * sizeof(float));
    JS_FreeValue(ctx, abuf);
    JSValue res = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, res, "width",    JS_NewInt64(ctx, w));
    JS_SetPropertyStr(ctx, res, "height",   JS_NewInt64(ctx, h));
    JS_SetPropertyStr(ctx, res, "cellSize", JS_NewFloat64(ctx, cellSize));
    JS_SetPropertyStr(ctx, res, "data",     arr);
    return res;
}

bool readBounds(JSContext* ctx, int argc, JSValueConst* argv, std::int64_t& i1, std::int64_t& j1, std::int64_t& i2, std::int64_t& j2, std::int64_t& margin) {
    if (argc < 4) { JS_ThrowTypeError(ctx, "elevation(i1, j1, i2, j2, opts?): four bounds required"); return false; }
    if (JS_ToInt64(ctx, &i1, argv[0]) || JS_ToInt64(ctx, &j1, argv[1]) || JS_ToInt64(ctx, &i2, argv[2]) || JS_ToInt64(ctx, &j2, argv[3])) return false;
    if (i2 <= i1 || j2 <= j1) { JS_ThrowRangeError(ctx, "elevation: bounds are half-open, so i2 > i1 and j2 > j1 required"); return false; }
    margin = kDefaultMargin;
    JSValueConst opts = argc > 4 ? argv[4] : JS_UNDEFINED;
    if (JS_IsObject(opts)) {
        JSValue m = JS_GetPropertyStr(ctx, opts, "margin");
        if (!JS_IsUndefined(m)) { double mv = 0; JS_ToFloat64(ctx, &mv, m); margin = static_cast<std::int64_t>(mv); if (margin < 0) margin = 0; }
        JS_FreeValue(ctx, m);
    }
    return true;
}

JSValue js_world_coarse(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = qjsbind::unwrap<WorldWrapper>(ctx, this_val);
    if (!w || !w->pipe) return JS_ThrowTypeError(ctx, "coarse: world is destroyed");
    std::int64_t i1, j1, i2, j2, margin;
    if (!readBounds(ctx, argc, argv, i1, j1, i2, j2, margin)) return JS_EXCEPTION;
    bool expected = false;
    if (!w->busy.compare_exchange_strong(expected, true)) return JS_ThrowInternalError(ctx, "coarse: this world is already generating");
    td::TileBuffer tile;
    try { tile = w->pipe->coarse_normalized(i1, j1, i2, j2); } catch (const std::exception& e) {
        w->busy.store(false); return JS_ThrowInternalError(ctx, "coarse: %s", e.what());
    }
    w->busy.store(false);
    if (tile.shape.size() != 3 || tile.shape[0] < 1) return JS_ThrowInternalError(ctx, "coarse: unexpected shape");
    const std::int64_t h = tile.shape[1], w2 = tile.shape[2];
    td::TileBuffer out;
    out.shape = {1, h, w2};
    out.data.resize(static_cast<std::size_t>(h) * w2);
    for (std::size_t i = 0; i < out.data.size(); ++i) { const float v = tile.data[i]; out.data[i] = std::copysign(v * v, v); }
    const double cell = w->pipe->config().native_resolution * w->pipe->config().latent_compression * 32.0;
    return makeElevResult(ctx, out, cell);
}

struct StageSpec { const char* name; int channels; const char* chanNames[6]; const char* chanUnits[6]; };
constexpr StageSpec kStages[] = {
    {"coarse", 6, {"elevation", "p5", "temperature", "temperatureSeasonality", "precipitation", "precipitationSeasonality"}, {"m", "m", "degC", "?", "mm/yr", "?"}},
    {"latent", 5, {"latent0", "latent1", "latent2", "latent3", "lowFrequency"}, {"", "", "", "", "m"}},
    {"latentInit", 5, {"latent0", "latent1", "latent2", "latent3", "lowFrequency"}, {"", "", "", "", "m"}},
    {"residual", 1, {"residual"}, {"standardised"}},
    {"elevation", 1, {"elevation"}, {"m"}},
};

struct StageOut { const StageSpec* spec = nullptr; std::vector<float> data; std::int64_t channels = 0, width = 0, height = 0; double cellSize = 0.0; };

StageOut computeStage(td::WorldPipeline& pipe, const StageSpec& spec, std::int64_t i1, std::int64_t j1, std::int64_t i2, std::int64_t j2) {
    const std::string name = spec.name;
    td::TileBuffer tile;
    if      (name == "coarse")     tile = pipe.coarse_normalized(i1, j1, i2, j2);
    else if (name == "latent")     tile = pipe.latent_normalized(i1, j1, i2, j2);
    else if (name == "latentInit") tile = pipe.latent_init(i1, j1, i2, j2);
    else if (name == "residual")   tile = pipe.residual_normalized(i1, j1, i2, j2);
    else                           tile = pipe.elevation(i1, j1, i2, j2);
    if (tile.shape.size() != 3) throw std::runtime_error("unexpected shape");
    StageOut out;
    out.spec = &spec; out.height = tile.shape[1]; out.width = tile.shape[2];
    const std::int64_t ch = tile.shape[0];
    const std::size_t plane = static_cast<std::size_t>(out.height) * out.width;
    if (name == "latentInit" && ch == spec.channels + 1) {
        const float* wgt = tile.data.data() + static_cast<std::size_t>(spec.channels) * plane;
        out.data.resize(static_cast<std::size_t>(spec.channels) * plane);
        for (int c = 0; c < spec.channels; ++c)
            for (std::size_t p = 0; p < plane; ++p) {
                const float d = wgt[p];
                out.data[static_cast<std::size_t>(c) * plane + p] = (d != 0.0f) ? tile.data[static_cast<std::size_t>(c) * plane + p] / d : 0.0f;
            }
        out.channels = spec.channels;
    } else {
        out.data = std::move(tile.data); out.channels = ch;
    }
    auto square = [&](std::int64_t c) {
        if (c >= out.channels) return;
        float* p = out.data.data() + static_cast<std::size_t>(c) * plane;
        for (std::size_t i = 0; i < plane; ++i) p[i] = std::copysign(p[i] * p[i], p[i]);
    };
    if (name == "coarse") { square(0); square(1); }
    if (name == "latent" || name == "latentInit") {
        if (out.channels > 4) {
            float* p = out.data.data() + 4 * plane;
            for (std::size_t i = 0; i < plane; ++i) p[i] = p[i] * 38.6f - 31.4f;
        }
        square(4);
    }
    const auto& cfg = pipe.config();
    out.cellSize = cfg.native_resolution;
    if (name == "coarse") out.cellSize = cfg.native_resolution * cfg.latent_compression * 32.0;
    else if (name == "latent" || name == "latentInit") out.cellSize = cfg.native_resolution * cfg.latent_compression;
    return out;
}

JSValue makeStageResult(JSContext* ctx, const StageOut& s) {
    JSValue lenVal = JS_NewInt64(ctx, static_cast<std::int64_t>(s.data.size()));
    JSValue arr = JS_NewTypedArray(ctx, 1, &lenVal, JS_TYPED_ARRAY_FLOAT32);
    JS_FreeValue(ctx, lenVal);
    if (JS_IsException(arr)) return arr;
    size_t byteOff = 0, viewLen = 0;
    JSValue abuf = JS_GetTypedArrayBuffer(ctx, arr, &byteOff, &viewLen, nullptr);
    if (JS_IsException(abuf)) { JS_FreeValue(ctx, arr); return abuf; }
    size_t abufLen = 0;
    uint8_t* ptr = JS_GetArrayBuffer(ctx, &abufLen, abuf);
    if (ptr) std::memcpy(ptr + byteOff, s.data.data(), s.data.size() * sizeof(float));
    JS_FreeValue(ctx, abuf);
    JSValue names = JS_NewArray(ctx);
    JSValue units = JS_NewArray(ctx);
    for (std::int64_t c = 0; c < s.channels && c < s.spec->channels; ++c) {
        JS_SetPropertyUint32(ctx, names, static_cast<uint32_t>(c), JS_NewString(ctx, s.spec->chanNames[c]));
        JS_SetPropertyUint32(ctx, units, static_cast<uint32_t>(c), JS_NewString(ctx, s.spec->chanUnits[c]));
    }
    JSValue res = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, res, "stage",    JS_NewString(ctx, s.spec->name));
    JS_SetPropertyStr(ctx, res, "width",    JS_NewInt64(ctx, s.width));
    JS_SetPropertyStr(ctx, res, "height",   JS_NewInt64(ctx, s.height));
    JS_SetPropertyStr(ctx, res, "channels", JS_NewInt64(ctx, s.channels));
    JS_SetPropertyStr(ctx, res, "cellSize", JS_NewFloat64(ctx, s.cellSize));
    JS_SetPropertyStr(ctx, res, "names",    names);
    JS_SetPropertyStr(ctx, res, "units",    units);
    JS_SetPropertyStr(ctx, res, "data",     arr);
    return res;
}

const StageSpec* readStageArgs(JSContext* ctx, int argc, JSValueConst* argv, std::int64_t& i1, std::int64_t& j1, std::int64_t& i2, std::int64_t& j2) {
    std::string name;
    if (argc < 1 || !argStr(ctx, argv[0], name)) {
        JS_ThrowTypeError(ctx, "stage(name, i1, j1, i2, j2): name must be a string");
        return nullptr;
    }
    for (const auto& s : kStages)
        if (name == s.name) {
            std::int64_t margin = 0;
            if (!readBounds(ctx, argc - 1, argv + 1, i1, j1, i2, j2, margin)) return nullptr;
            return &s;
        }
    JS_ThrowRangeError(ctx, "stage: unknown stage '%s'", name.c_str());
    return nullptr;
}

struct StageJob {
    WorldWrapper*    w = nullptr;
    const StageSpec* spec = nullptr;
    std::int64_t     i1 = 0, j1 = 0, i2 = 0, j2 = 0;
    StageOut         out;
    JSValue onDone  = JS_UNDEFINED;
    JSValue onError = JS_UNDEFINED;
    bool    hasDone = false, hasError = false;
    JSValue worldRef = JS_UNDEFINED;
};

JSValue js_world_stage(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = qjsbind::unwrap<WorldWrapper>(ctx, this_val);
    if (!w || !w->pipe) return JS_ThrowTypeError(ctx, "stage: world is destroyed");
    std::int64_t i1, j1, i2, j2;
    const StageSpec* spec = readStageArgs(ctx, argc, argv, i1, j1, i2, j2);
    if (!spec) return JS_EXCEPTION;
    bool expected = false;
    if (!w->busy.compare_exchange_strong(expected, true)) return JS_ThrowInternalError(ctx, "stage: this world is already generating");
    auto job = std::make_shared<StageJob>();
    job->w = w; job->spec = spec; job->i1 = i1; job->j1 = j1; job->i2 = i2; job->j2 = j2;
    job->worldRef = JS_DupValue(ctx, this_val);
    JSValueConst opts = argc > 5 ? argv[5] : JS_UNDEFINED;
    if (JS_IsObject(opts)) {
        JSValue od = JS_GetPropertyStr(ctx, opts, "onDone");
        JSValue oe = JS_GetPropertyStr(ctx, opts, "onError");
        job->hasDone  = JS_IsFunction(ctx, od);
        job->hasError = JS_IsFunction(ctx, oe);
        job->onDone   = job->hasDone  ? JS_DupValue(ctx, od) : JS_UNDEFINED;
        job->onError  = job->hasError ? JS_DupValue(ctx, oe) : JS_UNDEFINED;
        JS_FreeValue(ctx, od);
        JS_FreeValue(ctx, oe);
    }
    auto work = [job](const std::atomic<bool>&) {
        job->out = computeStage(*job->w->pipe, *job->spec, job->i1, job->j1, job->i2, job->j2);
    };
    auto done = [job](JSContext* c, bool cancelled, const std::string& error) {
        job->w->busy.store(false);
        if (!cancelled && error.empty()) {
            if (job->hasDone) {
                JSValue res = makeStageResult(c, job->out);
                if (!Runtime::checkException(c, res)) {
                    JSValue r = JS_Call(c, job->onDone, JS_UNDEFINED, 1, &res);
                    if (!Runtime::checkException(c, r)) JS_FreeValue(c, r);
                    JS_FreeValue(c, res);
                }
            }
        } else if (!cancelled && job->hasError) {
            JSValue e = JS_NewString(c, error.empty() ? "stage failed" : error.c_str());
            JSValue r = JS_Call(c, job->onError, JS_UNDEFINED, 1, &e);
            if (!Runtime::checkException(c, r)) JS_FreeValue(c, r);
            JS_FreeValue(c, e);
        }
        if (job->hasDone) JS_FreeValue(c, job->onDone);
        if (job->hasError) JS_FreeValue(c, job->onError);
        JS_FreeValue(c, job->worldRef);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

JSValue js_world_stage_sync(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = qjsbind::unwrap<WorldWrapper>(ctx, this_val);
    if (!w || !w->pipe) return JS_ThrowTypeError(ctx, "stageSync: world is destroyed");
    std::int64_t i1, j1, i2, j2;
    const StageSpec* spec = readStageArgs(ctx, argc, argv, i1, j1, i2, j2);
    if (!spec) return JS_EXCEPTION;
    bool expected = false;
    if (!w->busy.compare_exchange_strong(expected, true)) return JS_ThrowInternalError(ctx, "stageSync: this world is already generating");
    StageOut out;
    try { out = computeStage(*w->pipe, *spec, i1, j1, i2, j2); } catch (const std::exception& e) {
        w->busy.store(false); return JS_ThrowInternalError(ctx, "stageSync: %s", e.what());
    }
    w->busy.store(false);
    return makeStageResult(ctx, out);
}

JSValue js_world_elevation(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = qjsbind::unwrap<WorldWrapper>(ctx, this_val);
    if (!w || !w->pipe) return JS_ThrowTypeError(ctx, "elevation: world is destroyed");
    std::int64_t i1, j1, i2, j2, margin;
    if (!readBounds(ctx, argc, argv, i1, j1, i2, j2, margin)) return JS_EXCEPTION;
    bool expected = false;
    if (!w->busy.compare_exchange_strong(expected, true)) return JS_ThrowInternalError(ctx, "elevation: this world is already generating");
    auto job = std::make_shared<ElevJob>();
    job->w = w; job->i1 = i1; job->j1 = j1; job->i2 = i2; job->j2 = j2; job->margin = margin;
    job->worldRef = JS_DupValue(ctx, this_val);
    JSValueConst opts = argc > 4 ? argv[4] : JS_UNDEFINED;
    if (JS_IsObject(opts)) {
        JSValue od = JS_GetPropertyStr(ctx, opts, "onDone");
        JSValue oe = JS_GetPropertyStr(ctx, opts, "onError");
        job->hasDone  = JS_IsFunction(ctx, od);
        job->hasError = JS_IsFunction(ctx, oe);
        job->onDone   = job->hasDone  ? JS_DupValue(ctx, od) : JS_UNDEFINED;
        job->onError  = job->hasError ? JS_DupValue(ctx, oe) : JS_UNDEFINED;
        JS_FreeValue(ctx, od);
        JS_FreeValue(ctx, oe);
    }
    auto work = [job](const std::atomic<bool>&) {
        auto& pipe = *job->w->pipe;
        if (job->margin > 0) {
            auto padded = pipe.elevation(job->i1 - job->margin, job->j1 - job->margin, job->i2 + job->margin, job->j2 + job->margin);
            job->out = cropMargin(padded, job->margin);
        } else {
            job->out = pipe.elevation(job->i1, job->j1, job->i2, job->j2);
        }
    };
    auto done = [job](JSContext* c, bool cancelled, const std::string& error) {
        job->w->busy.store(false);
        if (!cancelled && error.empty()) {
            if (job->hasDone) {
                JSValue res = makeElevResult(c, job->out, job->w->pipe->config().native_resolution);
                if (!Runtime::checkException(c, res)) {
                    JSValue r = JS_Call(c, job->onDone, JS_UNDEFINED, 1, &res);
                    if (!Runtime::checkException(c, r)) JS_FreeValue(c, r);
                    JS_FreeValue(c, res);
                }
            }
        } else if (!cancelled && job->hasError) {
            JSValue e = JS_NewString(c, error.empty() ? "elevation failed" : error.c_str());
            JSValue r = JS_Call(c, job->onError, JS_UNDEFINED, 1, &e);
            if (!Runtime::checkException(c, r)) JS_FreeValue(c, r);
            JS_FreeValue(c, e);
        }
        if (job->hasDone) JS_FreeValue(c, job->onDone);
        if (job->hasError) JS_FreeValue(c, job->onError);
        JS_FreeValue(c, job->worldRef);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

JSValue js_world_elevation_sync(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = qjsbind::unwrap<WorldWrapper>(ctx, this_val);
    if (!w || !w->pipe) return JS_ThrowTypeError(ctx, "elevationSync: world is destroyed");
    std::int64_t i1, j1, i2, j2, margin;
    if (!readBounds(ctx, argc, argv, i1, j1, i2, j2, margin)) return JS_EXCEPTION;
    bool expected = false;
    if (!w->busy.compare_exchange_strong(expected, true)) return JS_ThrowInternalError(ctx, "elevationSync: this world is already generating");
    td::TileBuffer out;
    try {
        if (margin > 0) {
            auto padded = w->pipe->elevation(i1 - margin, j1 - margin, i2 + margin, j2 + margin);
            out = cropMargin(padded, margin);
        } else {
            out = w->pipe->elevation(i1, j1, i2, j2);
        }
    } catch (const std::exception& e) {
        w->busy.store(false); return JS_ThrowInternalError(ctx, "elevationSync: %s", e.what());
    }
    w->busy.store(false);
    return makeElevResult(ctx, out, w->pipe->config().native_resolution);
}

static void registerWorldClass(JSContext* ctx) {
    qjsbind::Class<WorldWrapper>(ctx, "World", qjsbind::NoGlobal)
        .get("seed", [](WorldWrapper* w) -> double { return w->pipe ? (double)w->pipe->seed() : 0.0; })
        .get("directory", [](WorldWrapper* w, JSContext* c) -> JSValue { return w->pipe ? JS_NewString(c, w->pipe->directory().c_str()) : JS_UNDEFINED; })
        .get("cellSize", [](WorldWrapper* w) -> double { return w->pipe ? w->pipe->config().native_resolution : 0.0; })
        .get("latentCellSize", [](WorldWrapper* w) -> double { return w->pipe ? w->pipe->config().native_resolution * w->pipe->config().latent_compression : 0.0; })
        .get("coarseCellSize", [](WorldWrapper* w) -> double { return w->pipe ? w->pipe->config().native_resolution * w->pipe->config().latent_compression * 32.0 : 0.0; })
        .method_raw("elevation", js_world_elevation, 5)
        .method_raw("elevationSync", js_world_elevation_sync, 4)
        .method_raw("coarse", js_world_coarse, 4)
        .method_raw("stage", js_world_stage, 6)
        .method_raw("stageSync", js_world_stage_sync, 5)
        .method("clearCache", [](WorldWrapper* w) { if (w->pipe) w->pipe->clear_cache(); });
}

JSValue js_init(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    try { brotensor::init(); } catch (const std::exception& e) { return JS_ThrowInternalError(ctx, "bro.worldgen.init: %s", e.what()); }
    return JS_UNDEFINED;
}

struct LoadJob {
    std::string   dir;
    std::uint64_t seed = 0;
    std::unique_ptr<WorldWrapper> w;
    JSValue onReady = JS_UNDEFINED;
    JSValue onError = JS_UNDEFINED;
    bool    hasReady = false, hasError = false;
};

JSValue js_loadWorld(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    std::string dir;
    if (argc < 1 || !argStr(ctx, argv[0], dir)) {
        return JS_ThrowTypeError(ctx, "loadWorld(dir, opts): dir must be a converted checkpoint directory");
    }
    dir = brokit::api::resolveAssetPath(ctx, dir);
    auto ls = std::make_shared<LoadJob>();
    ls->dir = dir;
    JSValueConst opts = argc > 1 ? argv[1] : JS_UNDEFINED;
    if (JS_IsObject(opts)) {
        double sd = 0;
        JSValue s = JS_GetPropertyStr(ctx, opts, "seed");
        if (!JS_IsUndefined(s)) JS_ToFloat64(ctx, &sd, s);
        JS_FreeValue(ctx, s);
        ls->seed = static_cast<std::uint64_t>(sd);
        JSValue orv = JS_GetPropertyStr(ctx, opts, "onReady");
        JSValue oev = JS_GetPropertyStr(ctx, opts, "onError");
        ls->hasReady = JS_IsFunction(ctx, orv);
        ls->hasError = JS_IsFunction(ctx, oev);
        ls->onReady  = ls->hasReady ? JS_DupValue(ctx, orv) : JS_UNDEFINED;
        ls->onError  = ls->hasError ? JS_DupValue(ctx, oev) : JS_UNDEFINED;
        JS_FreeValue(ctx, orv);
        JS_FreeValue(ctx, oev);
    }
    auto work = [ls](const std::atomic<bool>&) {
        auto w = std::make_unique<WorldWrapper>();
        w->dir = ls->dir;
        w->pipe = std::make_unique<td::WorldPipeline>(ls->dir, ls->seed);
        ls->w = std::move(w);
    };
    auto done = [ls](JSContext* c, bool /*cancelled*/, const std::string& error) {
        if (!error.empty() || !ls->w) {
            if (ls->hasError) {
                JSValue e = JS_NewString(c, error.empty() ? "loadWorld failed" : error.c_str());
                JSValue r = JS_Call(c, ls->onError, JS_UNDEFINED, 1, &e);
                if (!Runtime::checkException(c, r)) JS_FreeValue(c, r);
                JS_FreeValue(c, e);
            }
        } else if (ls->hasReady) {
            JSValue out = qjsbind::wrap<WorldWrapper>(c, ls->w.release());
            JSValue r = JS_Call(c, ls->onReady, JS_UNDEFINED, 1, &out);
            if (!Runtime::checkException(c, r)) JS_FreeValue(c, r);
            JS_FreeValue(c, out);
        }
        if (ls->hasReady) JS_FreeValue(c, ls->onReady);
        if (ls->hasError) JS_FreeValue(c, ls->onError);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

} // namespace

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void installWorldgenBindings(JSContext* ctx) {
    registerWorldClass(ctx);
    
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
        if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
            JS_FreeValue(ctx, broObj);
            broObj = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
        }
    
        JSValue wg = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, wg, "available", JS_TRUE);
        JS_SetPropertyStr(ctx, wg, "init", JS_NewCFunction(ctx, js_init, "init", 0));
        JS_SetPropertyStr(ctx, wg, "loadWorld", JS_NewCFunction(ctx, js_loadWorld, "loadWorld", 2));
        JS_SetPropertyStr(ctx, broObj, "worldgen", wg);
    
        JS_FreeValue(ctx, broObj);
        JS_FreeValue(ctx, global);
}


} // namespace bro::js
