#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID tripo_splat_pipeline_class_id = 0;

static void tripo_splat_pipeline_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<TripoSplatWrapper*>(JS_GetOpaque(val, tripo_splat_pipeline_class_id));
    delete w;
}

static JSClassDef tripo_splat_pipeline_class_def = { "TripoSplatPipeline", tripo_splat_pipeline_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue tripo_splat_pipeline_generate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<TripoSplatPipelineWrapper*>(JS_GetOpaque2(ctx, this_val, tripo_splat_pipeline_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "generate(image, opts)");

    JSValueConst image = argv[0];
    JSValueConst opts = argv[1];

    return 0;
}

static JSValue js_tripo_splat_pipeline_device(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_tripo_splat_pipeline_backgroundRemoval(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

void installTripoSplatPipeline(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register TripoSplatPipeline class
    if (tripo_splat_pipeline_class_id == 0) JS_NewClassID(rt, &tripo_splat_pipeline_class_id);
    JS_NewClass(rt, tripo_splat_pipeline_class_id, &tripo_splat_pipeline_class_def);

    JSValue tripo_splat_pipelineProto = JS_NewObject(ctx);

    JSAtom tripo_splat_pipeline_device_atom = JS_NewAtom(ctx, "device");
    JS_DefinePropertyGetSet(ctx, tripo_splat_pipelineProto, tripo_splat_pipeline_device_atom,
                            newGetter(ctx, js_tripo_splat_pipeline_device, "device"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, tripo_splat_pipeline_device_atom);
    JSAtom tripo_splat_pipeline_backgroundRemoval_atom = JS_NewAtom(ctx, "backgroundRemoval");
    JS_DefinePropertyGetSet(ctx, tripo_splat_pipelineProto, tripo_splat_pipeline_backgroundRemoval_atom,
                            newGetter(ctx, js_tripo_splat_pipeline_backgroundRemoval, "backgroundRemoval"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, tripo_splat_pipeline_backgroundRemoval_atom);

    JS_SetPropertyStr(ctx, tripo_splat_pipelineProto, "generate",
        JS_NewCFunction(ctx, tripo_splat_pipeline_generate, "generate", 2));

    JS_SetClassProto(ctx, tripo_splat_pipeline_class_id, tripo_splat_pipelineProto);

    JSValue tripo_splat_pipelineCtor = JS_NewCFunction2(ctx, js_tripo_splat_pipeline_constructor, "TripoSplatPipeline", 1,
                                         JS_CFUNC_constructor, 0);
    tripo_splat_pipelineProto = JS_GetClassProto(ctx, tripo_splat_pipeline_class_id);
    JS_SetPropertyStr(ctx, tripo_splat_pipelineCtor, "prototype", JS_DupValue(ctx, tripo_splat_pipelineProto));
    JS_SetPropertyStr(ctx, tripo_splat_pipelineProto, "constructor", JS_DupValue(ctx, tripo_splat_pipelineCtor));
    JS_FreeValue(ctx, tripo_splat_pipelineProto);

    JS_SetPropertyStr(ctx, global, "TripoSplatPipeline", tripo_splat_pipelineCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
