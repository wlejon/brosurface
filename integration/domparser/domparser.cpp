#include "js/dom_bindings.h"
#include "dom/document.h"
#include "util/string_utils.h"
#include <string>

namespace bro::js {

static JSValue js_domparser_parseFromString(JSContext* ctx, JSValueConst,
                                            int argc, JSValueConst* argv)
{
    std::string html = argc >= 1 ? jsToStdString(ctx, argv[0]) : std::string();
    auto* doc = new bro::dom::Document();
    doc->parse(html);
    return wrapDetachedDocument(ctx, doc);
}

static JSValue js_domparser_ctor(JSContext* ctx, JSValueConst new_target,
                                 int, JSValueConst*)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    JSValue obj = JS_IsObject(proto) ? JS_NewObjectProto(ctx, proto)
                                     : JS_NewObject(ctx);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installDOMParser(JSContext* ctx)
{
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, proto, "parseFromString", JS_NewCFunction(ctx, js_domparser_parseFromString, "parseFromString", 2));
    JSValue ctor = JS_NewCFunction2(ctx, js_domparser_ctor, "DOMParser", 0, JS_CFUNC_constructor, 0);
    JS_SetConstructor(ctx, ctor, proto);
    JS_FreeValue(ctx, proto);
    JSValue global = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, global, "DOMParser", ctor);
    JS_FreeValue(ctx, global);
}

} // namespace bro::js
