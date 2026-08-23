#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID url_class_id = 0;

static void url_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<URLWrapper*>(JS_GetOpaque(val, url_class_id));
    delete w;
}

static JSClassDef url_class_def = { "URL", url_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue url_to_json(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLWrapper*>(JS_GetOpaque2(ctx, this_val, url_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewString(ctx, "1.0.0");
}

static JSValue url_to_string(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLWrapper*>(JS_GetOpaque2(ctx, this_val, url_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewString(ctx, "1.0.0");
}

static JSValue url_create_object_url(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "createObjectURL(obj)");

    JSValueConst obj = argv[0];

    return JS_NewString(ctx, "1.0.0");
}

static JSValue url_revoke_object_url(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "revokeObjectURL(url)");

    const char* url_cstr = JS_ToCString(ctx, argv[0]);
    if (!url_cstr) return JS_EXCEPTION;
    std::string url = url_cstr;
    JS_FreeCString(ctx, url_cstr);

    return JS_UNDEFINED;
}

static JSValue url_parse(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "parse(url, base)");

    const char* url_cstr = JS_ToCString(ctx, argv[0]);
    if (!url_cstr) return JS_EXCEPTION;
    std::string url = url_cstr;
    JS_FreeCString(ctx, url_cstr);
    std::string base = "";
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char* base_cstr = JS_ToCString(ctx, argv[1]);
        if (!base_cstr) return JS_EXCEPTION;
        base = base_cstr;
        JS_FreeCString(ctx, base_cstr);
    }

    return 0;
}

static JSValue js_url_href(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_origin(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_protocol(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_host(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_hostname(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_port(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_pathname(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_search(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_searchParams(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_url_hash(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_url_constructor(JSContext* ctx, JSValueConst new_target,
                                    int argc, JSValueConst* argv)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(proto)) return proto;
    JSValue obj = JS_NewObjectProtoClass(ctx, proto, url_class_id);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installURL(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register URL class
    if (url_class_id == 0) JS_NewClassID(rt, &url_class_id);
    JS_NewClass(rt, url_class_id, &url_class_def);

    JSValue urlProto = JS_NewObject(ctx);

    JSAtom url_href_atom = JS_NewAtom(ctx, "href");
    JS_DefinePropertyGetSet(ctx, urlProto, url_href_atom,
                            newGetter(ctx, js_url_href, "href"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_href_atom);
    JSAtom url_origin_atom = JS_NewAtom(ctx, "origin");
    JS_DefinePropertyGetSet(ctx, urlProto, url_origin_atom,
                            newGetter(ctx, js_url_origin, "origin"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_origin_atom);
    JSAtom url_protocol_atom = JS_NewAtom(ctx, "protocol");
    JS_DefinePropertyGetSet(ctx, urlProto, url_protocol_atom,
                            newGetter(ctx, js_url_protocol, "protocol"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_protocol_atom);
    JSAtom url_host_atom = JS_NewAtom(ctx, "host");
    JS_DefinePropertyGetSet(ctx, urlProto, url_host_atom,
                            newGetter(ctx, js_url_host, "host"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_host_atom);
    JSAtom url_hostname_atom = JS_NewAtom(ctx, "hostname");
    JS_DefinePropertyGetSet(ctx, urlProto, url_hostname_atom,
                            newGetter(ctx, js_url_hostname, "hostname"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_hostname_atom);
    JSAtom url_port_atom = JS_NewAtom(ctx, "port");
    JS_DefinePropertyGetSet(ctx, urlProto, url_port_atom,
                            newGetter(ctx, js_url_port, "port"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_port_atom);
    JSAtom url_pathname_atom = JS_NewAtom(ctx, "pathname");
    JS_DefinePropertyGetSet(ctx, urlProto, url_pathname_atom,
                            newGetter(ctx, js_url_pathname, "pathname"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_pathname_atom);
    JSAtom url_search_atom = JS_NewAtom(ctx, "search");
    JS_DefinePropertyGetSet(ctx, urlProto, url_search_atom,
                            newGetter(ctx, js_url_search, "search"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_search_atom);
    JSAtom url_searchParams_atom = JS_NewAtom(ctx, "searchParams");
    JS_DefinePropertyGetSet(ctx, urlProto, url_searchParams_atom,
                            newGetter(ctx, js_url_searchParams, "searchParams"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_searchParams_atom);
    JSAtom url_hash_atom = JS_NewAtom(ctx, "hash");
    JS_DefinePropertyGetSet(ctx, urlProto, url_hash_atom,
                            newGetter(ctx, js_url_hash, "hash"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, url_hash_atom);

    JS_SetPropertyStr(ctx, urlProto, "toJSON",
        JS_NewCFunction(ctx, url_to_json, "toJSON", 0));
    JS_SetPropertyStr(ctx, urlProto, "toString",
        JS_NewCFunction(ctx, url_to_string, "toString", 0));

    JS_SetClassProto(ctx, url_class_id, urlProto);

    JSValue urlCtor = JS_NewCFunction2(ctx, js_url_constructor, "URL", 2,
                                         JS_CFUNC_constructor, 0);
    urlProto = JS_GetClassProto(ctx, url_class_id);
    JS_SetPropertyStr(ctx, urlCtor, "prototype", JS_DupValue(ctx, urlProto));
    JS_SetPropertyStr(ctx, urlProto, "constructor", JS_DupValue(ctx, urlCtor));
    JS_FreeValue(ctx, urlProto);

    JS_SetPropertyStr(ctx, urlCtor, "createObjectURL",
        JS_NewCFunction(ctx, url_create_object_url, "createObjectURL", 1));
    JS_SetPropertyStr(ctx, urlCtor, "revokeObjectURL",
        JS_NewCFunction(ctx, url_revoke_object_url, "revokeObjectURL", 1));
    JS_SetPropertyStr(ctx, urlCtor, "parse",
        JS_NewCFunction(ctx, url_parse, "parse", 2));

    JS_SetPropertyStr(ctx, global, "URL", urlCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
