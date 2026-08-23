#include "js/image_gpu_bindings.h"

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

static JSValue js_image_gpu_colormap(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst canvas = argv[0];
    float* src = nullptr;
    size_t n_src = 0;
    if (!resolve_f32(ctx, argv[1], "src", &src, &n_src)) return JS_EXCEPTION;
    JSValueConst lut = argv[2];
    JSValueConst params = argv[3];
    return JS_UNDEFINED;
}

static JSValue js_image_gpu_fbm2_d(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
    JSValueConst canvas = argv[0];
    JSValueConst lut = argv[1];
    JSValueConst params = argv[2];
    return JS_UNDEFINED;
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void ImageGpuBindings::install(JSContext* ctx) {
    JSValue global = JS_GetGlobalObject(ctx);
    JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
    if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
        broObj = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
    }

    JSValue image_gpuObj = JS_NewObject(ctx);

    JS_SetPropertyStr(ctx, image_gpuObj, "colormap",
        JS_NewCFunction(ctx, js_image_gpu_colormap, "colormap", 4));
    JS_SetPropertyStr(ctx, image_gpuObj, "fbm2D",
        JS_NewCFunction(ctx, js_image_gpu_fbm2_d, "fbm2D", 3));

    JS_SetPropertyStr(ctx, broObj, "image_gpu", image_gpuObj);
    JS_FreeValue(ctx, broObj);
    JS_FreeValue(ctx, global);
}


} // namespace bro::js
