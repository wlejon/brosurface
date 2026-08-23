#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID flora_world_class_id = 0;

static void flora_world_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque(val, flora_world_class_id));
    delete w;
}

static JSClassDef flora_world_class_def = { "FloraWorld", flora_world_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue flora_world_add_prototype(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "addPrototype(spec)");

    JSValueConst spec = argv[0];

    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue flora_world_add_voronoi_site(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "addVoronoiSite(prototypeIndex, determinacy, apicalControl)");

    int32_t prototypeIndex;
    if (JS_ToInt32(ctx, &prototypeIndex, argv[0])) return JS_EXCEPTION;
    double determinacy = 1;
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        if (JS_ToFloat64(ctx, &determinacy, argv[1])) return JS_EXCEPTION;
    }
    double apicalControl = 0.5;
    if (argc > 2 && !JS_IsUndefined(argv[2])) {
        if (JS_ToFloat64(ctx, &apicalControl, argv[2])) return JS_EXCEPTION;
    }

    return 0;
}

static JSValue flora_world_add_plant(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "addPlant(spec)");

    JSValueConst spec = argv[0];

    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue flora_world_remove_plant(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "removePlant(plantIdx)");

    int32_t plantIdx;
    if (JS_ToInt32(ctx, &plantIdx, argv[0])) return JS_EXCEPTION;

    return JS_NewBool(ctx, 0);
}

static JSValue flora_world_step(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "step(dt)");

    double dt;
    if (JS_ToFloat64(ctx, &dt, argv[0])) return JS_EXCEPTION;

    return 0;
}

static JSValue flora_world_plant_info(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "plantInfo(plantIdx)");

    int32_t plantIdx;
    if (JS_ToInt32(ctx, &plantIdx, argv[0])) return JS_EXCEPTION;

    return 0;
}

static JSValue flora_world_set_climate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "setClimate(opts)");

    JSValueConst opts = argv[0];

    return 0;
}

static JSValue flora_world_sample_shadow(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "sampleShadow(pos)");

    JSValueConst pos = argv[0];

    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue flora_world_validate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_NewString(ctx, "1.0.0");
}

static JSValue flora_world_emit_mesh(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;
    int32_t sides = 6;
    if (argc > 0 && !JS_IsUndefined(argv[0])) {
        if (JS_ToInt32(ctx, &sides, argv[0])) return JS_EXCEPTION;
    }

    return 0;
}

static JSValue flora_world_emit_segments(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue flora_world_emit_foliage(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue flora_world_emit_bloom_anchors(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FloraWorldWrapper*>(JS_GetOpaque2(ctx, this_val, flora_world_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue js_flora_world_simTime(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_flora_world_plantCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_flora_world_prototypeCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_flora_world_moduleCount(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

void installFloraWorld(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register FloraWorld class
    if (flora_world_class_id == 0) JS_NewClassID(rt, &flora_world_class_id);
    JS_NewClass(rt, flora_world_class_id, &flora_world_class_def);

    JSValue flora_worldProto = JS_NewObject(ctx);

    JSAtom flora_world_simTime_atom = JS_NewAtom(ctx, "simTime");
    JS_DefinePropertyGetSet(ctx, flora_worldProto, flora_world_simTime_atom,
                            newGetter(ctx, js_flora_world_simTime, "simTime"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, flora_world_simTime_atom);
    JSAtom flora_world_plantCount_atom = JS_NewAtom(ctx, "plantCount");
    JS_DefinePropertyGetSet(ctx, flora_worldProto, flora_world_plantCount_atom,
                            newGetter(ctx, js_flora_world_plantCount, "plantCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, flora_world_plantCount_atom);
    JSAtom flora_world_prototypeCount_atom = JS_NewAtom(ctx, "prototypeCount");
    JS_DefinePropertyGetSet(ctx, flora_worldProto, flora_world_prototypeCount_atom,
                            newGetter(ctx, js_flora_world_prototypeCount, "prototypeCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, flora_world_prototypeCount_atom);
    JSAtom flora_world_moduleCount_atom = JS_NewAtom(ctx, "moduleCount");
    JS_DefinePropertyGetSet(ctx, flora_worldProto, flora_world_moduleCount_atom,
                            newGetter(ctx, js_flora_world_moduleCount, "moduleCount"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, flora_world_moduleCount_atom);

    JS_SetPropertyStr(ctx, flora_worldProto, "addPrototype",
        JS_NewCFunction(ctx, flora_world_add_prototype, "addPrototype", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "addVoronoiSite",
        JS_NewCFunction(ctx, flora_world_add_voronoi_site, "addVoronoiSite", 3));
    JS_SetPropertyStr(ctx, flora_worldProto, "addPlant",
        JS_NewCFunction(ctx, flora_world_add_plant, "addPlant", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "removePlant",
        JS_NewCFunction(ctx, flora_world_remove_plant, "removePlant", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "step",
        JS_NewCFunction(ctx, flora_world_step, "step", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "plantInfo",
        JS_NewCFunction(ctx, flora_world_plant_info, "plantInfo", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "setClimate",
        JS_NewCFunction(ctx, flora_world_set_climate, "setClimate", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "sampleShadow",
        JS_NewCFunction(ctx, flora_world_sample_shadow, "sampleShadow", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "validate",
        JS_NewCFunction(ctx, flora_world_validate, "validate", 0));
    JS_SetPropertyStr(ctx, flora_worldProto, "emitMesh",
        JS_NewCFunction(ctx, flora_world_emit_mesh, "emitMesh", 1));
    JS_SetPropertyStr(ctx, flora_worldProto, "emitSegments",
        JS_NewCFunction(ctx, flora_world_emit_segments, "emitSegments", 0));
    JS_SetPropertyStr(ctx, flora_worldProto, "emitFoliage",
        JS_NewCFunction(ctx, flora_world_emit_foliage, "emitFoliage", 0));
    JS_SetPropertyStr(ctx, flora_worldProto, "emitBloomAnchors",
        JS_NewCFunction(ctx, flora_world_emit_bloom_anchors, "emitBloomAnchors", 0));

    JS_SetClassProto(ctx, flora_world_class_id, flora_worldProto);

    JSValue flora_worldCtor = JS_NewCFunction2(ctx, js_flora_world_constructor, "FloraWorld", 1,
                                         JS_CFUNC_constructor, 0);
    flora_worldProto = JS_GetClassProto(ctx, flora_world_class_id);
    JS_SetPropertyStr(ctx, flora_worldCtor, "prototype", JS_DupValue(ctx, flora_worldProto));
    JS_SetPropertyStr(ctx, flora_worldProto, "constructor", JS_DupValue(ctx, flora_worldCtor));
    JS_FreeValue(ctx, flora_worldProto);

    JS_SetPropertyStr(ctx, global, "FloraWorld", flora_worldCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
