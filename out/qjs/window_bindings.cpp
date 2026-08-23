#include "js/window_bindings.h"
#include "js/event_dispatch.h"
#include "platform/clipboard.h"
#include "platform/event_loop.h"
#include "platform/sdl_window.h"
#include "util/log.h"
#include "window_polyfill.js.h"
#include <qjsbind/qjsbind.h>
#include <cstring>
#include <limits>
#include <unordered_map>
#include <SDL3/SDL_misc.h>
#include <SDL3/SDL_power.h>
#include <SDL3/SDL_stdinc.h>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

struct RealmWindowState {
    platform::Window* window = nullptr;
    bool headless = false;
};

static std::unordered_map<JSContext*, RealmWindowState> s_realms;

static constexpr int kDefaultFallbackW = 800;
static constexpr int kDefaultFallbackH = 600;

static RealmWindowState& realmFor(JSContext* ctx) {
    return s_realms[ctx];
}

static platform::Window* realmWindow(JSContext* ctx) {
    auto it = s_realms.find(ctx);
    return (it != s_realms.end()) ? it->second.window : nullptr;
}

static bool realmHeadless(JSContext* ctx) {
    auto it = s_realms.find(ctx);
    return (it != s_realms.end()) ? it->second.headless : false;
}

static platform::DisplayInfo currentDisplayInfo(JSContext* ctx) {
    platform::DisplayInfo out{};
    auto* win = realmWindow(ctx);
    if (win) {
        out = win->getCurrentDisplay();
    } else {
        out.width = kDefaultFallbackW;
        out.height = kDefaultFallbackH;
        out.workWidth = kDefaultFallbackW;
        out.workHeight = kDefaultFallbackH;
    }
    return out;
}

static JSValue js_clipboard_write(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValue resolving_funcs[2];
    JSValue promise = JS_NewPromiseCapability(ctx, resolving_funcs);
    if (JS_IsException(promise)) return promise;

    const char* text = argc > 0 ? JS_ToCString(ctx, argv[0]) : "";
    bool ok = text ? platform::setClipboardText(text) : false;
    if (text && argc > 0) JS_FreeCString(ctx, text);

    if (ok) {
        JSValue undef = JS_UNDEFINED;
        JSValue ret = JS_Call(ctx, resolving_funcs[0], JS_UNDEFINED, 1, &undef);
        JS_FreeValue(ctx, ret);
    } else {
        JSValue err = JS_NewError(ctx);
        JS_SetPropertyStr(ctx, err, "message", JS_NewString(ctx, "Clipboard write failed"));
        JSValue ret = JS_Call(ctx, resolving_funcs[1], JS_UNDEFINED, 1, &err);
        JS_FreeValue(ctx, err);
        JS_FreeValue(ctx, ret);
    }
    JS_FreeValue(ctx, resolving_funcs[0]);
    JS_FreeValue(ctx, resolving_funcs[1]);
    return promise;
}

static JSValue js_clipboard_read(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    JSValue resolving_funcs[2];
    JSValue promise = JS_NewPromiseCapability(ctx, resolving_funcs);
    if (JS_IsException(promise)) return promise;

    std::string text = platform::getClipboardText();
    JSValue result = JS_NewString(ctx, text.c_str());
    JSValue ret = JS_Call(ctx, resolving_funcs[0], JS_UNDEFINED, 1, &result);
    JS_FreeValue(ctx, result);
    JS_FreeValue(ctx, ret);

    JS_FreeValue(ctx, resolving_funcs[0]);
    JS_FreeValue(ctx, resolving_funcs[1]);
    return promise;
}

