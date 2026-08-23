#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID sortformer_class_id = 0;

static void sortformer_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<SortformerWrapper*>(JS_GetOpaque(val, sortformer_class_id));
    delete w;
}

static JSClassDef sortformer_class_def = { "Sortformer", sortformer_finalizer };

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

static JSValue sortformer_diarize(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SortformerWrapper*>(JS_GetOpaque2(ctx, this_val, sortformer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "diarize(audio)");

    float* audio = nullptr;
    size_t n_audio = 0;
    if (!resolve_f32(ctx, argv[0], "audio", &audio, &n_audio)) return JS_EXCEPTION;

    return 0;
}

static JSValue sortformer_create_session(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SortformerWrapper*>(JS_GetOpaque2(ctx, this_val, sortformer_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue js_sortformer_device(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_sortformer_busy(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

void installSortformer(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register Sortformer class
    if (sortformer_class_id == 0) JS_NewClassID(rt, &sortformer_class_id);
    JS_NewClass(rt, sortformer_class_id, &sortformer_class_def);

    JSValue sortformerProto = JS_NewObject(ctx);

    JSAtom sortformer_device_atom = JS_NewAtom(ctx, "device");
    JS_DefinePropertyGetSet(ctx, sortformerProto, sortformer_device_atom,
                            newGetter(ctx, js_sortformer_device, "device"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, sortformer_device_atom);
    JSAtom sortformer_busy_atom = JS_NewAtom(ctx, "busy");
    JS_DefinePropertyGetSet(ctx, sortformerProto, sortformer_busy_atom,
                            newGetter(ctx, js_sortformer_busy, "busy"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, sortformer_busy_atom);

    JS_SetPropertyStr(ctx, sortformerProto, "diarize",
        JS_NewCFunction(ctx, sortformer_diarize, "diarize", 1));
    JS_SetPropertyStr(ctx, sortformerProto, "createSession",
        JS_NewCFunction(ctx, sortformer_create_session, "createSession", 0));

    JS_SetClassProto(ctx, sortformer_class_id, sortformerProto);

    JSValue sortformerCtor = JS_NewCFunction2(ctx, js_sortformer_constructor, "Sortformer", 1,
                                         JS_CFUNC_constructor, 0);
    sortformerProto = JS_GetClassProto(ctx, sortformer_class_id);
    JS_SetPropertyStr(ctx, sortformerCtor, "prototype", JS_DupValue(ctx, sortformerProto));
    JS_SetPropertyStr(ctx, sortformerProto, "constructor", JS_DupValue(ctx, sortformerCtor));
    JS_FreeValue(ctx, sortformerProto);

    JS_SetPropertyStr(ctx, global, "Sortformer", sortformerCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
