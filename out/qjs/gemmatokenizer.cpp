#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID gemma_tokenizer_class_id = 0;

static void gemma_tokenizer_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<GemmaTokenizerWrapper*>(JS_GetOpaque(val, gemma_tokenizer_class_id));
    delete w;
}

static JSClassDef gemma_tokenizer_class_def = { "GemmaTokenizer", gemma_tokenizer_finalizer };

static JSValue gemma_tokenizer_encode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<GemmaTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, gemma_tokenizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "encode(text, addBos)");

    const char* text_cstr = JS_ToCString(ctx, argv[0]);
    if (!text_cstr) return JS_EXCEPTION;
    std::string text = text_cstr;
    JS_FreeCString(ctx, text_cstr);
    bool addBos = false;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        addBos = JS_ToBool(ctx, argv[1]) > 0;
    }

    return 0;
}

static JSValue gemma_tokenizer_decode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<GemmaTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, gemma_tokenizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "decode(ids)");

    JSValueConst ids = argv[0];

    return JS_NewString(ctx, "FastNoise2 v0.10.0-alpha");
}

static JSValue js_gemma_tokenizer_eosId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_gemma_tokenizer_bosId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_gemma_tokenizer_padId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_gemma_tokenizer_unkId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_gemma_tokenizer_vocabCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installGemmaTokenizer(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register GemmaTokenizer class
    if (gemma_tokenizer_class_id == 0) JS_NewClassID(rt, &gemma_tokenizer_class_id);
    JS_NewClass(rt, gemma_tokenizer_class_id, &gemma_tokenizer_class_def);

    JSValue gemma_tokenizerProto = JS_NewObject(ctx);

    JSAtom gemma_tokenizer_eosId_atom = JS_NewAtom(ctx, "eosId");
    JS_DefinePropertyGetSet(ctx, gemma_tokenizerProto, gemma_tokenizer_eosId_atom,
                            newGetter(ctx, js_gemma_tokenizer_eosId, "eosId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gemma_tokenizer_eosId_atom);
    JSAtom gemma_tokenizer_bosId_atom = JS_NewAtom(ctx, "bosId");
    JS_DefinePropertyGetSet(ctx, gemma_tokenizerProto, gemma_tokenizer_bosId_atom,
                            newGetter(ctx, js_gemma_tokenizer_bosId, "bosId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gemma_tokenizer_bosId_atom);
    JSAtom gemma_tokenizer_padId_atom = JS_NewAtom(ctx, "padId");
    JS_DefinePropertyGetSet(ctx, gemma_tokenizerProto, gemma_tokenizer_padId_atom,
                            newGetter(ctx, js_gemma_tokenizer_padId, "padId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gemma_tokenizer_padId_atom);
    JSAtom gemma_tokenizer_unkId_atom = JS_NewAtom(ctx, "unkId");
    JS_DefinePropertyGetSet(ctx, gemma_tokenizerProto, gemma_tokenizer_unkId_atom,
                            newGetter(ctx, js_gemma_tokenizer_unkId, "unkId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gemma_tokenizer_unkId_atom);
    JSAtom gemma_tokenizer_vocabCount_atom = JS_NewAtom(ctx, "vocabCount");
    JS_DefinePropertyGetSet(ctx, gemma_tokenizerProto, gemma_tokenizer_vocabCount_atom,
                            newGetter(ctx, js_gemma_tokenizer_vocabCount, "vocabCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gemma_tokenizer_vocabCount_atom);

    JS_SetPropertyStr(ctx, gemma_tokenizerProto, "encode",
        JS_NewCFunction(ctx, gemma_tokenizer_encode, "encode", 2));
    JS_SetPropertyStr(ctx, gemma_tokenizerProto, "decode",
        JS_NewCFunction(ctx, gemma_tokenizer_decode, "decode", 1));

    JS_SetClassProto(ctx, gemma_tokenizer_class_id, gemma_tokenizerProto);

    JSValue gemma_tokenizerCtor = JS_NewCFunction2(ctx, js_gemma_tokenizer_constructor, "GemmaTokenizer", 1,
                                         JS_CFUNC_constructor, 0);
    gemma_tokenizerProto = JS_GetClassProto(ctx, gemma_tokenizer_class_id);
    JS_SetPropertyStr(ctx, gemma_tokenizerCtor, "prototype", JS_DupValue(ctx, gemma_tokenizerProto));
    JS_SetPropertyStr(ctx, gemma_tokenizerProto, "constructor", JS_DupValue(ctx, gemma_tokenizerCtor));
    JS_FreeValue(ctx, gemma_tokenizerProto);

    JS_SetPropertyStr(ctx, global, "GemmaTokenizer", gemma_tokenizerCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
