#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID nllb_model_class_id = 0;

static void nllb_model_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<NllbModelWrapper*>(JS_GetOpaque(val, nllb_model_class_id));
    delete w;
}

static JSClassDef nllb_model_class_def = { "NllbModel", nllb_model_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue nllb_model_has_language(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<NllbModelWrapper*>(JS_GetOpaque2(ctx, this_val, nllb_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "hasLanguage(code)");

    const char* code_cstr = JS_ToCString(ctx, argv[0]);
    if (!code_cstr) return JS_EXCEPTION;
    std::string code = code_cstr;
    JS_FreeCString(ctx, code_cstr);

    return JS_NewBool(ctx, 0);
}

static JSValue nllb_model_translate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<NllbModelWrapper*>(JS_GetOpaque2(ctx, this_val, nllb_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 3)
        return JS_ThrowTypeError(ctx, "translate(text, srcLang, tgtLang, opts)");

    const char* text_cstr = JS_ToCString(ctx, argv[0]);
    if (!text_cstr) return JS_EXCEPTION;
    std::string text = text_cstr;
    JS_FreeCString(ctx, text_cstr);
    const char* srcLang_cstr = JS_ToCString(ctx, argv[1]);
    if (!srcLang_cstr) return JS_EXCEPTION;
    std::string srcLang = srcLang_cstr;
    JS_FreeCString(ctx, srcLang_cstr);
    const char* tgtLang_cstr = JS_ToCString(ctx, argv[2]);
    if (!tgtLang_cstr) return JS_EXCEPTION;
    std::string tgtLang = tgtLang_cstr;
    JS_FreeCString(ctx, tgtLang_cstr);
    JSValueConst opts = argv[3];

    return 0;
}

static JSValue js_nllb_model_family(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_nllb_model_vocabSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_nllb_model_dModel(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_nllb_model_encoderLayers(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_nllb_model_decoderLayers(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_nllb_model_languageCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installNllbModel(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register NllbModel class
    if (nllb_model_class_id == 0) JS_NewClassID(rt, &nllb_model_class_id);
    JS_NewClass(rt, nllb_model_class_id, &nllb_model_class_def);

    JSValue nllb_modelProto = JS_NewObject(ctx);

    JSAtom nllb_model_family_atom = JS_NewAtom(ctx, "family");
    JS_DefinePropertyGetSet(ctx, nllb_modelProto, nllb_model_family_atom,
                            newGetter(ctx, js_nllb_model_family, "family"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, nllb_model_family_atom);
    JSAtom nllb_model_vocabSize_atom = JS_NewAtom(ctx, "vocabSize");
    JS_DefinePropertyGetSet(ctx, nllb_modelProto, nllb_model_vocabSize_atom,
                            newGetter(ctx, js_nllb_model_vocabSize, "vocabSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, nllb_model_vocabSize_atom);
    JSAtom nllb_model_dModel_atom = JS_NewAtom(ctx, "dModel");
    JS_DefinePropertyGetSet(ctx, nllb_modelProto, nllb_model_dModel_atom,
                            newGetter(ctx, js_nllb_model_dModel, "dModel"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, nllb_model_dModel_atom);
    JSAtom nllb_model_encoderLayers_atom = JS_NewAtom(ctx, "encoderLayers");
    JS_DefinePropertyGetSet(ctx, nllb_modelProto, nllb_model_encoderLayers_atom,
                            newGetter(ctx, js_nllb_model_encoderLayers, "encoderLayers"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, nllb_model_encoderLayers_atom);
    JSAtom nllb_model_decoderLayers_atom = JS_NewAtom(ctx, "decoderLayers");
    JS_DefinePropertyGetSet(ctx, nllb_modelProto, nllb_model_decoderLayers_atom,
                            newGetter(ctx, js_nllb_model_decoderLayers, "decoderLayers"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, nllb_model_decoderLayers_atom);
    JSAtom nllb_model_languageCount_atom = JS_NewAtom(ctx, "languageCount");
    JS_DefinePropertyGetSet(ctx, nllb_modelProto, nllb_model_languageCount_atom,
                            newGetter(ctx, js_nllb_model_languageCount, "languageCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, nllb_model_languageCount_atom);

    JS_SetPropertyStr(ctx, nllb_modelProto, "hasLanguage",
        JS_NewCFunction(ctx, nllb_model_has_language, "hasLanguage", 1));
    JS_SetPropertyStr(ctx, nllb_modelProto, "translate",
        JS_NewCFunction(ctx, nllb_model_translate, "translate", 4));

    JS_SetClassProto(ctx, nllb_model_class_id, nllb_modelProto);

    JSValue nllb_modelCtor = JS_NewCFunction2(ctx, js_nllb_model_constructor, "NllbModel", 1,
                                         JS_CFUNC_constructor, 0);
    nllb_modelProto = JS_GetClassProto(ctx, nllb_model_class_id);
    JS_SetPropertyStr(ctx, nllb_modelCtor, "prototype", JS_DupValue(ctx, nllb_modelProto));
    JS_SetPropertyStr(ctx, nllb_modelProto, "constructor", JS_DupValue(ctx, nllb_modelCtor));
    JS_FreeValue(ctx, nllb_modelProto);

    JS_SetPropertyStr(ctx, global, "NllbModel", nllb_modelCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
