#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID world_class_id = 0;

static void world_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque(val, world_class_id));
    delete w;
}

static JSClassDef world_class_def = { "World", world_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue world_elevation(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque2(ctx, this_val, world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "elevation(i1, j1, i2, j2, opts)");

    double i1;
    if (JS_ToFloat64(ctx, &i1, argv[0])) return JS_EXCEPTION;
    double j1;
    if (JS_ToFloat64(ctx, &j1, argv[1])) return JS_EXCEPTION;
    double i2;
    if (JS_ToFloat64(ctx, &i2, argv[2])) return JS_EXCEPTION;
    double j2;
    if (JS_ToFloat64(ctx, &j2, argv[3])) return JS_EXCEPTION;
    JSValueConst opts = argv[4];

    return 0;
}

static JSValue world_elevation_sync(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque2(ctx, this_val, world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "elevationSync(i1, j1, i2, j2, opts)");

    double i1;
    if (JS_ToFloat64(ctx, &i1, argv[0])) return JS_EXCEPTION;
    double j1;
    if (JS_ToFloat64(ctx, &j1, argv[1])) return JS_EXCEPTION;
    double i2;
    if (JS_ToFloat64(ctx, &i2, argv[2])) return JS_EXCEPTION;
    double j2;
    if (JS_ToFloat64(ctx, &j2, argv[3])) return JS_EXCEPTION;
    JSValueConst opts = argv[4];

    return 0;
}

static JSValue world_coarse(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque2(ctx, this_val, world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 4)
        return JS_ThrowTypeError(ctx, "coarse(i1, j1, i2, j2, opts)");

    double i1;
    if (JS_ToFloat64(ctx, &i1, argv[0])) return JS_EXCEPTION;
    double j1;
    if (JS_ToFloat64(ctx, &j1, argv[1])) return JS_EXCEPTION;
    double i2;
    if (JS_ToFloat64(ctx, &i2, argv[2])) return JS_EXCEPTION;
    double j2;
    if (JS_ToFloat64(ctx, &j2, argv[3])) return JS_EXCEPTION;
    JSValueConst opts = argv[4];

    return 0;
}

static JSValue world_stage(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque2(ctx, this_val, world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 5)
        return JS_ThrowTypeError(ctx, "stage(name, i1, j1, i2, j2, opts)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);
    double i1;
    if (JS_ToFloat64(ctx, &i1, argv[1])) return JS_EXCEPTION;
    double j1;
    if (JS_ToFloat64(ctx, &j1, argv[2])) return JS_EXCEPTION;
    double i2;
    if (JS_ToFloat64(ctx, &i2, argv[3])) return JS_EXCEPTION;
    double j2;
    if (JS_ToFloat64(ctx, &j2, argv[4])) return JS_EXCEPTION;
    JSValueConst opts = argv[5];

    return 0;
}

static JSValue world_stage_sync(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque2(ctx, this_val, world_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 5)
        return JS_ThrowTypeError(ctx, "stageSync(name, i1, j1, i2, j2)");

    const char* name_cstr = JS_ToCString(ctx, argv[0]);
    if (!name_cstr) return JS_EXCEPTION;
    std::string name = name_cstr;
    JS_FreeCString(ctx, name_cstr);
    double i1;
    if (JS_ToFloat64(ctx, &i1, argv[1])) return JS_EXCEPTION;
    double j1;
    if (JS_ToFloat64(ctx, &j1, argv[2])) return JS_EXCEPTION;
    double i2;
    if (JS_ToFloat64(ctx, &i2, argv[3])) return JS_EXCEPTION;
    double j2;
    if (JS_ToFloat64(ctx, &j2, argv[4])) return JS_EXCEPTION;

    return 0;
}

static JSValue world_clear_cache(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<WorldWrapper*>(JS_GetOpaque2(ctx, this_val, world_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_UNDEFINED;
}

static JSValue js_world_seed(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_world_directory(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_world_cellSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_world_latentCellSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

static JSValue js_world_coarseCellSize(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

void installWorld(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register World class
    if (world_class_id == 0) JS_NewClassID(rt, &world_class_id);
    JS_NewClass(rt, world_class_id, &world_class_def);

    JSValue worldProto = JS_NewObject(ctx);

    JSAtom world_seed_atom = JS_NewAtom(ctx, "seed");
    JS_DefinePropertyGetSet(ctx, worldProto, world_seed_atom,
                            newGetter(ctx, js_world_seed, "seed"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, world_seed_atom);
    JSAtom world_directory_atom = JS_NewAtom(ctx, "directory");
    JS_DefinePropertyGetSet(ctx, worldProto, world_directory_atom,
                            newGetter(ctx, js_world_directory, "directory"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, world_directory_atom);
    JSAtom world_cellSize_atom = JS_NewAtom(ctx, "cellSize");
    JS_DefinePropertyGetSet(ctx, worldProto, world_cellSize_atom,
                            newGetter(ctx, js_world_cellSize, "cellSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, world_cellSize_atom);
    JSAtom world_latentCellSize_atom = JS_NewAtom(ctx, "latentCellSize");
    JS_DefinePropertyGetSet(ctx, worldProto, world_latentCellSize_atom,
                            newGetter(ctx, js_world_latentCellSize, "latentCellSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, world_latentCellSize_atom);
    JSAtom world_coarseCellSize_atom = JS_NewAtom(ctx, "coarseCellSize");
    JS_DefinePropertyGetSet(ctx, worldProto, world_coarseCellSize_atom,
                            newGetter(ctx, js_world_coarseCellSize, "coarseCellSize"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, world_coarseCellSize_atom);

    JS_SetPropertyStr(ctx, worldProto, "elevation",
        JS_NewCFunction(ctx, world_elevation, "elevation", 5));
    JS_SetPropertyStr(ctx, worldProto, "elevationSync",
        JS_NewCFunction(ctx, world_elevation_sync, "elevationSync", 5));
    JS_SetPropertyStr(ctx, worldProto, "coarse",
        JS_NewCFunction(ctx, world_coarse, "coarse", 5));
    JS_SetPropertyStr(ctx, worldProto, "stage",
        JS_NewCFunction(ctx, world_stage, "stage", 6));
    JS_SetPropertyStr(ctx, worldProto, "stageSync",
        JS_NewCFunction(ctx, world_stage_sync, "stageSync", 5));
    JS_SetPropertyStr(ctx, worldProto, "clearCache",
        JS_NewCFunction(ctx, world_clear_cache, "clearCache", 0));

    JS_SetClassProto(ctx, world_class_id, worldProto);

    JSValue worldCtor = JS_NewCFunction2(ctx, js_world_constructor, "World", 1,
                                         JS_CFUNC_constructor, 0);
    worldProto = JS_GetClassProto(ctx, world_class_id);
    JS_SetPropertyStr(ctx, worldCtor, "prototype", JS_DupValue(ctx, worldProto));
    JS_SetPropertyStr(ctx, worldProto, "constructor", JS_DupValue(ctx, worldCtor));
    JS_FreeValue(ctx, worldProto);

    JS_SetPropertyStr(ctx, global, "World", worldCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