static void screenDims(JSContext* ctx, int& fullW, int& fullH, int& workW, int& workH) {
    auto* win = realmWindow(ctx);
    if (!win) {
        fullW = workW = kDefaultFallbackW;
        fullH = workH = kDefaultFallbackH;
        return;
    }
    if (realmHeadless(ctx)) {
        int w = 0, h = 0;
        win->getSize(w, h);
        if (w <= 0) w = kDefaultFallbackW;
        if (h <= 0) h = kDefaultFallbackH;
        fullW = workW = w;
        fullH = workH = h;
        return;
    }
    auto d = win->getCurrentDisplay();
    fullW = d.width;
    fullH = d.height;
    workW = d.workWidth;
    workH = d.workHeight;
}

static JSValue js_screen_width(JSContext* ctx, JSValueConst) {
    int fw = 0, fh = 0, ww = 0, wh = 0;
    screenDims(ctx, fw, fh, ww, wh);
    return JS_NewInt32(ctx, fw);
}

static JSValue js_screen_height(JSContext* ctx, JSValueConst) {
    int fw = 0, fh = 0, ww = 0, wh = 0;
    screenDims(ctx, fw, fh, ww, wh);
    return JS_NewInt32(ctx, fh);
}

static JSValue js_screen_availWidth(JSContext* ctx, JSValueConst) {
    int fw = 0, fh = 0, ww = 0, wh = 0;
    screenDims(ctx, fw, fh, ww, wh);
    return JS_NewInt32(ctx, ww);
}

static JSValue js_screen_availHeight(JSContext* ctx, JSValueConst) {
    int fw = 0, fh = 0, ww = 0, wh = 0;
    screenDims(ctx, fw, fh, ww, wh);
    return JS_NewInt32(ctx, wh);
}

static JSValue js_screen_colorDepth(JSContext* ctx, JSValueConst) {
    return JS_NewInt32(ctx, 24);
}

static JSValue js_window_focus(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    if (auto* win = realmWindow(ctx)) {
        if (!realmHeadless(ctx)) win->raise();
    }
    return JS_UNDEFINED;
}

static JSValue js_window_blur(JSContext*, JSValueConst, int, JSValueConst*) {
    return JS_UNDEFINED;
}

static JSValue js_window_open(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1 || !JS_IsString(argv[0])) return JS_NULL;
    const char* url = JS_ToCString(ctx, argv[0]);
    if (!url) return JS_NULL;

    if (realmHeadless(ctx)) {
        LOG_INFO("[window.open] (headless, not shelling out) -> %s", url);
        JS_FreeCString(ctx, url);
        return JS_NULL;
    }

    if (!SDL_OpenURL(url)) {
        LOG_WARN("[window.open] SDL_OpenURL failed: %s (url: %s)",
                 SDL_GetError(), url);
    }
    JS_FreeCString(ctx, url);
    return JS_NULL;
}

