#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID gamepad_event_class_id = 0;

static void gamepad_event_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<GamepadEventWrapper*>(JS_GetOpaque(val, gamepad_event_class_id));
    delete w;
}

static JSClassDef gamepad_event_class_def = { "GamepadEvent", gamepad_event_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue js_gamepad_event_gamepad(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

void installGamepadEvent(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register GamepadEvent class
    if (gamepad_event_class_id == 0) JS_NewClassID(rt, &gamepad_event_class_id);
    JS_NewClass(rt, gamepad_event_class_id, &gamepad_event_class_def);

    JSValue gamepad_eventProto = JS_NewObject(ctx);

    JSAtom gamepad_event_gamepad_atom = JS_NewAtom(ctx, "gamepad");
    JS_DefinePropertyGetSet(ctx, gamepad_eventProto, gamepad_event_gamepad_atom,
                            newGetter(ctx, js_gamepad_event_gamepad, "gamepad"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gamepad_event_gamepad_atom);

    JS_SetClassProto(ctx, gamepad_event_class_id, gamepad_eventProto);

    JSValue gamepad_eventCtor = JS_NewCFunction2(ctx, js_gamepad_event_constructor, "GamepadEvent", 1,
                                         JS_CFUNC_constructor, 0);
    gamepad_eventProto = JS_GetClassProto(ctx, gamepad_event_class_id);
    JS_SetPropertyStr(ctx, gamepad_eventCtor, "prototype", JS_DupValue(ctx, gamepad_eventProto));
    JS_SetPropertyStr(ctx, gamepad_eventProto, "constructor", JS_DupValue(ctx, gamepad_eventCtor));
    JS_FreeValue(ctx, gamepad_eventProto);

    JS_SetPropertyStr(ctx, global, "GamepadEvent", gamepad_eventCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
