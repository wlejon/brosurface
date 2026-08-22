#include "js/lm_bindings.h"

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

static JSValue js_lm_init(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    return JS_UNDEFINED;
}

static JSValue js_lm_load_qwen(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    const char* ggufPath_cstr = JS_ToCString(ctx, argv[0]);
    if (!ggufPath_cstr) return JS_EXCEPTION;
    std::string ggufPath = ggufPath_cstr;
    JS_FreeCString(ctx, ggufPath_cstr);
    JSValueConst opts = argv[1];
    return 0;
}

static JSValue js_lm_load_mistral(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    const char* ggufPath_cstr = JS_ToCString(ctx, argv[0]);
    if (!ggufPath_cstr) return JS_EXCEPTION;
    std::string ggufPath = ggufPath_cstr;
    JS_FreeCString(ctx, ggufPath_cstr);
    JSValueConst opts = argv[1];
    return 0;
}

static JSValue js_lm_load_gemma2(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    const char* modelDir_cstr = JS_ToCString(ctx, argv[0]);
    if (!modelDir_cstr) return JS_EXCEPTION;
    std::string modelDir = modelDir_cstr;
    JS_FreeCString(ctx, modelDir_cstr);
    JSValueConst opts = argv[1];
    return 0;
}

static JSValue js_lm_load_qwen35(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    const char* checkpointDir_cstr = JS_ToCString(ctx, argv[0]);
    if (!checkpointDir_cstr) return JS_EXCEPTION;
    std::string checkpointDir = checkpointDir_cstr;
    JS_FreeCString(ctx, checkpointDir_cstr);
    JSValueConst opts = argv[1];
    return 0;
}

static JSValue js_lm_load_qwen3_vl(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    const char* checkpointDir_cstr = JS_ToCString(ctx, argv[0]);
    if (!checkpointDir_cstr) return JS_EXCEPTION;
    std::string checkpointDir = checkpointDir_cstr;
    JS_FreeCString(ctx, checkpointDir_cstr);
    JSValueConst opts = argv[1];
    return 0;
}

static JSValue js_lm_load_nllb(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    const char* checkpointDir_cstr = JS_ToCString(ctx, argv[0]);
    if (!checkpointDir_cstr) return JS_EXCEPTION;
    std::string checkpointDir = checkpointDir_cstr;
    JS_FreeCString(ctx, checkpointDir_cstr);
    JSValueConst opts = argv[1];
    return 0;
}

static JSValue js_lm_load_tokenizer(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst opts = argv[0];
    return 0;
}

static JSValue js_lm_load_clip(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst opts = argv[0];
    return 0;
}

static JSValue js_lm_load_t5(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst opts = argv[0];
    return 0;
}

static JSValue js_lm_generate(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst model = argv[0];
    JSValueConst prompt = argv[1];
    JSValueConst opts = argv[2];
    return 0;
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void LmBindings::install(JSContext* ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
        broObj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
    }

    JSValue lmObj = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, lmObj, "init",
        JS_NewCFunction(ctx, js_lm_init, "init", 0));
    JS_SetPropertyStr(ctx, lmObj, "loadQwen",
        JS_NewCFunction(ctx, js_lm_load_qwen, "loadQwen", 2));
    JS_SetPropertyStr(ctx, lmObj, "loadMistral",
        JS_NewCFunction(ctx, js_lm_load_mistral, "loadMistral", 2));
    JS_SetPropertyStr(ctx, lmObj, "loadGemma2",
        JS_NewCFunction(ctx, js_lm_load_gemma2, "loadGemma2", 2));
    JS_SetPropertyStr(ctx, lmObj, "loadQwen35",
        JS_NewCFunction(ctx, js_lm_load_qwen35, "loadQwen35", 2));
    JS_SetPropertyStr(ctx, lmObj, "loadQwen3VL",
        JS_NewCFunction(ctx, js_lm_load_qwen3_vl, "loadQwen3VL", 2));
    JS_SetPropertyStr(ctx, lmObj, "loadNllb",
        JS_NewCFunction(ctx, js_lm_load_nllb, "loadNllb", 2));
    JS_SetPropertyStr(ctx, lmObj, "loadTokenizer",
        JS_NewCFunction(ctx, js_lm_load_tokenizer, "loadTokenizer", 1));
    JS_SetPropertyStr(ctx, lmObj, "loadClip",
        JS_NewCFunction(ctx, js_lm_load_clip, "loadClip", 1));
    JS_SetPropertyStr(ctx, lmObj, "loadT5",
        JS_NewCFunction(ctx, js_lm_load_t5, "loadT5", 1));
    JS_SetPropertyStr(ctx, lmObj, "generate",
        JS_NewCFunction(ctx, js_lm_generate, "generate", 3));

    JS_SetPropertyStr(ctx, broObj, "lm", lmObj);
    JS_FreeValue(ctx, broObj);
    JS_FreeValue(ctx, global);
}

} // namespace bro::js
