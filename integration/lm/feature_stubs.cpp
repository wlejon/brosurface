// =============================================================================
// Generated Availability Stubs (brosurface)
//
// Feature stubs for optional subsystems (AI tower + Tier-1 renderer/service).
// Each block below is compiled only when its BRO_WITH_* flag is OFF (0),
// and defines the same install entry point that the real binding defines.
//
// When a subsystem is compiled out, the stub installs an unavailable
// namespace reporting `available === false` wrapped in a throwing Proxy.
//
// Code Anchor: bro/src/js/feature_stubs.cpp & bro/src/js/feature_stub.h
// =============================================================================

#include "js/feature_stub.h"

#include "js/gizmo_bindings.h"
#include "js/gpu_bindings.h"
#include "js/lm_bindings.h"
#include "js/terrain_bindings.h"
#include "js/text_bindings.h"

namespace bro::js {

// ── GIZMO ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installGizmoBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "gizmo", "BRO_WITH_3D");
}
#endif

// ── GPU ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_TENSOR
void installGpuBindings(JSContext* ctx) {
    installFeatureStub(ctx,
        "(function(){var b=(globalThis.bro=globalThis.bro||{});"
        "b.gpu={available:false,backend:'cpu',devices:['cpu'],compiledBackends:['cpu'],"
        "deviceName:function(){return null;},"
        "deviceCount:function(d){return (!d||d==='cpu')?1:0;},"
        "memoryInfo:function(){return null;},"
        "trim:function(){return false;}};})();");
}
#endif

// ── LM ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_LM
void installLmBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "lm", "BRO_WITH_LM");
}
#endif

// ── TERRAIN ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installTerrainBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "Terrain", "BRO_WITH_3D");
}
#endif

// ── TEXT ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_TEXT_SHAPING
void installTextBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "text", "BRO_WITH_TEXT_SHAPING");
}
#endif

} // namespace bro::js
