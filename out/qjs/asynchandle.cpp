#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID async_handle_class_id = 0;

static void async_handle_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<AsyncHandleWrapper*>(JS_GetOpaque(val, async_handle_class_id));
    delete w;
}

static JSClassDef async_handle_class_def = { "AsyncHandle", async_handle_finalizer };

static JSValue async_handle_cancel(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<AsyncHandleWrapper*>(JS_GetOpaque2(ctx, this_val, async_handle_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_UNDEFINED;
}

void installAsyncHandle(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register AsyncHandle class
    if (async_handle_class_id == 0) JS_NewClassID(rt, &async_handle_class_id);
    JS_NewClass(rt, async_handle_class_id, &async_handle_class_def);

    JSValue async_handleProto = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, async_handleProto, "cancel",
        JS_NewCFunction(ctx, async_handle_cancel, "cancel", 0));

    JS_SetClassProto(ctx, async_handle_class_id, async_handleProto);

    JSValue async_handleCtor = JS_NewCFunction2(ctx, js_async_handle_constructor, "AsyncHandle", 1,
                                         JS_CFUNC_constructor, 0);
    async_handleProto = JS_GetClassProto(ctx, async_handle_class_id);
    JS_SetPropertyStr(ctx, async_handleCtor, "prototype", JS_DupValue(ctx, async_handleProto));
    JS_SetPropertyStr(ctx, async_handleProto, "constructor", JS_DupValue(ctx, async_handleCtor));
    JS_FreeValue(ctx, async_handleProto);

    JS_SetPropertyStr(ctx, global, "AsyncHandle", async_handleCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
