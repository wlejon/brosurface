#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID pipeline_class_id = 0;

static void pipeline_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<PipelineWrapper*>(JS_GetOpaque(val, pipeline_class_id));
    delete w;
}

static JSClassDef pipeline_class_def = { "Pipeline", pipeline_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue pipeline_load_weights(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<PipelineWrapper*>(JS_GetOpaque2(ctx, this_val, pipeline_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "loadWeights(path)");

    const char* path_cstr = JS_ToCString(ctx, argv[0]);
    if (!path_cstr) return JS_EXCEPTION;
    std::string path = path_cstr;
    JS_FreeCString(ctx, path_cstr);

    return JS_UNDEFINED;
}

static JSValue pipeline_generate(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<PipelineWrapper*>(JS_GetOpaque2(ctx, this_val, pipeline_class_id));
    if (!w) return JS_EXCEPTION;
    JSValueConst opts = argv[0];

    return 0;
}

static JSValue js_pipeline_weightsLoaded(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

void installPipeline(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register Pipeline class
    if (pipeline_class_id == 0) JS_NewClassID(rt, &pipeline_class_id);
    JS_NewClass(rt, pipeline_class_id, &pipeline_class_def);

    JSValue pipelineProto = JS_NewObject(ctx);

    JSAtom pipeline_weightsLoaded_atom = JS_NewAtom(ctx, "weightsLoaded");
    JS_DefinePropertyGetSet(ctx, pipelineProto, pipeline_weightsLoaded_atom,
                            newGetter(ctx, js_pipeline_weightsLoaded, "weightsLoaded"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, pipeline_weightsLoaded_atom);

    JS_SetPropertyStr(ctx, pipelineProto, "loadWeights",
        JS_NewCFunction(ctx, pipeline_load_weights, "loadWeights", 1));
    JS_SetPropertyStr(ctx, pipelineProto, "generate",
        JS_NewCFunction(ctx, pipeline_generate, "generate", 1));

    JS_SetClassProto(ctx, pipeline_class_id, pipelineProto);

    JSValue pipelineCtor = JS_NewCFunction2(ctx, js_pipeline_constructor, "Pipeline", 1,
                                         JS_CFUNC_constructor, 0);
    pipelineProto = JS_GetClassProto(ctx, pipeline_class_id);
    JS_SetPropertyStr(ctx, pipelineCtor, "prototype", JS_DupValue(ctx, pipelineProto));
    JS_SetPropertyStr(ctx, pipelineProto, "constructor", JS_DupValue(ctx, pipelineCtor));
    JS_FreeValue(ctx, pipelineProto);

    JS_SetPropertyStr(ctx, global, "Pipeline", pipelineCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
