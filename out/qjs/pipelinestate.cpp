#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID pipeline_state_class_id = 0;

static void pipeline_state_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<PipelineStateWrapper*>(JS_GetOpaque(val, pipeline_state_class_id));
    delete w;
}

static JSClassDef pipeline_state_class_def = { "PipelineState", pipeline_state_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue js_pipeline_state_step(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewInt32(ctx, static_cast<int32_t>(0));
}

static JSValue js_pipeline_state_done(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

void installPipelineState(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register PipelineState class
    if (pipeline_state_class_id == 0) JS_NewClassID(rt, &pipeline_state_class_id);
    JS_NewClass(rt, pipeline_state_class_id, &pipeline_state_class_def);

    JSValue pipeline_stateProto = JS_NewObject(ctx);

    JSAtom pipeline_state_step_atom = JS_NewAtom(ctx, "step");
    JS_DefinePropertyGetSet(ctx, pipeline_stateProto, pipeline_state_step_atom,
                            newGetter(ctx, js_pipeline_state_step, "step"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, pipeline_state_step_atom);
    JSAtom pipeline_state_done_atom = JS_NewAtom(ctx, "done");
    JS_DefinePropertyGetSet(ctx, pipeline_stateProto, pipeline_state_done_atom,
                            newGetter(ctx, js_pipeline_state_done, "done"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, pipeline_state_done_atom);

    JS_SetClassProto(ctx, pipeline_state_class_id, pipeline_stateProto);

    JSValue pipeline_stateCtor = JS_NewCFunction2(ctx, js_pipeline_state_constructor, "PipelineState", 1,
                                         JS_CFUNC_constructor, 0);
    pipeline_stateProto = JS_GetClassProto(ctx, pipeline_state_class_id);
    JS_SetPropertyStr(ctx, pipeline_stateCtor, "prototype", JS_DupValue(ctx, pipeline_stateProto));
    JS_SetPropertyStr(ctx, pipeline_stateProto, "constructor", JS_DupValue(ctx, pipeline_stateCtor));
    JS_FreeValue(ctx, pipeline_stateProto);

    JS_SetPropertyStr(ctx, global, "PipelineState", pipeline_stateCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
