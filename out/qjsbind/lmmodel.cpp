#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID lm_model_class_id = 0;

static void lm_model_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<LMModelWrapper*>(JS_GetOpaque(val, lm_model_class_id));
    delete w;
}

static JSClassDef lm_model_class_def = { "LMModel", lm_model_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue lm_model_allocate_cache(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<LMModelWrapper*>(JS_GetOpaque2(ctx, this_val, lm_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "allocateCache(maxTokens)");

    int32_t maxTokens;
    if (JS_ToInt32(ctx, &maxTokens, argv[0])) return JS_EXCEPTION;

    return JS_UNDEFINED;
}

static JSValue lm_model_reset_cache(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<LMModelWrapper*>(JS_GetOpaque2(ctx, this_val, lm_model_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_UNDEFINED;
}

static JSValue lm_model_generate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<LMModelWrapper*>(JS_GetOpaque2(ctx, this_val, lm_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "generate(promptIds, opts)");

    JSValueConst promptIds = argv[0];
    JSValueConst opts = argv[1];

    return 0;
}

static JSValue lm_model_generate_stream(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<LMModelWrapper*>(JS_GetOpaque2(ctx, this_val, lm_model_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 3)
        return JS_ThrowTypeError(ctx, "generateStream(promptIds, opts, onToken)");

    JSValueConst promptIds = argv[0];
    JSValueConst opts = argv[1];
    JSValueConst onToken = argv[2];

    return 0;
}

static JSValue js_lm_model_family(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_lm_model_vocabSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_lm_model_hiddenSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_lm_model_numLayers(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_lm_model_maxSeqLen(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_lm_model_cacheLen(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installLMModel(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register LMModel class
    if (lm_model_class_id == 0) JS_NewClassID(rt, &lm_model_class_id);
    JS_NewClass(rt, lm_model_class_id, &lm_model_class_def);

    JSValue lm_modelProto = JS_NewObject(ctx);

    JSAtom lm_model_family_atom = JS_NewAtom(ctx, "family");
    JS_DefinePropertyGetSet(ctx, lm_modelProto, lm_model_family_atom,
                            newGetter(ctx, js_lm_model_family, "family"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, lm_model_family_atom);
    JSAtom lm_model_vocabSize_atom = JS_NewAtom(ctx, "vocabSize");
    JS_DefinePropertyGetSet(ctx, lm_modelProto, lm_model_vocabSize_atom,
                            newGetter(ctx, js_lm_model_vocabSize, "vocabSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, lm_model_vocabSize_atom);
    JSAtom lm_model_hiddenSize_atom = JS_NewAtom(ctx, "hiddenSize");
    JS_DefinePropertyGetSet(ctx, lm_modelProto, lm_model_hiddenSize_atom,
                            newGetter(ctx, js_lm_model_hiddenSize, "hiddenSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, lm_model_hiddenSize_atom);
    JSAtom lm_model_numLayers_atom = JS_NewAtom(ctx, "numLayers");
    JS_DefinePropertyGetSet(ctx, lm_modelProto, lm_model_numLayers_atom,
                            newGetter(ctx, js_lm_model_numLayers, "numLayers"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, lm_model_numLayers_atom);
    JSAtom lm_model_maxSeqLen_atom = JS_NewAtom(ctx, "maxSeqLen");
    JS_DefinePropertyGetSet(ctx, lm_modelProto, lm_model_maxSeqLen_atom,
                            newGetter(ctx, js_lm_model_maxSeqLen, "maxSeqLen"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, lm_model_maxSeqLen_atom);
    JSAtom lm_model_cacheLen_atom = JS_NewAtom(ctx, "cacheLen");
    JS_DefinePropertyGetSet(ctx, lm_modelProto, lm_model_cacheLen_atom,
                            newGetter(ctx, js_lm_model_cacheLen, "cacheLen"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, lm_model_cacheLen_atom);

    JS_SetPropertyStr(ctx, lm_modelProto, "allocateCache",
        JS_NewCFunction(ctx, lm_model_allocate_cache, "allocateCache", 1));
    JS_SetPropertyStr(ctx, lm_modelProto, "resetCache",
        JS_NewCFunction(ctx, lm_model_reset_cache, "resetCache", 0));
    JS_SetPropertyStr(ctx, lm_modelProto, "generate",
        JS_NewCFunction(ctx, lm_model_generate, "generate", 2));
    JS_SetPropertyStr(ctx, lm_modelProto, "generateStream",
        JS_NewCFunction(ctx, lm_model_generate_stream, "generateStream", 3));

    JS_SetClassProto(ctx, lm_model_class_id, lm_modelProto);

    JSValue lm_modelCtor = JS_NewCFunction2(ctx, js_lm_model_constructor, "LMModel", 1,
                                         JS_CFUNC_constructor, 0);
    lm_modelProto = JS_GetClassProto(ctx, lm_model_class_id);
    JS_SetPropertyStr(ctx, lm_modelCtor, "prototype", JS_DupValue(ctx, lm_modelProto));
    JS_SetPropertyStr(ctx, lm_modelProto, "constructor", JS_DupValue(ctx, lm_modelCtor));
    JS_FreeValue(ctx, lm_modelProto);

    JS_SetPropertyStr(ctx, global, "LMModel", lm_modelCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
