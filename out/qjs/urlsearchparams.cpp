#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID url_search_params_class_id = 0;

static void url_search_params_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque(val, url_search_params_class_id));
    delete w;
}

static JSClassDef url_search_params_class_def = { "URLSearchParams", url_search_params_finalizer };

static JSValue url_search_params_append(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "append(name, value)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);
    const char* value_cstr = JS_ToCString(ctx, argv[1]);
    if (!value_cstr) return JS_EXCEPTION;
    std::string value = value_cstr;
    JS_FreeCString(ctx, value_cstr);

    return JS_UNDEFINED;
}

static JSValue url_search_params_delete(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "delete(name)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);

    return JS_UNDEFINED;
}

static JSValue url_search_params_get(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "get(name)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);

    return JS_NewString(ctx, "FastNoise2 v0.10.0-alpha");
}

static JSValue url_search_params_get_all(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "getAll(name)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);

    return 0;
}

static JSValue url_search_params_has(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "has(name)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);

    return JS_NewBool(ctx, 0);
}

static JSValue url_search_params_set(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "set(name, value)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);
    const char* value_cstr = JS_ToCString(ctx, argv[1]);
    if (!value_cstr) return JS_EXCEPTION;
    std::string value = value_cstr;
    JS_FreeCString(ctx, value_cstr);

    return JS_UNDEFINED;
}

static JSValue url_search_params_to_string(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<URLSearchParamsWrapper*>(JS_GetOpaque2(ctx, this_val, url_search_params_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewString(ctx, "FastNoise2 v0.10.0-alpha");
}

static JSValue js_url_search_params_constructor(JSContext* ctx, JSValueConst new_target,
                                    int argc, JSValueConst* argv)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(proto)) return proto;
    JSValue obj = JS_NewObjectProtoClass(ctx, proto, url_search_params_class_id);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installURLSearchParams(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register URLSearchParams class
    if (url_search_params_class_id == 0) JS_NewClassID(rt, &url_search_params_class_id);
    JS_NewClass(rt, url_search_params_class_id, &url_search_params_class_def);

    JSValue url_search_paramsProto = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, url_search_paramsProto, "append",
        JS_NewCFunction(ctx, url_search_params_append, "append", 2));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "delete",
        JS_NewCFunction(ctx, url_search_params_delete, "delete", 1));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "get",
        JS_NewCFunction(ctx, url_search_params_get, "get", 1));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "getAll",
        JS_NewCFunction(ctx, url_search_params_get_all, "getAll", 1));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "has",
        JS_NewCFunction(ctx, url_search_params_has, "has", 1));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "set",
        JS_NewCFunction(ctx, url_search_params_set, "set", 2));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "toString",
        JS_NewCFunction(ctx, url_search_params_to_string, "toString", 0));

    JS_SetClassProto(ctx, url_search_params_class_id, url_search_paramsProto);

    JSValue url_search_paramsCtor = JS_NewCFunction2(ctx, js_url_search_params_constructor, "URLSearchParams", 1,
                                         JS_CFUNC_constructor, 0);
    url_search_paramsProto = JS_GetClassProto(ctx, url_search_params_class_id);
    JS_SetPropertyStr(ctx, url_search_paramsCtor, "prototype", JS_DupValue(ctx, url_search_paramsProto));
    JS_SetPropertyStr(ctx, url_search_paramsProto, "constructor", JS_DupValue(ctx, url_search_paramsCtor));
    JS_FreeValue(ctx, url_search_paramsProto);

    JS_SetPropertyStr(ctx, global, "URLSearchParams", url_search_paramsCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
