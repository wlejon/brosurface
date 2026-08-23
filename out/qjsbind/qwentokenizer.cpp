#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID qwen_tokenizer_class_id = 0;

static void qwen_tokenizer_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<QwenTokenizerWrapper*>(JS_GetOpaque(val, qwen_tokenizer_class_id));
    delete w;
}

static JSClassDef qwen_tokenizer_class_def = { "QwenTokenizer", qwen_tokenizer_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue qwen_tokenizer_encode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<QwenTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, qwen_tokenizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "encode(text)");

    const char* text_cstr = JS_ToCString(ctx, argv[0]);
    if (!text_cstr) return JS_EXCEPTION;
    std::string text = text_cstr;
    JS_FreeCString(ctx, text_cstr);

    return 0;
}

static JSValue qwen_tokenizer_decode(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<QwenTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, qwen_tokenizer_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "decode(ids)");

    JSValueConst ids = argv[0];

    return JS_NewString(ctx, "1.0.0");
}

static JSValue qwen_tokenizer_apply_chat_template(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<QwenTokenizerWrapper*>(JS_GetOpaque2(ctx, this_val, qwen_tokenizer_class_id));
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

static JSValue js_qwen_tokenizer_imEndId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_qwen_tokenizer_imStartId(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installQwenTokenizer(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register QwenTokenizer class
    if (qwen_tokenizer_class_id == 0) JS_NewClassID(rt, &qwen_tokenizer_class_id);
    JS_NewClass(rt, qwen_tokenizer_class_id, &qwen_tokenizer_class_def);

    JSValue qwen_tokenizerProto = JS_NewObject(ctx);

    JSAtom qwen_tokenizer_imEndId_atom = JS_NewAtom(ctx, "imEndId");
    JS_DefinePropertyGetSet(ctx, qwen_tokenizerProto, qwen_tokenizer_imEndId_atom,
                            newGetter(ctx, js_qwen_tokenizer_imEndId, "imEndId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen_tokenizer_imEndId_atom);
    JSAtom qwen_tokenizer_imStartId_atom = JS_NewAtom(ctx, "imStartId");
    JS_DefinePropertyGetSet(ctx, qwen_tokenizerProto, qwen_tokenizer_imStartId_atom,
                            newGetter(ctx, js_qwen_tokenizer_imStartId, "imStartId"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, qwen_tokenizer_imStartId_atom);

    JS_SetPropertyStr(ctx, qwen_tokenizerProto, "encode",
        JS_NewCFunction(ctx, qwen_tokenizer_encode, "encode", 1));
    JS_SetPropertyStr(ctx, qwen_tokenizerProto, "decode",
        JS_NewCFunction(ctx, qwen_tokenizer_decode, "decode", 1));
    JS_SetPropertyStr(ctx, qwen_tokenizerProto, "applyChatTemplate",
        JS_NewCFunction(ctx, qwen_tokenizer_apply_chat_template, "applyChatTemplate", 2));

    JS_SetClassProto(ctx, qwen_tokenizer_class_id, qwen_tokenizerProto);

    JSValue qwen_tokenizerCtor = JS_NewCFunction2(ctx, js_qwen_tokenizer_constructor, "QwenTokenizer", 1,
                                         JS_CFUNC_constructor, 0);
    qwen_tokenizerProto = JS_GetClassProto(ctx, qwen_tokenizer_class_id);
    JS_SetPropertyStr(ctx, qwen_tokenizerCtor, "prototype", JS_DupValue(ctx, qwen_tokenizerProto));
    JS_SetPropertyStr(ctx, qwen_tokenizerProto, "constructor", JS_DupValue(ctx, qwen_tokenizerCtor));
    JS_FreeValue(ctx, qwen_tokenizerProto);

    JS_SetPropertyStr(ctx, global, "QwenTokenizer", qwen_tokenizerCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
