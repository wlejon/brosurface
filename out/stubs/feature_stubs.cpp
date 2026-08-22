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

#include "js/lm_bindings.h"

namespace bro::js {

// ── LM ───────────────────────────────────────────────────────────────────────
#if !BRO_WITH_LM
void installLmBindings(JSContext* ctx) {
    installUnavailableNamespace(ctx, "lm", "BRO_WITH_LM");
}
#endif

} // namespace bro::js
