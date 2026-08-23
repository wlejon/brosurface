#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID gamepad_button_class_id = 0;

static void gamepad_button_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<GamepadButtonWrapper*>(JS_GetOpaque(val, gamepad_button_class_id));
    delete w;
}

static JSClassDef gamepad_button_class_def = { "GamepadButton", gamepad_button_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue js_gamepad_button_pressed(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

static JSValue js_gamepad_button_touched(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewBool(ctx, 0);
}

static JSValue js_gamepad_button_value(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewFloat64(ctx, static_cast<double>(0));
}

void installGamepadButton(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register GamepadButton class
    if (gamepad_button_class_id == 0) JS_NewClassID(rt, &gamepad_button_class_id);
    JS_NewClass(rt, gamepad_button_class_id, &gamepad_button_class_def);

    JSValue gamepad_buttonProto = JS_NewObject(ctx);

    JSAtom gamepad_button_pressed_atom = JS_NewAtom(ctx, "pressed");
    JS_DefinePropertyGetSet(ctx, gamepad_buttonProto, gamepad_button_pressed_atom,
                            newGetter(ctx, js_gamepad_button_pressed, "pressed"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gamepad_button_pressed_atom);
    JSAtom gamepad_button_touched_atom = JS_NewAtom(ctx, "touched");
    JS_DefinePropertyGetSet(ctx, gamepad_buttonProto, gamepad_button_touched_atom,
                            newGetter(ctx, js_gamepad_button_touched, "touched"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gamepad_button_touched_atom);
    JSAtom gamepad_button_value_atom = JS_NewAtom(ctx, "value");
    JS_DefinePropertyGetSet(ctx, gamepad_buttonProto, gamepad_button_value_atom,
                            newGetter(ctx, js_gamepad_button_value, "value"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gamepad_button_value_atom);

    JS_SetClassProto(ctx, gamepad_button_class_id, gamepad_buttonProto);

    JSValue gamepad_buttonCtor = JS_NewCFunction2(ctx, js_gamepad_button_constructor, "GamepadButton", 1,
                                         JS_CFUNC_constructor, 0);
    gamepad_buttonProto = JS_GetClassProto(ctx, gamepad_button_class_id);
    JS_SetPropertyStr(ctx, gamepad_buttonCtor, "prototype", JS_DupValue(ctx, gamepad_buttonProto));
    JS_SetPropertyStr(ctx, gamepad_buttonProto, "constructor", JS_DupValue(ctx, gamepad_buttonCtor));
    JS_FreeValue(ctx, gamepad_buttonProto);

    JS_SetPropertyStr(ctx, global, "GamepadButton", gamepad_buttonCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
