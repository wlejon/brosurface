#if BRO_WITH_SOUNDML

#include "js/diar_bindings.h"
#include "util/interrupt.h"
#include "js/async_job.h"
#include "js/model_gate.h"
#include "js/marshal.h"
#include <api/api.h>
#include <brosoundml/sortformer.h>
#include <brosoundml/cluster_diarizer.h>
#include <brosoundml/audio.h>
#include <brotensor/runtime.h>
#include <brotensor/tensor.h>
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <exception>
#include <memory>
#include <string>
#include <vector>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

struct SortformerWrapper {
    std::shared_ptr<brosoundml::Sortformer> model;
    brotensor::Device device = brotensor::Device::CPU;
    ModelGate busy;
};

struct SortformerSessionWrapper {
    std::shared_ptr<brosoundml::Sortformer> model;
    ModelGate busy;
    brotensor::Device device = brotensor::Device::CPU;
    brosoundml::SortformerSession session;
};

struct ClusterDiarizerWrapper {
    std::shared_ptr<brosoundml::ClusterDiarizer> model;
    brotensor::Device device = brotensor::Device::CPU;
    ModelGate busy;
};

static JSValue js_sortformer_createSession(JSContext*, JSValueConst, int, JSValueConst*);

static bool argStr(JSContext* ctx, JSValueConst v, std::string& out) {
    if (!JS_IsString(v)) return false;
    const char* s = JS_ToCString(ctx, v);
    if (!s) return false;
    out = s;
    JS_FreeCString(ctx, s);
    return true;
}

static brotensor::Device autoDevice() {
    if (brotensor::is_available(brotensor::Device::CUDA))  return brotensor::Device::CUDA;
    if (brotensor::is_available(brotensor::Device::Metal)) return brotensor::Device::Metal;
    return brotensor::Device::CPU;
}

static const char* deviceName(brotensor::Device d) {
    switch (d.type) {
        case brotensor::DeviceType::CUDA:  return "CUDA";
        case brotensor::DeviceType::Metal: return "Metal";
        case brotensor::DeviceType::CPU:   return "CPU";
    }
    return "?";
}

static bool parseDeviceOpt(JSContext* ctx, JSValueConst opts, brotensor::Device& out, std::string& err) {
    if (!JS_IsObject(opts)) return true;
    JSValue v = JS_GetPropertyStr(ctx, opts, "device");
    if (JS_IsUndefined(v) || JS_IsNull(v)) { JS_FreeValue(ctx, v); return true; }
    if (!JS_IsString(v)) {
        JS_FreeValue(ctx, v); err = "opts.device must be a string ('cpu', 'cuda', or 'metal')"; return false;
    }
    const char* s = JS_ToCString(ctx, v);
    std::string sv = s ? s : "";
    if (s) JS_FreeCString(ctx, s);
    JS_FreeValue(ctx, v);
    if (sv == "cpu")   { out = brotensor::Device::CPU;   return true; }
    if (sv == "cuda")  { out = brotensor::Device::CUDA;  return true; }
    if (sv == "metal") { out = brotensor::Device::Metal; return true; }
    err = "opts.device must be 'cpu', 'cuda', or 'metal' (got '" + sv + "')";
    return false;
}

static JSValue makeDiarization(JSContext* c, const brosoundml::Sortformer::Diarization& d) {
    JSValue obj = JS_NewObject(c);
    JS_SetPropertyStr(c, obj, "numFrames",    JS_NewInt32(c, d.num_frames));
    JS_SetPropertyStr(c, obj, "numSpeakers",  JS_NewInt32(c, d.num_speakers));
    JS_SetPropertyStr(c, obj, "frameSeconds", JS_NewFloat64(c, d.frame_seconds));
    JS_SetPropertyStr(c, obj, "probs",        qjsbind::make_float32_array(c, d.probs));
    return obj;
}

