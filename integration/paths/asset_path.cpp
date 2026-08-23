#include "js/asset_path.h"
#include "util/asset_mounts.h"
#include <filesystem>

namespace bro::js {

static JSValue js_get_app_dir(JSContext* ctx, JSValueConst, int, JSValueConst*) {
    const auto& appDir = bro::engine::Engine::instance().appDir();
    return JS_NewString(ctx, appDir.c_str());
}

static JSValue js_resolve_path(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1) return JS_UNDEFINED;
    const char* pathStr = JS_ToCString(ctx, argv[0]);
    if (!pathStr) return JS_EXCEPTION;
    std::string path(pathStr);
    JS_FreeCString(ctx, pathStr);
    std::string resolved = bro::vfs::resolvePath(path);
    return JS_NewString(ctx, resolved.c_str());
}

void installAssetPathBindings(JSContext* ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
        broObj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
    }

    JSAtom appDirAtom = JS_NewAtom(ctx, "appDir");
    JS_DefinePropertyGetSet(ctx, broObj, appDirAtom,
        JS_NewCFunction(ctx, js_get_app_dir, "appDir", 0),
        JS_UNDEFINED,
        JS_PROP_CONFIGURABLE | JS_PROP_ENUMERABLE);
    JS_FreeAtom(ctx, appDirAtom);

    JS_SetPropertyStr(ctx, broObj, "resolvePath",
        JS_NewCFunction(ctx, js_resolve_path, "resolvePath", 1));

    JS_FreeValue(ctx, broObj);
    JS_FreeValue(ctx, global);
}

} // namespace bro::js
