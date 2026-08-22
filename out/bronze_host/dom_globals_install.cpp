// dom_globals_install.cpp - Generated bronze_host Globals Registration Wiring
// Emitted in lockstep with web_host.globals manifest from IDL declarations.

#pragma once

namespace bro::bronze_host {

// Registered host globals:
// Blob, File, FileReader, URL

inline void installDeclaredWebHostGlobals() {
    installFileGlobals();
    installFileReaderGlobals();
    installURLGlobals();
}

}  // namespace bro::bronze_host