static JSValue js_navigator_getBattery(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    JSValue funcs[2];
    JSValue p = JS_NewPromiseCapability(ctx, funcs);
    if (JS_IsException(p)) return p;

    bool charging = true;
    double chargingTime = 0.0;
    double dischargingTime = std::numeric_limits<double>::infinity();
    double level = 1.0;

    if (!realmHeadless(ctx)) {
        int seconds = -1, percent = -1;
        SDL_PowerState st = SDL_GetPowerInfo(&seconds, &percent);
        switch (st) {
        case SDL_POWERSTATE_ON_BATTERY:
            charging = false;
            chargingTime = std::numeric_limits<double>::infinity();
            dischargingTime = (seconds >= 0)
                ? static_cast<double>(seconds)
                : std::numeric_limits<double>::infinity();
            level = (percent >= 0)
                ? std::clamp(static_cast<double>(percent) / 100.0, 0.0, 1.0)
                : 1.0;
            break;
        case SDL_POWERSTATE_CHARGING:
            charging = true;
            chargingTime = std::numeric_limits<double>::infinity();
            dischargingTime = std::numeric_limits<double>::infinity();
            level = (percent >= 0)
                ? std::clamp(static_cast<double>(percent) / 100.0, 0.0, 1.0)
                : 1.0;
            break;
        case SDL_POWERSTATE_CHARGED:
            charging = true;
            chargingTime = 0.0;
            dischargingTime = std::numeric_limits<double>::infinity();
            level = 1.0;
            break;
        case SDL_POWERSTATE_NO_BATTERY:
        case SDL_POWERSTATE_ERROR:
        case SDL_POWERSTATE_UNKNOWN:
        default:
            charging = true;
            chargingTime = 0.0;
            dischargingTime = std::numeric_limits<double>::infinity();
            level = 1.0;
            break;
        }
    }

    JSValue mgr = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, mgr, "charging",        JS_NewBool(ctx, charging));
    JS_SetPropertyStr(ctx, mgr, "chargingTime",    JS_NewFloat64(ctx, chargingTime));
    JS_SetPropertyStr(ctx, mgr, "dischargingTime", JS_NewFloat64(ctx, dischargingTime));
    JS_SetPropertyStr(ctx, mgr, "level",           JS_NewFloat64(ctx, level));

    auto inert = [](JSContext*, JSValueConst, int, JSValueConst*) -> JSValue {
        return JS_UNDEFINED;
    };
    JS_SetPropertyStr(ctx, mgr, "addEventListener",
        JS_NewCFunction(ctx, inert, "addEventListener", 2));
    JS_SetPropertyStr(ctx, mgr, "removeEventListener",
        JS_NewCFunction(ctx, inert, "removeEventListener", 2));
    JS_SetPropertyStr(ctx, mgr, "dispatchEvent",
        JS_NewCFunction(ctx, [](JSContext* c, JSValueConst, int, JSValueConst*) -> JSValue {
            return JS_NewBool(c, true);
        }, "dispatchEvent", 1));
    JS_SetPropertyStr(ctx, mgr, "onchargingchange",        JS_NULL);
    JS_SetPropertyStr(ctx, mgr, "onchargingtimechange",    JS_NULL);
    JS_SetPropertyStr(ctx, mgr, "ondischargingtimechange", JS_NULL);
    JS_SetPropertyStr(ctx, mgr, "onlevelchange",           JS_NULL);

    JSValue r = JS_Call(ctx, funcs[0], JS_UNDEFINED, 1, &mgr);
    JS_FreeValue(ctx, r);
    JS_FreeValue(ctx, mgr);
    JS_FreeValue(ctx, funcs[0]);
    JS_FreeValue(ctx, funcs[1]);
    return p;
}

void installWindowBindings(JSContext* ctx, platform::Window* window, bool headless) {
    RealmWindowState& st = realmFor(ctx);
    st.window = window;
    st.headless = headless;

    JSValue global = JS_GetGlobalObject(ctx);

    JSValue nav = JS_GetPropertyStr(ctx, global, "navigator");
    if (JS_IsUndefined(nav) || JS_IsNull(nav)) {
        JS_FreeValue(ctx, nav);
        nav = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "navigator", JS_DupValue(ctx, nav));
    }
    JSValue clip = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, clip, "writeText",
        JS_NewCFunction(ctx, js_clipboard_write, "writeText", 1));
    JS_SetPropertyStr(ctx, clip, "readText",
        JS_NewCFunction(ctx, js_clipboard_read, "readText", 0));
    JS_SetPropertyStr(ctx, nav, "clipboard", clip);

    JS_SetPropertyStr(ctx, nav, "getBattery",
        JS_NewCFunction(ctx, js_navigator_getBattery, "getBattery", 0));
    JS_FreeValue(ctx, nav);

    JSValue screen = JS_NewObject(ctx);
    auto defScreenGet = [&](const char* name, JSCFunction* fn) {
        JSAtom atom = JS_NewAtom(ctx, name);
        JS_DefinePropertyGetSet(ctx, screen, atom,
            JS_NewCFunction(ctx, fn, name, 0), JS_UNDEFINED,
            JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE);
        JS_FreeAtom(ctx, atom);
    };
    defScreenGet("width",       js_screen_width);
    defScreenGet("height",      js_screen_height);
    defScreenGet("availWidth",  js_screen_availWidth);
    defScreenGet("availHeight", js_screen_availHeight);
    defScreenGet("colorDepth",  js_screen_colorDepth);
    defScreenGet("pixelDepth",  js_screen_colorDepth);
    JS_SetPropertyStr(ctx, global, "screen", screen);

    JS_SetPropertyStr(ctx, global, "focus",
        JS_NewCFunction(ctx, js_window_focus, "focus", 0));
    JS_SetPropertyStr(ctx, global, "blur",
        JS_NewCFunction(ctx, js_window_blur, "blur", 0));
    JS_SetPropertyStr(ctx, global, "open",
        JS_NewCFunction(ctx, js_window_open, "open", 1));

    JSValue evalVal = JS_Eval(ctx, window_polyfill_js,
                              std::strlen(window_polyfill_js),
                              "<window_polyfill>", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(evalVal)) {
        JSValue ex = JS_GetException(ctx);
        const char* s = JS_ToCString(ctx, ex);
        LOG_ERROR("[window_polyfill] %s", s ? s : "unknown error");
        if (s) JS_FreeCString(ctx, s);
        JS_FreeValue(ctx, ex);
    }
    JS_FreeValue(ctx, evalVal);

    JS_FreeValue(ctx, global);
}