static JSValue makeDiarization(JSContext* c, const brosoundml::ClusterDiarizer::Diarization& d) {
    JSValue obj = JS_NewObject(c);
    JS_SetPropertyStr(c, obj, "numFrames",    JS_NewInt32(c, d.num_frames));
    JS_SetPropertyStr(c, obj, "numSpeakers",  JS_NewInt32(c, d.num_speakers));
    JS_SetPropertyStr(c, obj, "frameSeconds", JS_NewFloat64(c, d.frame_seconds));
    JS_SetPropertyStr(c, obj, "probs",        qjsbind::make_float32_array(c, d.probs));
    return obj;
}

static void parseClusterConfig(JSContext* ctx, JSValueConst opts, brosoundml::ClusterDiarizer::Config& cfg) {
    if (!JS_IsObject(opts)) return;
    auto numf = [&](const char* k, float& dst) {
        JSValue v = JS_GetPropertyStr(ctx, opts, k);
        if (JS_IsNumber(v)) { double t = dst; JS_ToFloat64(ctx, &t, v); dst = (float)t; }
        JS_FreeValue(ctx, v);
    };
    auto numi = [&](const char* k, int& dst) {
        JSValue v = JS_GetPropertyStr(ctx, opts, k);
        if (JS_IsNumber(v)) { int32_t t = dst; JS_ToInt32(ctx, &t, v); dst = t; }
        JS_FreeValue(ctx, v);
    };
    numf("clusterThreshold",  cfg.cluster_threshold);
    numf("vadThreshold",      cfg.vad_threshold);
    numf("windowSeconds",     cfg.window_seconds);
    numf("hopSeconds",        cfg.hop_seconds);
    numf("minWindowSeconds",  cfg.min_window_seconds);
    numf("minSpeakerSeconds", cfg.min_speaker_seconds);
    numi("maxSpeakers",       cfg.max_speakers);
}

static SortformerWrapper* sortformerSelf(JSContext* ctx, JSValueConst this_val) {
    return qjsbind::unwrap<SortformerWrapper>(ctx, this_val);
}

static JSValue js_sortformer_diarize(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = sortformerSelf(ctx, this_val);
    if (!w || !w->model) return JS_ThrowTypeError(ctx, "Sortformer is closed");
    std::vector<float> audio;
    if (argc < 1 || !readFloat32Array(ctx, argv[0], audio)) return JS_ThrowTypeError(ctx, "audio must be a Float32Array");
    if (w->busy.isBusy()) return JS_ThrowInternalError(ctx, "Sortformer is busy running an async operation");
    try {
        brotensor::DeviceScope scope(w->device);
        auto d = w->model->diarize(audio);
        return makeDiarization(ctx, d);
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "Sortformer.diarize failed: %s", e.what());
    }
}

static void registerSortformerClass(JSContext* ctx) {
    qjsbind::Class<SortformerWrapper> c(ctx, "Sortformer", qjsbind::NoGlobal);
    c.method_raw("diarize", js_sortformer_diarize, 1);
    c.method_raw("createSession", js_sortformer_createSession, 0);
    c.get("device", [](SortformerWrapper* w) -> const char* { return deviceName(w->device); });
    c.get("busy",   [](SortformerWrapper* w) -> bool { return w->busy.isBusy(); });
}

static SortformerSessionWrapper* sessionSelf(JSContext* ctx, JSValueConst this_val) {
    return qjsbind::unwrap<SortformerSessionWrapper>(ctx, this_val);
}

static JSValue js_session_feed(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = sessionSelf(ctx, this_val);
    if (!w || !w->model) return JS_ThrowTypeError(ctx, "SortformerSession is closed");
    std::vector<float> audio;
    if (argc < 1 || !readFloat32Array(ctx, argv[0], audio)) return JS_ThrowTypeError(ctx, "audio must be a Float32Array");
    bool isLast = true;
    if (argc >= 2 && !JS_IsUndefined(argv[1])) isLast = JS_ToBool(ctx, argv[1]) > 0;
    if (w->busy.isBusy()) return JS_ThrowInternalError(ctx, "Sortformer is busy running an async operation");
    try {
        brotensor::DeviceScope scope(w->device);
        auto d = w->session.feed(audio, isLast);
        return makeDiarization(ctx, d);
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "SortformerSession.feed failed: %s", e.what());
    }
}

