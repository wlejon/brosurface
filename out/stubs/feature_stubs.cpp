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

#include "js/tween_bindings.h"
#include "js/clipmapterrain_bindings.h"
#include "js/diar_bindings.h"
#include "js/flora_bindings.h"
#include "js/gesture_bindings.h"
#include "js/gizmo_bindings.h"
#include "js/gpu_bindings.h"
#include "js/kws_bindings.h"
#include "js/lightnode_bindings.h"
#include "js/listen_bindings.h"
#include "js/lm_bindings.h"
#include "js/mesh_bindings.h"
#include "js/motion_bindings.h"
#include "js/rave_bindings.h"
#include "js/skindata_bindings.h"
#include "js/scenegraph_bindings.h"
#include "js/sense_bindings.h"
#include "js/stt_bindings.h"
#include "js/terrain_bindings.h"
#include "js/text_bindings.h"
#include "js/tileworld_bindings.h"
#include "js/tts_bindings.h"
#include "js/wake_bindings.h"
#include "js/worldgen_bindings.h"

namespace bro::js {

// ── TWEEN ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installTweenBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "Tween", "BRO_WITH_3D");
}
#endif

// ── CLIPMAPTERRAIN ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installClipmapTerrainBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "ClipmapTerrain", "BRO_WITH_3D");
}
#endif

// ── DIAR ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installDiarBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "diar", "BRO_WITH_SOUNDML");
}
#endif

// ── FLORA ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_FLORA
void installFloraBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "flora", "BRO_WITH_FLORA");
}
#endif

// ── GESTURE ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installGestureBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "gesture", "BRO_WITH_SOUNDML");
}
#endif

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

// ── KWS ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installKwsBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "kws", "BRO_WITH_SOUNDML");
}
#endif

// ── LIGHTNODE ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installLightNodeBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "LightNode", "BRO_WITH_3D");
}
#endif

// ── LISTEN ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installListenBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "listen", "BRO_WITH_SOUNDML");
}
#endif

// ── LM ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_LM
void installLmBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "lm", "BRO_WITH_LM");
}
#endif

// ── MESH ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installMeshBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "Mesh", "BRO_WITH_3D");
}
#endif

// ── MOTION ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_DIFFUSION && BRO_WITH_LM
void installMotionBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "motion", "BRO_WITH_DIFFUSION && BRO_WITH_LM");
}
#endif

// ── RAVE ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installRaveBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "rave", "BRO_WITH_SOUNDML");
}
#endif

// ── SKINDATA ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installSkinDataBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "SkinData", "BRO_WITH_3D");
}
#endif

// ── SCENEGRAPH ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installSceneGraphBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "SceneGraph", "BRO_WITH_3D");
}
#endif

// ── SENSE ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installSenseBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "sense", "BRO_WITH_SOUNDML");
}
#endif

// ── STT ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installSttBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "stt", "BRO_WITH_SOUNDML");
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

// ── TILEWORLD ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_3D
void installTileWorldBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "TileWorld", "BRO_WITH_3D");
}
#endif

// ── TTS ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installTtsBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "tts", "BRO_WITH_SOUNDML");
}
#endif

// ── WAKE ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_SOUNDML
void installWakeBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "wake", "BRO_WITH_SOUNDML");
}
#endif

// ── WORLDGEN ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_DIFFUSION
void installWorldgenBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "worldgen", "BRO_WITH_DIFFUSION");
}
#endif

} // namespace bro::js