static JSValue js_brw_get_state(JSContext* ctx, JSValueConst) {
    auto* win = realmWindow(ctx);
    if (!win) return JS_NewString(ctx, "normal");
    switch (win->getState()) {
    case platform::WindowState::Minimized:  return JS_NewString(ctx, "minimized");
    case platform::WindowState::Maximized:  return JS_NewString(ctx, "maximized");
    case platform::WindowState::Fullscreen: return JS_NewString(ctx, "fullscreen");
    case platform::WindowState::Normal:
    default:                                return JS_NewString(ctx, "normal");
    }
}

static JSValue js_brw_get_borderless(JSContext* ctx, JSValueConst) {
    auto* win = realmWindow(ctx);
    return JS_NewBool(ctx, win ? win->isBorderless() : false);
}

static JSValue js_brw_set_borderless(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;
    if (auto* win = realmWindow(ctx)) {
        win->setBorderless(JS_ToBool(ctx, argv[0]));
    }
    return JS_UNDEFINED;
}

static JSValue js_brw_get_alwaysOnTop(JSContext* ctx, JSValueConst) {
    auto* win = realmWindow(ctx);
    return JS_NewBool(ctx, win ? win->isAlwaysOnTop() : false);
}

static JSValue js_brw_set_alwaysOnTop(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;
    if (auto* win = realmWindow(ctx)) {
        win->setAlwaysOnTop(JS_ToBool(ctx, argv[0]));
    }
    return JS_UNDEFINED;
}

static JSValue js_brw_minimize(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    if (realmWindow(ctx) && !realmHeadless(ctx)) realmWindow(ctx)->minimize();
    return JS_UNDEFINED;
}

static JSValue js_brw_maximize(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    if (realmWindow(ctx) && !realmHeadless(ctx)) realmWindow(ctx)->maximize();
    return JS_UNDEFINED;
}

static JSValue js_brw_restore(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    if (realmWindow(ctx) && !realmHeadless(ctx)) realmWindow(ctx)->restore();
    return JS_UNDEFINED;
}

static JSValue js_brw_getPosition(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    int x = 0, y = 0;
    if (realmWindow(ctx)) realmWindow(ctx)->getPosition(x, y);
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "x", JS_NewInt32(ctx, x));
    JS_SetPropertyStr(ctx, obj, "y", JS_NewInt32(ctx, y));
    return obj;
}

static JSValue js_brw_setPosition(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (!realmWindow(ctx) || realmHeadless(ctx) || argc < 2) return JS_UNDEFINED;
    int32_t x = 0, y = 0;
    if (JS_ToInt32(ctx, &x, argv[0]) || JS_ToInt32(ctx, &y, argv[1]))
        return JS_EXCEPTION;
    realmWindow(ctx)->setPosition(x, y);
    return JS_UNDEFINED;
}

