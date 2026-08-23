#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID clip_model_class_id = 0;

static void clip_model_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<ClipModelWrapper*>(JS_GetOpaque(val, clip_model_class_id));
    delete w;
}

static JSClassDef clip_model_class_def = { "ClipModel", clip_model_finalizer };

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

static JSValue clip_model_encode_text(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<ClipModelWrapper*>(JS_GetOpaque2(ctx, this_val, clip_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "encodeText(text)");

    JSValueConst text = argv[0];

    return 0;
}

static JSValue clip_model_encode_image(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<ClipModelWrapper*>(JS_GetOpaque2(ctx, this_val, clip_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "encodeImage(image)");

    JSValueConst image = argv[0];

    return make_float32_array(ctx, (0).data(), (0).size());
}

static JSValue clip_model_score(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<ClipModelWrapper*>(JS_GetOpaque2(ctx, this_val, clip_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "score(text, image)");

    JSValueConst text = argv[0];
    JSValueConst image = argv[1];

    return 0;
}

static JSValue js_clip_model_projectionDim(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installClipModel(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register ClipModel class
    if (clip_model_class_id == 0) JS_NewClassID(rt, &clip_model_class_id);
    JS_NewClass(rt, clip_model_class_id, &clip_model_class_def);

    JSValue clip_modelProto = JS_NewObject(ctx);

    JSAtom clip_model_projectionDim_atom = JS_NewAtom(ctx, "projectionDim");
    JS_DefinePropertyGetSet(ctx, clip_modelProto, clip_model_projectionDim_atom,
                            newGetter(ctx, js_clip_model_projectionDim, "projectionDim"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, clip_model_projectionDim_atom);

    JS_SetPropertyStr(ctx, clip_modelProto, "encodeText",
        JS_NewCFunction(ctx, clip_model_encode_text, "encodeText", 1));
    JS_SetPropertyStr(ctx, clip_modelProto, "encodeImage",
        JS_NewCFunction(ctx, clip_model_encode_image, "encodeImage", 1));
    JS_SetPropertyStr(ctx, clip_modelProto, "score",
        JS_NewCFunction(ctx, clip_model_score, "score", 2));

    JS_SetClassProto(ctx, clip_model_class_id, clip_modelProto);

    JSValue clip_modelCtor = JS_NewCFunction2(ctx, js_clip_model_constructor, "ClipModel", 1,
                                         JS_CFUNC_constructor, 0);
    clip_modelProto = JS_GetClassProto(ctx, clip_model_class_id);
    JS_SetPropertyStr(ctx, clip_modelCtor, "prototype", JS_DupValue(ctx, clip_modelProto));
    JS_SetPropertyStr(ctx, clip_modelProto, "constructor", JS_DupValue(ctx, clip_modelCtor));
    JS_FreeValue(ctx, clip_modelProto);

    JS_SetPropertyStr(ctx, global, "ClipModel", clip_modelCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
