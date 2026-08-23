#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID smoother_class_id = 0;

static void smoother_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<SmootherWrapper*>(JS_GetOpaque(val, smoother_class_id));
    delete w;
}

static JSClassDef smoother_class_def = { "Smoother", smoother_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue smoother_set_time(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SmootherWrapper*>(JS_GetOpaque2(ctx, this_val, smoother_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "setTime(timeMs, sampleRate)");

    double timeMs;
    if (JS_ToFloat64(ctx, &timeMs, argv[0])) return JS_EXCEPTION;
    double sampleRate;
    if (JS_ToFloat64(ctx, &sampleRate, argv[1])) return JS_EXCEPTION;

    return 0;
}

static JSValue smoother_reset(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SmootherWrapper*>(JS_GetOpaque2(ctx, this_val, smoother_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "reset(value)");

    double value;
    if (JS_ToFloat64(ctx, &value, argv[0])) return JS_EXCEPTION;

    return 0;
}

static JSValue smoother_set_target(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SmootherWrapper*>(JS_GetOpaque2(ctx, this_val, smoother_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "setTarget(t)");

    double t;
    if (JS_ToFloat64(ctx, &t, argv[0])) return JS_EXCEPTION;

    return 0;
}

static JSValue smoother_tick(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SmootherWrapper*>(JS_GetOpaque2(ctx, this_val, smoother_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue smoother_tick_n(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SmootherWrapper*>(JS_GetOpaque2(ctx, this_val, smoother_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "tickN(n)");

    int32_t n;
    if (JS_ToInt32(ctx, &n, argv[0])) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_smoother_current(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_smoother_target(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_smoother_coeff(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_smoother_constructor(JSContext* ctx, JSValueConst new_target,
                                    int argc, JSValueConst* argv)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(proto)) return proto;
    JSValue obj = JS_NewObjectProtoClass(ctx, proto, smoother_class_id);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installSmoother(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register Smoother class
    if (smoother_class_id == 0) JS_NewClassID(rt, &smoother_class_id);
    JS_NewClass(rt, smoother_class_id, &smoother_class_def);

    JSValue smootherProto = JS_NewObject(ctx);

    JSAtom smoother_current_atom = JS_NewAtom(ctx, "current");
    JS_DefinePropertyGetSet(ctx, smootherProto, smoother_current_atom,
                            newGetter(ctx, js_smoother_current, "current"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, smoother_current_atom);
    JSAtom smoother_target_atom = JS_NewAtom(ctx, "target");
    JS_DefinePropertyGetSet(ctx, smootherProto, smoother_target_atom,
                            newGetter(ctx, js_smoother_target, "target"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, smoother_target_atom);
    JSAtom smoother_coeff_atom = JS_NewAtom(ctx, "coeff");
    JS_DefinePropertyGetSet(ctx, smootherProto, smoother_coeff_atom,
                            newGetter(ctx, js_smoother_coeff, "coeff"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, smoother_coeff_atom);

    JS_SetPropertyStr(ctx, smootherProto, "setTime",
        JS_NewCFunction(ctx, smoother_set_time, "setTime", 2));
    JS_SetPropertyStr(ctx, smootherProto, "reset",
        JS_NewCFunction(ctx, smoother_reset, "reset", 1));
    JS_SetPropertyStr(ctx, smootherProto, "setTarget",
        JS_NewCFunction(ctx, smoother_set_target, "setTarget", 1));
    JS_SetPropertyStr(ctx, smootherProto, "tick",
        JS_NewCFunction(ctx, smoother_tick, "tick", 0));
    JS_SetPropertyStr(ctx, smootherProto, "tickN",
        JS_NewCFunction(ctx, smoother_tick_n, "tickN", 1));

    JS_SetClassProto(ctx, smoother_class_id, smootherProto);

    JSValue smootherCtor = JS_NewCFunction2(ctx, js_smoother_constructor, "Smoother", 2,
                                         JS_CFUNC_constructor, 0);
    smootherProto = JS_GetClassProto(ctx, smoother_class_id);
    JS_SetPropertyStr(ctx, smootherCtor, "prototype", JS_DupValue(ctx, smootherProto));
    JS_SetPropertyStr(ctx, smootherProto, "constructor", JS_DupValue(ctx, smootherCtor));
    JS_FreeValue(ctx, smootherProto);

    JS_SetPropertyStr(ctx, global, "Smoother", smootherCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