static JSValue sizePairToJS(JSContext* ctx, int w, int h) {
    JSValue obj = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, obj, "width",  JS_NewInt32(ctx, w));
    JS_SetPropertyStr(ctx, obj, "height", JS_NewInt32(ctx, h));
    return obj;
}

static JSValue js_brw_getMinSize(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    int w = 0, h = 0;
    if (realmWindow(ctx)) realmWindow(ctx)->getMinimumSize(w, h);
    return sizePairToJS(ctx, w, h);
}

static JSValue js_brw_setMinSize(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (!realmWindow(ctx) || argc < 2) return JS_UNDEFINED;
    int32_t w = 0, h = 0;
    if (JS_ToInt32(ctx, &w, argv[0]) || JS_ToInt32(ctx, &h, argv[1]))
        return JS_EXCEPTION;
    realmWindow(ctx)->setMinimumSize(w, h);
    return JS_UNDEFINED;
}

static JSValue js_brw_getMaxSize(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    int w = 0, h = 0;
    if (realmWindow(ctx)) realmWindow(ctx)->getMaximumSize(w, h);
    return sizePairToJS(ctx, w, h);
}

static JSValue js_brw_setMaxSize(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (!realmWindow(ctx) || argc < 2) return JS_UNDEFINED;
    int32_t w = 0, h = 0;
    if (JS_ToInt32(ctx, &w, argv[0]) || JS_ToInt32(ctx, &h, argv[1]))
        return JS_EXCEPTION;
    realmWindow(ctx)->setMaximumSize(w, h);
    return JS_UNDEFINED;
}

static JSValue js_brw_getDisplays(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    JSValue arr = JS_NewArray(ctx);
    if (!realmWindow(ctx)) return arr;

    auto displays = realmWindow(ctx)->getDisplays();
    for (size_t i = 0; i < displays.size(); i++) {
        const auto& d = displays[i];
        JSValue obj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, obj, "id", JS_NewUint32(ctx, d.id));
        JS_SetPropertyStr(ctx, obj, "name", JS_NewString(ctx, d.name.c_str()));

        JSValue bounds = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, bounds, "x", JS_NewInt32(ctx, d.x));
        JS_SetPropertyStr(ctx, bounds, "y", JS_NewInt32(ctx, d.y));
        JS_SetPropertyStr(ctx, bounds, "width", JS_NewInt32(ctx, d.width));
        JS_SetPropertyStr(ctx, bounds, "height", JS_NewInt32(ctx, d.height));
        JS_SetPropertyStr(ctx, obj, "bounds", bounds);

        JSValue work = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, work, "x", JS_NewInt32(ctx, d.workX));
        JS_SetPropertyStr(ctx, work, "y", JS_NewInt32(ctx, d.workY));
        JS_SetPropertyStr(ctx, work, "width", JS_NewInt32(ctx, d.workWidth));
        JS_SetPropertyStr(ctx, work, "height", JS_NewInt32(ctx, d.workHeight));
        JS_SetPropertyStr(ctx, obj, "workArea", work);

        JS_SetPropertyStr(ctx, obj, "refreshRate", JS_NewFloat64(ctx, d.refreshRate));
        JS_SetPropertyStr(ctx, obj, "contentScale", JS_NewFloat64(ctx, d.contentScale));
        JS_SetPropertyStr(ctx, obj, "isPrimary", JS_NewBool(ctx, d.isPrimary));
        JS_SetPropertyStr(ctx, obj, "isCurrent", JS_NewBool(ctx, d.isCurrent));
        JS_SetPropertyUint32(ctx, arr, static_cast<uint32_t>(i), obj);
    }
    return arr;
}

