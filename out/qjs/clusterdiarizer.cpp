#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID cluster_diarizer_class_id = 0;

static void cluster_diarizer_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<ClusterDiarizerWrapper*>(JS_GetOpaque(val, cluster_diarizer_class_id));
    delete w;
}

static JSClassDef cluster_diarizer_class_def = { "ClusterDiarizer", cluster_diarizer_finalizer };

static JSValue make_float32_array(JSContext* ctx, const float* data, size_t count)
{
    size_t byte_len = count * sizeof(float);
    JSValue ab = JS_NewArrayBufferCopy(ctx, reinterpret_cast<const uint8_t*>(data), byte_len);
    if (JS_IsException(ab)) return ab;

    JSValue global = JS_GetGlobalObject(ctx);
    JSValue ctor = JS_GetPropertyStr(ctx, global, "Float32Array");
    JSValue result = JS_CallConstructor(ctx, ctor, 1, &ab);
    JS_FreeValue(ctx, ctor);
    JS_FreeValue(ctx, global);
    JS_FreeValue(ctx, ab);
    return result;
}

static bool resolve_f32(JSContext* ctx, JSValueConst v, const char* name,
                        float** out, size_t* count)
{
    size_t byte_offset = 0, byte_len = 0, bpe = 0;
    JSValue buf = JS_GetTypedArrayBuffer(ctx, v, &byte_offset, &byte_len, &bpe);
    if (JS_IsException(buf)) {
        JS_FreeValue(ctx, JS_GetException(ctx));
        JS_ThrowTypeError(ctx, "%s must be a Float32Array", name);
        return false;
    }
    if (bpe != sizeof(float)) {
        JS_FreeValue(ctx, buf);
        JS_ThrowTypeError(ctx, "%s must be a Float32Array", name);
        return false;
    }
    size_t ab_len = 0;
    uint8_t* ab_ptr = JS_GetArrayBuffer(ctx, &ab_len, buf);
    JS_FreeValue(ctx, buf);
    if (!ab_ptr) {
        JS_ThrowTypeError(ctx, "%s has a detached or invalid buffer", name);
        return false;
    }
    *out   = reinterpret_cast<float*>(ab_ptr + byte_offset);
    *count = byte_len / sizeof(float);
    return true;
}

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue cluster_diarizer_diarize(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<ClusterDiarizerWrapper*>(JS_GetOpaque2(ctx, this_val, cluster_diarizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "diarize(audio, opts)");

    float* audio = nullptr;
    size_t n_audio = 0;
    if (!resolve_f32(ctx, argv[0], "audio", &audio, &n_audio)) return JS_EXCEPTION;
    JSValueConst opts = argv[1];

    return 0;
}

static JSValue js_cluster_diarizer_device(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_cluster_diarizer_busy(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

void installClusterDiarizer(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register ClusterDiarizer class
    if (cluster_diarizer_class_id == 0) JS_NewClassID(rt, &cluster_diarizer_class_id);
    JS_NewClass(rt, cluster_diarizer_class_id, &cluster_diarizer_class_def);

    JSValue cluster_diarizerProto = JS_NewObject(ctx);

    JSAtom cluster_diarizer_device_atom = JS_NewAtom(ctx, "device");
    JS_DefinePropertyGetSet(ctx, cluster_diarizerProto, cluster_diarizer_device_atom,
                            newGetter(ctx, js_cluster_diarizer_device, "device"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, cluster_diarizer_device_atom);
    JSAtom cluster_diarizer_busy_atom = JS_NewAtom(ctx, "busy");
    JS_DefinePropertyGetSet(ctx, cluster_diarizerProto, cluster_diarizer_busy_atom,
                            newGetter(ctx, js_cluster_diarizer_busy, "busy"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, cluster_diarizer_busy_atom);

    JS_SetPropertyStr(ctx, cluster_diarizerProto, "diarize",
        JS_NewCFunction(ctx, cluster_diarizer_diarize, "diarize", 2));

    JS_SetClassProto(ctx, cluster_diarizer_class_id, cluster_diarizerProto);

    JSValue cluster_diarizerCtor = JS_NewCFunction2(ctx, js_cluster_diarizer_constructor, "ClusterDiarizer", 1,
                                         JS_CFUNC_constructor, 0);
    cluster_diarizerProto = JS_GetClassProto(ctx, cluster_diarizer_class_id);
    JS_SetPropertyStr(ctx, cluster_diarizerCtor, "prototype", JS_DupValue(ctx, cluster_diarizerProto));
    JS_SetPropertyStr(ctx, cluster_diarizerProto, "constructor", JS_DupValue(ctx, cluster_diarizerCtor));
    JS_FreeValue(ctx, cluster_diarizerProto);

    JS_SetPropertyStr(ctx, global, "ClusterDiarizer", cluster_diarizerCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