static JSValue js_session_reset(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* w = sessionSelf(ctx, this_val);
    if (!w || !w->model) return JS_ThrowTypeError(ctx, "SortformerSession is closed");
    if (w->busy.isBusy()) return JS_ThrowInternalError(ctx, "Sortformer is busy running an async operation");
    try {
        brotensor::DeviceScope scope(w->device);
        w->session.reset();
        return JS_UNDEFINED;
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "SortformerSession.reset failed: %s", e.what());
    }
}

static void registerSortformerSessionClass(JSContext* ctx) {
    qjsbind::Class<SortformerSessionWrapper> c(ctx, "SortformerSession", qjsbind::NoGlobal);
    c.method_raw("feed",  js_session_feed, 2);
    c.method_raw("reset", js_session_reset, 0);
    c.get("device", [](SortformerSessionWrapper* w) -> const char* { return deviceName(w->device); });
    c.get("busy",   [](SortformerSessionWrapper* w) -> bool { return w->busy.isBusy(); });
}

static JSValue js_sortformer_createSession(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* mw = sortformerSelf(ctx, this_val);
    if (!mw || !mw->model) return JS_ThrowTypeError(ctx, "Sortformer is closed");
    auto* sw = new SortformerSessionWrapper();
    sw->model  = mw->model;
    sw->busy   = mw->busy;
    sw->device = mw->device;
    try {
        brotensor::DeviceScope scope(sw->device);
        sw->session = sw->model->create_session();
    } catch (const std::exception& e) {
        delete sw;
        return JS_ThrowInternalError(ctx, "createSession failed: %s", e.what());
    }
    return qjsbind::wrap<SortformerSessionWrapper>(ctx, sw);
}

static ClusterDiarizerWrapper* clusterSelf(JSContext* ctx, JSValueConst this_val) {
    return qjsbind::unwrap<ClusterDiarizerWrapper>(ctx, this_val);
}

static JSValue js_cluster_diarize(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    auto* w = clusterSelf(ctx, this_val);
    if (!w || !w->model) return JS_ThrowTypeError(ctx, "ClusterDiarizer is closed");
    std::vector<float> audio;
    if (argc < 1 || !readFloat32Array(ctx, argv[0], audio)) return JS_ThrowTypeError(ctx, "audio must be a Float32Array");
    brosoundml::ClusterDiarizer::Config cfg;
    if (argc >= 2) parseClusterConfig(ctx, argv[1], cfg);
    if (w->busy.isBusy()) return JS_ThrowInternalError(ctx, "ClusterDiarizer is busy running an async operation");
    try {
        brotensor::DeviceScope scope(w->device);
        auto d = w->model->diarize(audio, cfg);
        return makeDiarization(ctx, d);
    } catch (const std::exception& e) {
        return JS_ThrowInternalError(ctx, "ClusterDiarizer.diarize failed: %s", e.what());
    }
}

static void registerClusterDiarizerClass(JSContext* ctx) {
    qjsbind::Class<ClusterDiarizerWrapper> c(ctx, "ClusterDiarizer", qjsbind::NoGlobal);
    c.method_raw("diarize", js_cluster_diarize, 2);
    c.get("device", [](ClusterDiarizerWrapper* w) -> const char* { return deviceName(w->device); });
    c.get("busy",   [](ClusterDiarizerWrapper* w) -> bool { return w->busy.isBusy(); });
}

static JSValue js_init(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    try { brotensor::init(); } catch (const std::exception& e) { return JS_ThrowInternalError(ctx, "bro.diar.init failed: %s", e.what()); }
    return JS_UNDEFINED;
}

struct LoadSortformerJob {
    std::string modelDir;
    brotensor::Device device = brotensor::Device::CPU;
    std::shared_ptr<brosoundml::Sortformer> model;
    JSValue onReady = JS_UNDEFINED;
    JSValue onError = JS_UNDEFINED;
    bool hasOnReady = false, hasOnError = false;
};