static JSValue js_brw_moveToDisplay(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (!realmWindow(ctx) || realmHeadless(ctx) || argc < 1) return JS_NewBool(ctx, false);
    uint32_t id = 0;
    if (JS_ToUint32(ctx, &id, argv[0]))
        return JS_EXCEPTION;
    return JS_NewBool(ctx, realmWindow(ctx)->moveToDisplay(id));
}

static const JSCFunctionListEntry js_brw_funcs[] = {
    JS_CFUNC_DEF("minimize", 0, js_brw_minimize),
    JS_CFUNC_DEF("maximize", 0, js_brw_maximize),
    JS_CFUNC_DEF("restore", 0, js_brw_restore),
    JS_CFUNC_DEF("getPosition", 0, js_brw_getPosition),
    JS_CFUNC_DEF("setPosition", 2, js_brw_setPosition),
    JS_CFUNC_DEF("getMinSize", 0, js_brw_getMinSize),
    JS_CFUNC_DEF("setMinSize", 2, js_brw_setMinSize),
    JS_CFUNC_DEF("getMaxSize", 0, js_brw_getMaxSize),
    JS_CFUNC_DEF("setMaxSize", 2, js_brw_setMaxSize),
    JS_CFUNC_DEF("getDisplays", 0, js_brw_getDisplays),
    JS_CFUNC_DEF("moveToDisplay", 1, js_brw_moveToDisplay),
};

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void installBroWindowBindings(JSContext* ctx, platform::Window* window, bool headless) {
    {
            RealmWindowState& st = realmFor(ctx);
            if (window) st.window = window;
            st.headless = headless;
        }
    
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue bro = JS_GetPropertyStr(ctx, global, "bro");
        if (JS_IsUndefined(bro) || JS_IsNull(bro)) {
            JS_FreeValue(ctx, bro);
            bro = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, bro));
        }
    
        JSValue win = JS_NewObject(ctx);
        JS_SetPropertyFunctionList(ctx, win, js_brw_funcs,
                                   sizeof(js_brw_funcs) / sizeof(js_brw_funcs[0]));
    
        auto defineGetSet = [&](const char* name, JSCFunction* getter,
                                JSCFunction* setter) {
            JSAtom atom = JS_NewAtom(ctx, name);
            JS_DefinePropertyGetSet(ctx, win, atom,
                JS_NewCFunction(ctx, getter, name, 0),
                setter ? JS_NewCFunction(ctx, setter, name, 1) : JS_UNDEFINED,
                JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE);
            JS_FreeAtom(ctx, atom);
        };
        defineGetSet("state",       js_brw_get_state,       nullptr);
        defineGetSet("borderless",  js_brw_get_borderless,  js_brw_set_borderless);
        defineGetSet("alwaysOnTop", js_brw_get_alwaysOnTop, js_brw_set_alwaysOnTop);
    
        JS_SetPropertyStr(ctx, bro, "window", win);
        JS_FreeValue(ctx, bro);
        JS_FreeValue(ctx, global);
}

void cleanupWindowBindings(JSContext* ctx) {
    s_realms.erase(ctx);
}

void installWindowClose(JSContext* ctx, platform::EventLoop* eventLoop) {
    if (!eventLoop) return;
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue ptrVal = JS_NewInt64(ctx, static_cast<int64_t>(
        reinterpret_cast<intptr_t>(eventLoop)));
    JS_SetPropertyStr(ctx, global, "close",
        JS_NewCFunctionData(ctx, [](JSContext*, JSValue, int, JSValue*,
                                   int, JSValue* fdata) -> JSValue {
            int64_t p = 0;
            JS_ToInt64(nullptr, &p, fdata[0]);
            auto* loop = reinterpret_cast<platform::EventLoop*>(
                static_cast<intptr_t>(p));
            if (loop) loop->requestQuit();
            return JS_UNDEFINED;
        }, 0, 0, 1, &ptrVal));
    JS_FreeValue(ctx, ptrVal);
    JS_FreeValue(ctx, global);
}


} // namespace bro::js
