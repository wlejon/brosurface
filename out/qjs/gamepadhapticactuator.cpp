#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID gamepad_haptic_actuator_class_id = 0;

static void gamepad_haptic_actuator_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<GamepadHapticActuatorWrapper*>(JS_GetOpaque(val, gamepad_haptic_actuator_class_id));
    delete w;
}

static JSClassDef gamepad_haptic_actuator_class_def = { "GamepadHapticActuator", gamepad_haptic_actuator_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue gamepad_haptic_actuator_play_effect(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<GamepadHapticActuatorWrapper*>(JS_GetOpaque2(ctx, this_val, gamepad_haptic_actuator_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "playEffect(type, params)");

    const char* type_cstr = JS_ToCString(ctx, argv[0]);
    if (!type_cstr) return JS_EXCEPTION;
    std::string type = type_cstr;
    JS_FreeCString(ctx, type_cstr);
    JSValueConst params = argv[1];

    return 0;
}

static JSValue gamepad_haptic_actuator_reset(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<GamepadHapticActuatorWrapper*>(JS_GetOpaque2(ctx, this_val, gamepad_haptic_actuator_class_id));
    if (!w) return JS_EXCEPTION;

    return 0;
}

static JSValue js_gamepad_haptic_actuator_type(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewString(ctx, (0).c_str());
}

static JSValue js_gamepad_haptic_actuator_effects(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

void installGamepadHapticActuator(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register GamepadHapticActuator class
    if (gamepad_haptic_actuator_class_id == 0) JS_NewClassID(rt, &gamepad_haptic_actuator_class_id);
    JS_NewClass(rt, gamepad_haptic_actuator_class_id, &gamepad_haptic_actuator_class_def);

    JSValue gamepad_haptic_actuatorProto = JS_NewObject(ctx);

    JSAtom gamepad_haptic_actuator_type_atom = JS_NewAtom(ctx, "type");
    JS_DefinePropertyGetSet(ctx, gamepad_haptic_actuatorProto, gamepad_haptic_actuator_type_atom,
                            newGetter(ctx, js_gamepad_haptic_actuator_type, "type"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gamepad_haptic_actuator_type_atom);
    JSAtom gamepad_haptic_actuator_effects_atom = JS_NewAtom(ctx, "effects");
    JS_DefinePropertyGetSet(ctx, gamepad_haptic_actuatorProto, gamepad_haptic_actuator_effects_atom,
                            newGetter(ctx, js_gamepad_haptic_actuator_effects, "effects"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, gamepad_haptic_actuator_effects_atom);

    JS_SetPropertyStr(ctx, gamepad_haptic_actuatorProto, "playEffect",
        JS_NewCFunction(ctx, gamepad_haptic_actuator_play_effect, "playEffect", 2));
    JS_SetPropertyStr(ctx, gamepad_haptic_actuatorProto, "reset",
        JS_NewCFunction(ctx, gamepad_haptic_actuator_reset, "reset", 0));

    JS_SetClassProto(ctx, gamepad_haptic_actuator_class_id, gamepad_haptic_actuatorProto);

    JSValue gamepad_haptic_actuatorCtor = JS_NewCFunction2(ctx, js_gamepad_haptic_actuator_constructor, "GamepadHapticActuator", 1,
                                         JS_CFUNC_constructor, 0);
    gamepad_haptic_actuatorProto = JS_GetClassProto(ctx, gamepad_haptic_actuator_class_id);
    JS_SetPropertyStr(ctx, gamepad_haptic_actuatorCtor, "prototype", JS_DupValue(ctx, gamepad_haptic_actuatorProto));
    JS_SetPropertyStr(ctx, gamepad_haptic_actuatorProto, "constructor", JS_DupValue(ctx, gamepad_haptic_actuatorCtor));
    JS_FreeValue(ctx, gamepad_haptic_actuatorProto);

    JS_SetPropertyStr(ctx, global, "GamepadHapticActuator", gamepad_haptic_actuatorCtor);

    JS_FreeValue(ctx, global);
}


} // namespace brokit::api