static JSValue js_loadSortformer(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    std::string modelDir;
    if (argc < 1 || !argStr(ctx, argv[0], modelDir)) return JS_ThrowTypeError(ctx, "modelDir must be a string");
    modelDir = brokit::api::resolveAssetPath(ctx, modelDir);
    auto job = std::make_shared<LoadSortformerJob>();
    job->modelDir = modelDir;
    job->device = autoDevice();
    JSValueConst opts = argc > 1 ? argv[1] : JS_UNDEFINED;
    if (JS_IsObject(opts)) {
        std::string err;
        if (!parseDeviceOpt(ctx, opts, job->device, err)) return JS_ThrowTypeError(ctx, "%s", err.c_str());
        JSValue onReady = JS_GetPropertyStr(ctx, opts, "onReady");
        JSValue onError = JS_GetPropertyStr(ctx, opts, "onError");
        job->hasOnReady = JS_IsFunction(ctx, onReady);
        job->hasOnError = JS_IsFunction(ctx, onError);
        job->onReady    = job->hasOnReady ? JS_DupValue(ctx, onReady) : JS_UNDEFINED;
        job->onError    = job->hasOnError ? JS_DupValue(ctx, onError) : JS_UNDEFINED;
        JS_FreeValue(ctx, onReady);
        JS_FreeValue(ctx, onError);
    }
    auto work = [job](const std::atomic<bool>&) {
        brotensor::DeviceScope scope(job->device);
        job->model = std::make_shared<brosoundml::Sortformer>(job->modelDir, job->device);
    };
    auto done = [job](JSContext* c, bool cancelled, const std::string& error) {
        if (!error.empty() || cancelled || !job->model) {
            if (job->hasOnError) {
                JSValue e = JS_NewString(c, error.empty() ? "cancelled" : error.c_str());
                JSValue r = JS_Call(c, job->onError, JS_UNDEFINED, 1, &e);
                if (JS_IsException(r)) JS_FreeValue(c, JS_GetException(c));
                JS_FreeValue(c, r);
                JS_FreeValue(c, e);
            }
        } else if (job->hasOnReady) {
            auto* w = new SortformerWrapper();
            w->model  = job->model;
            w->device = job->device;
            JSValue obj = qjsbind::wrap<SortformerWrapper>(c, w);
            JSValue r = JS_Call(c, job->onReady, JS_UNDEFINED, 1, &obj);
            if (JS_IsException(r)) JS_FreeValue(c, JS_GetException(c));
            JS_FreeValue(c, r);
            JS_FreeValue(c, obj);
        }
        if (job->hasOnReady) JS_FreeValue(c, job->onReady);
        if (job->hasOnError) JS_FreeValue(c, job->onError);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

struct DiarizeJob {
    std::vector<float> audio;
    brosoundml::Sortformer::Diarization result;
    JSValue onDone = JS_UNDEFINED;
    bool hasOnDone = false;
    JSValue modelRef = JS_UNDEFINED;
};

static JSValue js_diar_diarize(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 2) return JS_ThrowTypeError(ctx, "expected (model, audio, opts?)");
    auto* w = sortformerSelf(ctx, argv[0]);
    if (!w || !w->model) return JS_ThrowTypeError(ctx, "first argument must be a Sortformer");
    auto job = std::make_shared<DiarizeJob>();
    if (!readFloat32Array(ctx, argv[1], job->audio)) return JS_ThrowTypeError(ctx, "audio must be a Float32Array");
    if (!w->busy.tryAcquire()) return JS_ThrowInternalError(ctx, "Sortformer is busy running an async operation");
    JSValue onDone = JS_UNDEFINED;
    if (argc > 2 && JS_IsObject(argv[2])) onDone = JS_GetPropertyStr(ctx, argv[2], "onDone");
    job->hasOnDone = JS_IsFunction(ctx, onDone);
    job->onDone    = job->hasOnDone ? JS_DupValue(ctx, onDone) : JS_UNDEFINED;
    job->modelRef  = JS_DupValue(ctx, argv[0]);
    JS_FreeValue(ctx, onDone);
    SortformerWrapper* mw = w;
    auto work = [job, mw](const std::atomic<bool>&) {
        brotensor::DeviceScope scope(mw->device);
        job->result = mw->model->diarize(job->audio);
    };
    auto done = [job, mw](JSContext* c, bool cancelled, const std::string& error) {
        mw->busy.release();
        if (job->hasOnDone) {
            JSValue res = (error.empty() && !cancelled) ? makeDiarization(c, job->result) : JS_NULL;
            JSValue info = JS_NewObject(c);
            JS_SetPropertyStr(c, info, "cancelled", JS_NewBool(c, cancelled));
            if (!error.empty()) JS_SetPropertyStr(c, info, "error", JS_NewString(c, error.c_str()));
            JSValue args[2] = { res, info };
            JSValue r = JS_Call(c, job->onDone, JS_UNDEFINED, 2, args);
            if (JS_IsException(r)) JS_FreeValue(c, JS_GetException(c));
            JS_FreeValue(c, r);
            JS_FreeValue(c, res);
            JS_FreeValue(c, info);
        }
        if (job->hasOnDone) JS_FreeValue(c, job->onDone);
        JS_FreeValue(c, job->modelRef);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

struct LoadClusterJob {
    std::string embDir, vadDir;
    brotensor::Device device = brotensor::Device::CPU;
    std::shared_ptr<brosoundml::ClusterDiarizer> model;
    JSValue onReady = JS_UNDEFINED;
    JSValue onError = JS_UNDEFINED;
    bool hasOnReady = false, hasOnError = false;
};

static JSValue js_loadClusterDiarizer(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    std::string embDir, vadDir;
    if (argc < 2 || !argStr(ctx, argv[0], embDir) || !argStr(ctx, argv[1], vadDir)) {
        return JS_ThrowTypeError(ctx, "expected (embeddingModelDir, vadModelDir, opts?)");
    }
    embDir = brokit::api::resolveAssetPath(ctx, embDir);
    vadDir = brokit::api::resolveAssetPath(ctx, vadDir);
    auto job = std::make_shared<LoadClusterJob>();
    job->embDir = embDir; job->vadDir = vadDir; job->device = autoDevice();
    JSValueConst opts = argc > 2 ? argv[2] : JS_UNDEFINED;
    if (JS_IsObject(opts)) {
        std::string err;
        if (!parseDeviceOpt(ctx, opts, job->device, err)) return JS_ThrowTypeError(ctx, "%s", err.c_str());
        JSValue onReady = JS_GetPropertyStr(ctx, opts, "onReady");
        JSValue onError = JS_GetPropertyStr(ctx, opts, "onError");
        job->hasOnReady = JS_IsFunction(ctx, onReady);
        job->hasOnError = JS_IsFunction(ctx, onError);
        job->onReady    = job->hasOnReady ? JS_DupValue(ctx, onReady) : JS_UNDEFINED;
        job->onError    = job->hasOnError ? JS_DupValue(ctx, onError) : JS_UNDEFINED;
        JS_FreeValue(ctx, onReady);
        JS_FreeValue(ctx, onError);
    }
    auto work = [job](const std::atomic<bool>&) {
        brotensor::DeviceScope scope(job->device);
        job->model = std::make_shared<brosoundml::ClusterDiarizer>(job->embDir, job->vadDir, job->device);
    };
    auto done = [job](JSContext* c, bool cancelled, const std::string& error) {
        if (!error.empty() || cancelled || !job->model) {
            if (job->hasOnError) {
                JSValue e = JS_NewString(c, error.empty() ? "cancelled" : error.c_str());
                JSValue r = JS_Call(c, job->onError, JS_UNDEFINED, 1, &e);
                if (JS_IsException(r)) JS_FreeValue(c, JS_GetException(c));
                JS_FreeValue(c, r);
                JS_FreeValue(c, e);
            }
        } else if (job->hasOnReady) {
            auto* w = new ClusterDiarizerWrapper();
            w->model  = job->model;
            w->device = job->device;
            JSValue obj = qjsbind::wrap<ClusterDiarizerWrapper>(c, w);
            JSValue r = JS_Call(c, job->onReady, JS_UNDEFINED, 1, &obj);
            if (JS_IsException(r)) JS_FreeValue(c, JS_GetException(c));
            JS_FreeValue(c, r);
            JS_FreeValue(c, obj);
        }
        if (job->hasOnReady) JS_FreeValue(c, job->onReady);
        if (job->hasOnError) JS_FreeValue(c, job->onError);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

struct ClusterDiarizeJob {
    std::vector<float> audio;
    brosoundml::ClusterDiarizer::Config cfg;
    brosoundml::ClusterDiarizer::Diarization result;
    JSValue onDone = JS_UNDEFINED;
    bool hasOnDone = false;
    JSValue modelRef = JS_UNDEFINED;
};

static JSValue js_diar_clusterDiarize(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 2) return JS_ThrowTypeError(ctx, "expected (model, audio, opts?)");
    auto* w = clusterSelf(ctx, argv[0]);
    if (!w || !w->model) return JS_ThrowTypeError(ctx, "first argument must be a ClusterDiarizer");
    auto job = std::make_shared<ClusterDiarizeJob>();
    if (!readFloat32Array(ctx, argv[1], job->audio)) return JS_ThrowTypeError(ctx, "audio must be a Float32Array");
    if (!w->busy.tryAcquire()) return JS_ThrowInternalError(ctx, "ClusterDiarizer is busy running an async operation");
    JSValue onDone = JS_UNDEFINED;
    if (argc > 2 && JS_IsObject(argv[2])) {
        parseClusterConfig(ctx, argv[2], job->cfg);
        onDone = JS_GetPropertyStr(ctx, argv[2], "onDone");
    }
    job->hasOnDone = JS_IsFunction(ctx, onDone);
    job->onDone    = job->hasOnDone ? JS_DupValue(ctx, onDone) : JS_UNDEFINED;
    job->modelRef  = JS_DupValue(ctx, argv[0]);
    JS_FreeValue(ctx, onDone);
    ClusterDiarizerWrapper* mw = w;
    auto work = [job, mw](const std::atomic<bool>&) {
        brotensor::DeviceScope scope(mw->device);
        job->result = mw->model->diarize(job->audio, job->cfg);
    };
    auto done = [job, mw](JSContext* c, bool cancelled, const std::string& error) {
        mw->busy.release();
        if (job->hasOnDone) {
            JSValue res = (error.empty() && !cancelled) ? makeDiarization(c, job->result) : JS_NULL;
            JSValue info = JS_NewObject(c);
            JS_SetPropertyStr(c, info, "cancelled", JS_NewBool(c, cancelled));
            if (!error.empty()) JS_SetPropertyStr(c, info, "error", JS_NewString(c, error.c_str()));
            JSValue args[2] = { res, info };
            JSValue r = JS_Call(c, job->onDone, JS_UNDEFINED, 2, args);
            if (JS_IsException(r)) JS_FreeValue(c, JS_GetException(c));
            JS_FreeValue(c, r);
            JS_FreeValue(c, res);
            JS_FreeValue(c, info);
        }
        if (job->hasOnDone) JS_FreeValue(c, job->onDone);
        JS_FreeValue(c, job->modelRef);
    };
    return launchAsyncJob(ctx, std::move(work), nullptr, std::move(done));
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void installDiarBindings(JSContext* ctx) {
    registerSortformerClass(ctx);
        registerSortformerSessionClass(ctx);
        registerClusterDiarizerClass(ctx);
    
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
        if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
            JS_FreeValue(ctx, broObj);
            broObj = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
        }
    
        JSValue diar = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, diar, "init", JS_NewCFunction(ctx, js_init, "init", 0));
        JS_SetPropertyStr(ctx, diar, "loadSortformer", JS_NewCFunction(ctx, js_loadSortformer, "loadSortformer", 2));
        JS_SetPropertyStr(ctx, diar, "diarize", JS_NewCFunction(ctx, js_diar_diarize, "diarize", 3));
        JS_SetPropertyStr(ctx, diar, "loadClusterDiarizer", JS_NewCFunction(ctx, js_loadClusterDiarizer, "loadClusterDiarizer", 3));
        JS_SetPropertyStr(ctx, diar, "clusterDiarize", JS_NewCFunction(ctx, js_diar_clusterDiarize, "clusterDiarize", 3));
        JS_SetPropertyStr(ctx, broObj, "diar", diar);
    
        JS_FreeValue(ctx, broObj);
        JS_FreeValue(ctx, global);
}


} // namespace bro::js

#endif // BRO_WITH_SOUNDML
