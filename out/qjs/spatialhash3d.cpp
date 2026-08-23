#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID spatial_hash3_d_class_id = 0;

static void spatial_hash3_d_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<SpatialHashWrapper*>(JS_GetOpaque(val, spatial_hash3_d_class_id));
    delete w;
}

static JSClassDef spatial_hash3_d_class_def = { "SpatialHash3D", spatial_hash3_d_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue spatial_hash3_d_insert(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SpatialHash3DWrapper*>(JS_GetOpaque2(ctx, this_val, spatial_hash3_d_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "insert(id, x, y, z)");

    double id;
    if (JS_ToFloat64(ctx, &id, argv[0])) return JS_EXCEPTION;
    double x;
    if (JS_ToFloat64(ctx, &x, argv[1])) return JS_EXCEPTION;
    double y;
    if (JS_ToFloat64(ctx, &y, argv[2])) return JS_EXCEPTION;
    double z;
    if (JS_ToFloat64(ctx, &z, argv[3])) return JS_EXCEPTION;

    return 0;
}

static JSValue spatial_hash3_d_remove(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SpatialHash3DWrapper*>(JS_GetOpaque2(ctx, this_val, spatial_hash3_d_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "remove(id, x, y, z)");

    double id;
    if (JS_ToFloat64(ctx, &id, argv[0])) return JS_EXCEPTION;
    double x;
    if (JS_ToFloat64(ctx, &x, argv[1])) return JS_EXCEPTION;
    double y;
    if (JS_ToFloat64(ctx, &y, argv[2])) return JS_EXCEPTION;
    double z;
    if (JS_ToFloat64(ctx, &z, argv[3])) return JS_EXCEPTION;

    return JS_NewBool(ctx, 0);
}

static JSValue spatial_hash3_d_query_radius(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SpatialHash3DWrapper*>(JS_GetOpaque2(ctx, this_val, spatial_hash3_d_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "queryRadius(x, y, z, radius)");

    double x;
    if (JS_ToFloat64(ctx, &x, argv[0])) return JS_EXCEPTION;
    double y;
    if (JS_ToFloat64(ctx, &y, argv[1])) return JS_EXCEPTION;
    double z;
    if (JS_ToFloat64(ctx, &z, argv[2])) return JS_EXCEPTION;
    double radius;
    if (JS_ToFloat64(ctx, &radius, argv[3])) return JS_EXCEPTION;

    return 0;
}

static JSValue spatial_hash3_d_query_aabb(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SpatialHash3DWrapper*>(JS_GetOpaque2(ctx, this_val, spatial_hash3_d_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 6)
        return JS_ThrowTypeError(ctx, "queryAABB(minX, minY, minZ, maxX, maxY, maxZ)");

    double minX;
    if (JS_ToFloat64(ctx, &minX, argv[0])) return JS_EXCEPTION;
    double minY;
    if (JS_ToFloat64(ctx, &minY, argv[1])) return JS_EXCEPTION;
    double minZ;
    if (JS_ToFloat64(ctx, &minZ, argv[2])) return JS_EXCEPTION;
    double maxX;
    if (JS_ToFloat64(ctx, &maxX, argv[3])) return JS_EXCEPTION;
    double maxY;
    if (JS_ToFloat64(ctx, &maxY, argv[4])) return JS_EXCEPTION;
    double maxZ;
    if (JS_ToFloat64(ctx, &maxZ, argv[5])) return JS_EXCEPTION;

    return 0;
}

static JSValue spatial_hash3_d_nearest(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SpatialHash3DWrapper*>(JS_GetOpaque2(ctx, this_val, spatial_hash3_d_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "nearest(x, y, z, maxDist)");

    double x;
    if (JS_ToFloat64(ctx, &x, argv[0])) return JS_EXCEPTION;
    double y;
    if (JS_ToFloat64(ctx, &y, argv[1])) return JS_EXCEPTION;
    double z;
    if (JS_ToFloat64(ctx, &z, argv[2])) return JS_EXCEPTION;
    double maxDist;
    if (JS_ToFloat64(ctx, &maxDist, argv[3])) return JS_EXCEPTION;

    return 0;
}

static JSValue spatial_hash3_d_clear(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<SpatialHash3DWrapper*>(JS_GetOpaque2(ctx, this_val, spatial_hash3_d_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue js_spatial_hash3_d_size(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_spatial_hash3_d_constructor(JSContext* ctx, JSValueConst new_target,
                                    int argc, JSValueConst* argv)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(proto)) return proto;
    JSValue obj = JS_NewObjectProtoClass(ctx, proto, spatial_hash3_d_class_id);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installSpatialHash3D(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register SpatialHash3D class
    if (spatial_hash3_d_class_id == 0) JS_NewClassID(rt, &spatial_hash3_d_class_id);
    JS_NewClass(rt, spatial_hash3_d_class_id, &spatial_hash3_d_class_def);

    JSValue spatial_hash3_dProto = JS_NewObject(ctx);

    JSAtom spatial_hash3_d_size_atom = JS_NewAtom(ctx, "size");
    JS_DefinePropertyGetSet(ctx, spatial_hash3_dProto, spatial_hash3_d_size_atom,
                            newGetter(ctx, js_spatial_hash3_d_size, "size"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, spatial_hash3_d_size_atom);

    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "insert",
        JS_NewCFunction(ctx, spatial_hash3_d_insert, "insert", 4));
    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "remove",
        JS_NewCFunction(ctx, spatial_hash3_d_remove, "remove", 4));
    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "queryRadius",
        JS_NewCFunction(ctx, spatial_hash3_d_query_radius, "queryRadius", 4));
    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "queryAABB",
        JS_NewCFunction(ctx, spatial_hash3_d_query_aabb, "queryAABB", 6));
    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "nearest",
        JS_NewCFunction(ctx, spatial_hash3_d_nearest, "nearest", 4));
    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "clear",
        JS_NewCFunction(ctx, spatial_hash3_d_clear, "clear", 0));

    JS_SetClassProto(ctx, spatial_hash3_d_class_id, spatial_hash3_dProto);

    JSValue spatial_hash3_dCtor = JS_NewCFunction2(ctx, js_spatial_hash3_d_constructor, "SpatialHash3D", 2,
                                         JS_CFUNC_constructor, 0);
    spatial_hash3_dProto = JS_GetClassProto(ctx, spatial_hash3_d_class_id);
    JS_SetPropertyStr(ctx, spatial_hash3_dCtor, "prototype", JS_DupValue(ctx, spatial_hash3_dProto));
    JS_SetPropertyStr(ctx, spatial_hash3_dProto, "constructor", JS_DupValue(ctx, spatial_hash3_dCtor));
    JS_FreeValue(ctx, spatial_hash3_dProto);

    JS_SetPropertyStr(ctx, global, "SpatialHash3D", spatial_hash3_dCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
