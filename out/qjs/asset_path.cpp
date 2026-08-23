#include "js/asset_path.h"
#include "util/asset_mounts.h"
#include <filesystem>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

namespace {
std::string s_basePath;
const util::AssetMounts* s_mounts = nullptr;
}

void setAssetPathContext(const std::string& basePath, const util::AssetMounts* mounts) {
    s_basePath = basePath;
    s_mounts = mounts;
}

std::string resolveAssetPath(const std::string& src) {
    if (src.size() >= 2 && src[1] == ':') return src;
    if (!src.empty() && (src[0] == '/' || src[0] == '\\')) {
        if (s_mounts) {
            std::string m = s_mounts->resolve(src);
            if (!m.empty()) return m;
        }
        return src;
    }
    if (s_basePath.empty()) return src;
    std::string path = s_basePath;
    if (path.back() != '/' && path.back() != '\\') path += '/';
    return path + src;
}

namespace {

JSValue js_resolvePath(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    if (argc < 1) return JS_ThrowTypeError(ctx, "resolvePath: path required");
    const char* s = JS_ToCString(ctx, argv[0]);
    if (!s) return JS_EXCEPTION;
    std::string resolved = resolveAssetPath(s);
    JS_FreeCString(ctx, s);
    return JS_NewString(ctx, std::filesystem::path(resolved).make_preferred().string().c_str());
}

}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void installAssetPathBindings(JSContext* ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
    if (JS_IsUndefined(broObj)) {
        broObj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
    }
    
    JS_SetPropertyStr(ctx, broObj, "resolvePath",
                      JS_NewCFunction(ctx, js_resolvePath, "resolvePath", 1));
    
    std::string dir = s_basePath.empty()
                          ? std::string()
                          : std::filesystem::path(s_basePath).make_preferred().string();
    JS_SetPropertyStr(ctx, broObj, "appDir", JS_NewString(ctx, dir.c_str()));
    
    JS_FreeValue(ctx, broObj);
    JS_FreeValue(ctx, global);
}

std::string resolveAssetWritePath(const std::string& src) {
    namespace fs = std::filesystem;
    fs::path p(src);
    if (p.is_absolute() || !p.has_parent_path()) return resolveAssetPath(src);
    std::string dir = resolveAssetPath(p.parent_path().generic_string());
    return (fs::path(dir) / p.filename()).generic_string();
}


} // namespace bro::js
