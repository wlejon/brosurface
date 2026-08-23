#include "js/intl_bindings.h"

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

static JSValue js_Intl_get_canonical_locales(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst locales = argv[0];
    return 0;
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void IntlBindings::install(JSContext* ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
        broObj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
    }

    JSValue IntlObj = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, IntlObj, "getCanonicalLocales",
        JS_NewCFunction(ctx, js_Intl_get_canonical_locales, "getCanonicalLocales", 1));

    JS_SetPropertyStr(ctx, broObj, "Intl", IntlObj);
    JS_FreeValue(ctx, broObj);
    JS_FreeValue(ctx, global);
}


} // namespace bro::js
