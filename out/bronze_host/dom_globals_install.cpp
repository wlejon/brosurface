// dom_globals_install.cpp - Generated bronze_host Globals Registration Wiring
// Emitted in lockstep with web_host.globals manifest from IDL declarations.

#pragma once

namespace bro::bronze_host {

// Registered host globals:
// AbortSignal, AbortController, DOMParser, Blob, File, FileReader, URL, GamepadButton, Gamepad, GamepadEvent

inline void installDeclaredWebHostGlobals() {
    installAbortGlobals();
    installAbortControllerGlobals();
    installParserGlobal();
    installFileGlobals();
    installFileReaderGlobals();
    installURLGlobals();
    installGamepadButtonGlobals();
    installGamepadGlobals();
    installGamepadEventGlobals();
}

}  // namespace bro::bronze_host
