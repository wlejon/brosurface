#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID t5_model_class_id = 0;

static void t5_model_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<T5ModelWrapper*>(JS_GetOpaque(val, t5_model_class_id));
    delete w;
}

static JSClassDef t5_model_class_def = { "T5Model", t5_model_finalizer };

static JSValue t5_model_encode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<T5ModelWrapper*>(JS_GetOpaque2(ctx, this_val, t5_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "encode(text, opts)");

    const char* text_cstr = JS_ToCString(ctx, argv[0]);
    if (!text_cstr) return JS_EXCEPTION;
    std::string text = text_cstr;
    JS_FreeCString(ctx, text_cstr);
    JSValueConst opts = argv[1];

    return 0;
}

static JSValue js_t5_model_dModel(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_t5_model_maxLength(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_t5_model_padId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_t5_model_eosId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_t5_model_vocabCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installT5Model(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register T5Model class
    if (t5_model_class_id == 0) JS_NewClassID(rt, &t5_model_class_id);
    JS_NewClass(rt, t5_model_class_id, &t5_model_class_def);

    JSValue t5_modelProto = JS_NewObject(ctx);

    JSAtom t5_model_dModel_atom = JS_NewAtom(ctx, "dModel");
    JS_DefinePropertyGetSet(ctx, t5_modelProto, t5_model_dModel_atom,
                            newGetter(ctx, js_t5_model_dModel, "dModel"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, t5_model_dModel_atom);
    JSAtom t5_model_maxLength_atom = JS_NewAtom(ctx, "maxLength");
    JS_DefinePropertyGetSet(ctx, t5_modelProto, t5_model_maxLength_atom,
                            newGetter(ctx, js_t5_model_maxLength, "maxLength"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, t5_model_maxLength_atom);
    JSAtom t5_model_padId_atom = JS_NewAtom(ctx, "padId");
    JS_DefinePropertyGetSet(ctx, t5_modelProto, t5_model_padId_atom,
                            newGetter(ctx, js_t5_model_padId, "padId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, t5_model_padId_atom);
    JSAtom t5_model_eosId_atom = JS_NewAtom(ctx, "eosId");
    JS_DefinePropertyGetSet(ctx, t5_modelProto, t5_model_eosId_atom,
                            newGetter(ctx, js_t5_model_eosId, "eosId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, t5_model_eosId_atom);
    JSAtom t5_model_vocabCount_atom = JS_NewAtom(ctx, "vocabCount");
    JS_DefinePropertyGetSet(ctx, t5_modelProto, t5_model_vocabCount_atom,
                            newGetter(ctx, js_t5_model_vocabCount, "vocabCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, t5_model_vocabCount_atom);

    JS_SetPropertyStr(ctx, t5_modelProto, "encode",
        JS_NewCFunction(ctx, t5_model_encode, "encode", 2));

    JS_SetClassProto(ctx, t5_model_class_id, t5_modelProto);

    JSValue t5_modelCtor = JS_NewCFunction2(ctx, js_t5_model_constructor, "T5Model", 1,
                                         JS_CFUNC_constructor, 0);
    t5_modelProto = JS_GetClassProto(ctx, t5_model_class_id);
    JS_SetPropertyStr(ctx, t5_modelCtor, "prototype", JS_DupValue(ctx, t5_modelProto));
    JS_SetPropertyStr(ctx, t5_modelProto, "constructor", JS_DupValue(ctx, t5_modelCtor));
    JS_FreeValue(ctx, t5_modelProto);

    JS_SetPropertyStr(ctx, global, "T5Model", t5_modelCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
