#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID qwen35_model_class_id = 0;

static void qwen35_model_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<Qwen35ModelWrapper*>(JS_GetOpaque(val, qwen35_model_class_id));
    delete w;
}

static JSClassDef qwen35_model_class_def = { "Qwen35Model", qwen35_model_finalizer };

static JSValue qwen35_model_encode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<Qwen35ModelWrapper*>(JS_GetOpaque2(ctx, this_val, qwen35_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "encode(text, addSpecial)");

    const char* text_cstr = JS_ToCString(ctx, argv[0]);
    if (!text_cstr) return JS_EXCEPTION;
    std::string text = text_cstr;
    JS_FreeCString(ctx, text_cstr);
    bool addSpecial = false;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        addSpecial = JS_ToBool(ctx, argv[1]) > 0;
    }

    return 0;
}

static JSValue qwen35_model_decode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<Qwen35ModelWrapper*>(JS_GetOpaque2(ctx, this_val, qwen35_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "decode(ids)");

    JSValueConst ids = argv[0];

    return JS_NewString(ctx, "FastNoise2 v0.10.0-alpha");
}

static JSValue qwen35_model_generate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<Qwen35ModelWrapper*>(JS_GetOpaque2(ctx, this_val, qwen35_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "generate(prompt, opts)");

    const char* prompt_cstr = JS_ToCString(ctx, argv[0]);
    if (!prompt_cstr) return JS_EXCEPTION;
    std::string prompt = prompt_cstr;
    JS_FreeCString(ctx, prompt_cstr);
    JSValueConst opts = argv[1];

    return 0;
}

static JSValue js_qwen35_model_family(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_qwen35_model_vocabSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen35_model_hiddenSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen35_model_numLayers(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen35_model_maxSeqLen(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen35_model_eosId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen35_model_imEndId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen35_model_endoftextId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installQwen35Model(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register Qwen35Model class
    if (qwen35_model_class_id == 0) JS_NewClassID(rt, &qwen35_model_class_id);
    JS_NewClass(rt, qwen35_model_class_id, &qwen35_model_class_def);

    JSValue qwen35_modelProto = JS_NewObject(ctx);

    JSAtom qwen35_model_family_atom = JS_NewAtom(ctx, "family");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_family_atom,
                            newGetter(ctx, js_qwen35_model_family, "family"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_family_atom);
    JSAtom qwen35_model_vocabSize_atom = JS_NewAtom(ctx, "vocabSize");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_vocabSize_atom,
                            newGetter(ctx, js_qwen35_model_vocabSize, "vocabSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_vocabSize_atom);
    JSAtom qwen35_model_hiddenSize_atom = JS_NewAtom(ctx, "hiddenSize");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_hiddenSize_atom,
                            newGetter(ctx, js_qwen35_model_hiddenSize, "hiddenSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_hiddenSize_atom);
    JSAtom qwen35_model_numLayers_atom = JS_NewAtom(ctx, "numLayers");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_numLayers_atom,
                            newGetter(ctx, js_qwen35_model_numLayers, "numLayers"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_numLayers_atom);
    JSAtom qwen35_model_maxSeqLen_atom = JS_NewAtom(ctx, "maxSeqLen");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_maxSeqLen_atom,
                            newGetter(ctx, js_qwen35_model_maxSeqLen, "maxSeqLen"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_maxSeqLen_atom);
    JSAtom qwen35_model_eosId_atom = JS_NewAtom(ctx, "eosId");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_eosId_atom,
                            newGetter(ctx, js_qwen35_model_eosId, "eosId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_eosId_atom);
    JSAtom qwen35_model_imEndId_atom = JS_NewAtom(ctx, "imEndId");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_imEndId_atom,
                            newGetter(ctx, js_qwen35_model_imEndId, "imEndId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_imEndId_atom);
    JSAtom qwen35_model_endoftextId_atom = JS_NewAtom(ctx, "endoftextId");
    JS_DefinePropertyGetSet(ctx, qwen35_modelProto, qwen35_model_endoftextId_atom,
                            newGetter(ctx, js_qwen35_model_endoftextId, "endoftextId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen35_model_endoftextId_atom);

    JS_SetPropertyStr(ctx, qwen35_modelProto, "encode",
        JS_NewCFunction(ctx, qwen35_model_encode, "encode", 2));
    JS_SetPropertyStr(ctx, qwen35_modelProto, "decode",
        JS_NewCFunction(ctx, qwen35_model_decode, "decode", 1));
    JS_SetPropertyStr(ctx, qwen35_modelProto, "generate",
        JS_NewCFunction(ctx, qwen35_model_generate, "generate", 2));

    JS_SetClassProto(ctx, qwen35_model_class_id, qwen35_modelProto);

    JSValue qwen35_modelCtor = JS_NewCFunction2(ctx, js_qwen35_model_constructor, "Qwen35Model", 1,
                                         JS_CFUNC_constructor, 0);
    qwen35_modelProto = JS_GetClassProto(ctx, qwen35_model_class_id);
    JS_SetPropertyStr(ctx, qwen35_modelCtor, "prototype", JS_DupValue(ctx, qwen35_modelProto));
    JS_SetPropertyStr(ctx, qwen35_modelProto, "constructor", JS_DupValue(ctx, qwen35_modelCtor));
    JS_FreeValue(ctx, qwen35_modelProto);

    JS_SetPropertyStr(ctx, global, "Qwen35Model", qwen35_modelCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
