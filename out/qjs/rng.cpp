#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID rng_class_id = 0;

static void rng_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque(val, rng_class_id));
    delete w;
}

static JSClassDef rng_class_def = { "Rng", rng_finalizer };

static JSValue rng_reseed(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "reseed(seed)");

    double seed;
    if (JS_ToFloat64(ctx, &seed, argv[0])) return JS_EXCEPTION;

    return 0;
}

static JSValue rng_float01(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue rng_signed(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue rng_range(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "range(lo, hi)");

    double lo;
    if (JS_ToFloat64(ctx, &lo, argv[0])) return JS_EXCEPTION;
    double hi;
    if (JS_ToFloat64(ctx, &hi, argv[1])) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue rng_int(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "_int(lo, hi)");

    int32_t lo;
    if (JS_ToInt32(ctx, &lo, argv[0])) return JS_EXCEPTION;
    int32_t hi;
    if (JS_ToInt32(ctx, &hi, argv[1])) return JS_EXCEPTION;

    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue rng_uint32(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue rng_normal(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue rng_gaussian2_d(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "gaussian2D(sigma)");

    double sigma;
    if (JS_ToFloat64(ctx, &sigma, argv[0])) return JS_EXCEPTION;

    return 0;
}

static JSValue rng_in_unit_disc(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue rng_in_unit_sphere(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue rng_on_unit_sphere(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<RngWrapper*>(JS_GetOpaque2(ctx, this_val, rng_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue js_rng_constructor(JSContext* ctx, JSValueConst new_target,
                                    int argc, JSValueConst* argv)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(proto)) return proto;
    JSValue obj = JS_NewObjectProtoClass(ctx, proto, rng_class_id);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installRng(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register Rng class
    if (rng_class_id == 0) JS_NewClassID(rt, &rng_class_id);
    JS_NewClass(rt, rng_class_id, &rng_class_def);

    JSValue rngProto = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, rngProto, "reseed",
        JS_NewCFunction(ctx, rng_reseed, "reseed", 1));
    JS_SetPropertyStr(ctx, rngProto, "float01",
        JS_NewCFunction(ctx, rng_float01, "float01", 0));
    JS_SetPropertyStr(ctx, rngProto, "signed",
        JS_NewCFunction(ctx, rng_signed, "signed", 0));
    JS_SetPropertyStr(ctx, rngProto, "range",
        JS_NewCFunction(ctx, rng_range, "range", 2));
    JS_SetPropertyStr(ctx, rngProto, "_int",
        JS_NewCFunction(ctx, rng_int, "_int", 2));
    JS_SetPropertyStr(ctx, rngProto, "uint32",
        JS_NewCFunction(ctx, rng_uint32, "uint32", 0));
    JS_SetPropertyStr(ctx, rngProto, "normal",
        JS_NewCFunction(ctx, rng_normal, "normal", 0));
    JS_SetPropertyStr(ctx, rngProto, "gaussian2D",
        JS_NewCFunction(ctx, rng_gaussian2_d, "gaussian2D", 1));
    JS_SetPropertyStr(ctx, rngProto, "inUnitDisc",
        JS_NewCFunction(ctx, rng_in_unit_disc, "inUnitDisc", 0));
    JS_SetPropertyStr(ctx, rngProto, "inUnitSphere",
        JS_NewCFunction(ctx, rng_in_unit_sphere, "inUnitSphere", 0));
    JS_SetPropertyStr(ctx, rngProto, "onUnitSphere",
        JS_NewCFunction(ctx, rng_on_unit_sphere, "onUnitSphere", 0));

    JS_SetClassProto(ctx, rng_class_id, rngProto);

    JSValue rngCtor = JS_NewCFunction2(ctx, js_rng_constructor, "Rng", 1,
                                         JS_CFUNC_constructor, 0);
    rngProto = JS_GetClassProto(ctx, rng_class_id);
    JS_SetPropertyStr(ctx, rngCtor, "prototype", JS_DupValue(ctx, rngProto));
    JS_SetPropertyStr(ctx, rngProto, "constructor", JS_DupValue(ctx, rngCtor));
    JS_FreeValue(ctx, rngProto);

    JS_SetPropertyStr(ctx, global, "Rng", rngCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
