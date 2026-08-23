#include "js/vendor_globals_bindings.h"

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

static JSValue js_vendor_globals_get_signals(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

static JSValue js_vendor_globals_get_code_mirror(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

static JSValue js_vendor_globals_get_acorn(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

static JSValue js_vendor_globals_get_tern(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

static JSValue js_vendor_globals_get_esprima(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

static JSValue js_vendor_globals_get_jsonlint(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

static JSValue js_vendor_globals_get_draco_encoder(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    return 0;
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void VendorGlobalsBindings::install(JSContext* ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
        broObj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
    }

    JSValue vendor_globalsObj = JS_NewObject(ctx);

    auto defineGetSet = [&](const char* name, JSCFunction* getter,
                            JSCFunction* setter) {
        JSAtom atom = JS_NewAtom(ctx, name);
        JS_DefinePropertyGetSet(ctx, vendor_globalsObj, atom,
            JS_NewCFunction(ctx, getter, name, 0),
            setter ? JS_NewCFunction(ctx, setter, name, 1) : JS_UNDEFINED,
            JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE);
        JS_FreeAtom(ctx, atom);
    };
    defineGetSet("signals",  js_vendor_globals_get_signals,  nullptr);
    defineGetSet("CodeMirror",  js_vendor_globals_get_code_mirror,  nullptr);
    defineGetSet("acorn",  js_vendor_globals_get_acorn,  nullptr);
    defineGetSet("tern",  js_vendor_globals_get_tern,  nullptr);
    defineGetSet("esprima",  js_vendor_globals_get_esprima,  nullptr);
    defineGetSet("jsonlint",  js_vendor_globals_get_jsonlint,  nullptr);
    defineGetSet("draco_encoder",  js_vendor_globals_get_draco_encoder,  nullptr);

    JS_SetPropertyStr(ctx, broObj, "vendor_globals", vendor_globalsObj);
    JS_FreeValue(ctx, broObj);
    JS_FreeValue(ctx, global);
}


} // namespace bro::js
