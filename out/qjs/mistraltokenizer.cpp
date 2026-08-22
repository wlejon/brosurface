#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID mistral_tokenizer_class_id = 0;

static void mistral_tokenizer_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<MistralTokenizerWrapper*>(JS_GetOpaque(val, mistral_tokenizer_class_id));
    delete w;
}

static JSClassDef mistral_tokenizer_class_def = { "MistralTokenizer", mistral_tokenizer_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue mistral_tokenizer_encode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<MistralTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, mistral_tokenizer_class_id));
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

static JSValue mistral_tokenizer_decode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<MistralTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, mistral_tokenizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "decode(ids)");

    JSValueConst ids = argv[0];

    return JS_NewString(ctx, "1.0.0");
}

static JSValue mistral_tokenizer_apply_chat_template(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<MistralTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, mistral_tokenizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "applyChatTemplate(messages, addGenerationPrompt)");

    JSValueConst messages = argv[0];
    bool addGenerationPrompt = false;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        addGenerationPrompt = JS_ToBool(ctx, argv[1]) > 0;
    }

    return JS_NewString(ctx, "1.0.0");
}

static JSValue js_mistral_tokenizer_eosId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_mistral_tokenizer_bosId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_mistral_tokenizer_vocabCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installMistralTokenizer(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register MistralTokenizer class
    if (mistral_tokenizer_class_id == 0) JS_NewClassID(rt, &mistral_tokenizer_class_id);
    JS_NewClass(rt, mistral_tokenizer_class_id, &mistral_tokenizer_class_def);

    JSValue mistral_tokenizerProto = JS_NewObject(ctx);

    JSAtom mistral_tokenizer_eosId_atom = JS_NewAtom(ctx, "eosId");
    JS_DefinePropertyGetSet(ctx, mistral_tokenizerProto, mistral_tokenizer_eosId_atom,
                            newGetter(ctx, js_mistral_tokenizer_eosId, "eosId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, mistral_tokenizer_eosId_atom);
    JSAtom mistral_tokenizer_bosId_atom = JS_NewAtom(ctx, "bosId");
    JS_DefinePropertyGetSet(ctx, mistral_tokenizerProto, mistral_tokenizer_bosId_atom,
                            newGetter(ctx, js_mistral_tokenizer_bosId, "bosId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, mistral_tokenizer_bosId_atom);
    JSAtom mistral_tokenizer_vocabCount_atom = JS_NewAtom(ctx, "vocabCount");
    JS_DefinePropertyGetSet(ctx, mistral_tokenizerProto, mistral_tokenizer_vocabCount_atom,
                            newGetter(ctx, js_mistral_tokenizer_vocabCount, "vocabCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, mistral_tokenizer_vocabCount_atom);

    JS_SetPropertyStr(ctx, mistral_tokenizerProto, "encode",
        JS_NewCFunction(ctx, mistral_tokenizer_encode, "encode", 2));
    JS_SetPropertyStr(ctx, mistral_tokenizerProto, "decode",
        JS_NewCFunction(ctx, mistral_tokenizer_decode, "decode", 1));
    JS_SetPropertyStr(ctx, mistral_tokenizerProto, "applyChatTemplate",
        JS_NewCFunction(ctx, mistral_tokenizer_apply_chat_template, "applyChatTemplate", 2));

    JS_SetClassProto(ctx, mistral_tokenizer_class_id, mistral_tokenizerProto);

    JSValue mistral_tokenizerCtor = JS_NewCFunction2(ctx, js_mistral_tokenizer_constructor, "MistralTokenizer", 1,
                                         JS_CFUNC_constructor, 0);
    mistral_tokenizerProto = JS_GetClassProto(ctx, mistral_tokenizer_class_id);
    JS_SetPropertyStr(ctx, mistral_tokenizerCtor, "prototype", JS_DupValue(ctx, mistral_tokenizerProto));
    JS_SetPropertyStr(ctx, mistral_tokenizerProto, "constructor", JS_DupValue(ctx, mistral_tokenizerCtor));
    JS_FreeValue(ctx, mistral_tokenizerProto);

    JS_SetPropertyStr(ctx, global, "MistralTokenizer", mistral_tokenizerCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
