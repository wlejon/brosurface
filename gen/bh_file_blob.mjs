// gen/bh_file_blob.mjs - bronze_host C++ Binding Emitter helper for Blob and File
// Generates HostBlob state, methods, accessors, constructors, and HostClass wiring.

/**
 * Emits C++ helper functions for Blob/File part collection, type extraction, and base64 encoding.
 * @returns {string}
 */
export function emitBlobHelpers() {
  return `void hostBlobDtor(void* p) { delete static_cast<HostBlob*>(p); }

HostBlob* mutableHostBlob(Value v) {
    if (!ev::isObject(v)) return nullptr;
    auto* b = static_cast<HostBlob*>(ev::handleData(v));
    if (!b || b->tag != kHostBlobTag) return nullptr;
    return b;
}

// ---------------------------------------------------------------------------
// Assembling a Blob's bytes out of whatever the program passed
// ---------------------------------------------------------------------------

void appendPart(std::vector<uint8_t>& out, Value part) {
    if (const HostBlob* nested = hostBlobOf(part)) {
        out.insert(out.end(), nested->bytes.begin(), nested->bytes.end());
        return;
    }
    if (ev::isTypedArray(part)) {
        ev::TypedArrayInfo info = ev::typedArrayInfo(part);
        if (info) out.insert(out.end(), info.data, info.data + info.byteLength);
        return;
    }
    if (ev::isArrayBuffer(part)) {
        ev::ArrayBufferInfo info = ev::arrayBufferInfo(part);
        if (info) out.insert(out.end(), info.data, info.data + info.byteLength);
        return;
    }
    if (ev::isUndefined(part) || ev::isNull(part)) return;
    // Anything else stringifies, which is what the web does — \`new
    // Blob([42])\` is the two bytes of "42".
    const std::string s = ev::toUtf8(part);
    out.insert(out.end(), s.begin(), s.end());
}

// \`parts\` is an array-like. It is walked through getProperty/getElement rather
// than any host-side array reader, because what the program passes is a real
// JS array and its elements may be getters.
std::vector<uint8_t> collectParts(Value partsValue) {
    std::vector<uint8_t> out;
    if (!ev::isObject(partsValue)) return out;

    ev::Persistent parts(partsValue);
    const double lenD = ev::toDouble(ev::getProperty(parts.get(), "length"));
    if (!(lenD > 0)) return out;
    const uint32_t len = static_cast<uint32_t>(lenD);
    for (uint32_t i = 0; i < len; ++i) {
        // Re-read through the Persistent each turn: getElement allocates, and
        // the array may have moved since the previous iteration.
        appendPart(out, ev::getElement(parts.get(), i));
    }
    return out;
}

std::string optionType(Value options) {
    if (!ev::isObject(options)) return {};
    Value t = ev::getProperty(options, "type");
    if (ev::isUndefined(t) || ev::isNull(t) || ev::isObject(t)) return {};
    return ev::toUtf8(t);
}

// ---------------------------------------------------------------------------
// base64, for readAsDataURL
// ---------------------------------------------------------------------------

std::string base64Encode(const std::vector<uint8_t>& in) {
    static const char* kAlphabet =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve(((in.size() + 2) / 3) * 4);
    size_t i = 0;
    for (; i + 2 < in.size(); i += 3) {
        const uint32_t n = (uint32_t(in[i]) << 16) | (uint32_t(in[i + 1]) << 8) |
                           uint32_t(in[i + 2]);
        out += kAlphabet[(n >> 18) & 63];
        out += kAlphabet[(n >> 12) & 63];
        out += kAlphabet[(n >> 6) & 63];
        out += kAlphabet[n & 63];
    }
    if (i + 1 == in.size()) {
        const uint32_t n = uint32_t(in[i]) << 16;
        out += kAlphabet[(n >> 18) & 63];
        out += kAlphabet[(n >> 12) & 63];
        out += "==";
    } else if (i + 2 == in.size()) {
        const uint32_t n = (uint32_t(in[i]) << 16) | (uint32_t(in[i + 1]) << 8);
        out += kAlphabet[(n >> 18) & 63];
        out += kAlphabet[(n >> 12) & 63];
        out += kAlphabet[(n >> 6) & 63];
        out += '=';
    }
    return out;
}
`;
}

/**
 * Emits the Blob prototype decoration, methods, and HostClass instance variables.
 * @param {Object} blobInterface - Blob interface AST node
 * @param {Object} fileInterface - File interface AST node
 * @returns {string}
 */
export function emitBlobMethodsAndClasses(blobInterface, fileInterface) {
  return `// ---------------------------------------------------------------------------
// The Blob surface
// ---------------------------------------------------------------------------

Value resolvedPromise(Value v) {
    ev::Persistent value(v);
    ev::Persistent p(ev::createPromise());
    ev::resolvePromise(p.get(), value.get());
    return p.get();
}

Value bytesToArrayBuffer(const std::vector<uint8_t>& bytes) {
    return ev::createArrayBuffer(std::span<const uint8_t>(bytes.data(), bytes.size()));
}

Value bytesToUint8Array(const std::vector<uint8_t>& bytes) {
    ev::Persistent view(ev::createTypedArray(ev::elements::Uint8,
                                             static_cast<uint32_t>(bytes.size())));
    // fillTypedArray does NOT allocate, so the view cannot have moved between
    // the two calls — but it is read back through the Persistent anyway,
    // because that invariant belongs to embed and not to this file.
    ev::fillTypedArray(view.get(), std::span<const uint8_t>(bytes.data(), bytes.size()));
    return view.get();
}

// The per-instance STATE of a Blob. Everything else a Blob can do is the same
// for every Blob and lives on the prototype below.
void installBlobState(ObjectBuilder& b, const HostBlob* blob) {
    b.set("size", ev::fromDouble(static_cast<double>(blob->bytes.size())));
    b.set("type", ev::fromUtf8(blob->type));
}

// The Blob METHODS, decorated once onto Blob.prototype. Each unwraps its
// RECEIVER rather than closing over a HostBlob* — which is not only tidier: a
// closure holding the raw payload of a cell it does not root is a dangling
// read the moment a detached method outlives its object, and every one of
// these used to be written that way.
void decorateBlobProto(ObjectBuilder& b) {
    b.def("slice", 3, [](Value self, std::span<const Value> a) {
        const HostBlob* blob = mutableHostBlob(self);
        if (!blob) return ev::throwTypeError("Blob.slice: the receiver is not a Blob");
        const double n = static_cast<double>(blob->bytes.size());
        // Negative offsets count from the end, as Array.prototype.slice does
        // and as the Blob spec spells out.
        auto clamp = [n](Value v, double dflt) {
            if (ev::isUndefined(v)) return dflt;
            double x = ev::toDouble(v);
            if (!(x == x)) return 0.0;  // NaN
            if (x < 0) x = n + x;
            return x < 0 ? 0.0 : (x > n ? n : x);
        };
        const double start = clamp(argAt(a, 0), 0.0);
        const double end = clamp(argAt(a, 1), n);
        Value typeV = argAt(a, 2);
        std::string type =
            (ev::isUndefined(typeV) || ev::isObject(typeV)) ? "" : ev::toUtf8(typeV);
        std::vector<uint8_t> cut;
        if (end > start) {
            cut.assign(blob->bytes.begin() + static_cast<ptrdiff_t>(start),
                       blob->bytes.begin() + static_cast<ptrdiff_t>(end));
        }
        return makeBlobValue(std::move(cut), std::move(type));
    });

    b.def("text", 0, [](Value self, std::span<const Value>) {
        const HostBlob* blob = mutableHostBlob(self);
        if (!blob) return ev::throwTypeError("Blob.text: the receiver is not a Blob");
        return resolvedPromise(ev::fromUtf8(
            std::string(blob->bytes.begin(), blob->bytes.end())));
    });
    b.def("arrayBuffer", 0, [](Value self, std::span<const Value>) {
        const HostBlob* blob = mutableHostBlob(self);
        if (!blob) {
            return ev::throwTypeError("Blob.arrayBuffer: the receiver is not a Blob");
        }
        return resolvedPromise(bytesToArrayBuffer(blob->bytes));
    });
    b.def("bytes", 0, [](Value self, std::span<const Value>) {
        const HostBlob* blob = mutableHostBlob(self);
        if (!blob) return ev::throwTypeError("Blob.bytes: the receiver is not a Blob");
        return resolvedPromise(bytesToUint8Array(blob->bytes));
    });
}

// The three classes this file installs. File EXTENDS Blob, as on the web.
HostClass g_blobClass;
HostClass g_fileClass;
HostClass g_readerClass;
`;
}

/**
 * Emits the public API functions for makeFileFromPath, hostBlobOf, and makeBlobValue.
 * @returns {string}
 */
export function emitBlobPublicApi() {
  return `// ---------------------------------------------------------------------------
// The pieces other files use
// ---------------------------------------------------------------------------

Value makeFileFromPath(const std::string& path) {
    std::error_code ec;
    const std::filesystem::path fsPath(path);

    std::ifstream in(fsPath, std::ios::binary);
    if (!in) return ev::undefined();
    std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(in)),
                               std::istreambuf_iterator<char>());
    if (in.bad()) return ev::undefined();

    auto* blob = new HostBlob();
    blob->bytes = std::move(bytes);
    blob->isFile = true;
    blob->name = fsPath.filename().string();
    blob->type = mimeForName(blob->name);
    // Best effort, and zero when the clock is unreadable: \`lastModified\` is
    // metadata a drop handler may print, never something it branches on.
    const auto mtime = std::filesystem::last_write_time(fsPath, ec);
    if (!ec) {
        blob->lastModified = static_cast<double>(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                mtime.time_since_epoch()).count());
    }

    ObjectBuilder b(g_fileClass.make(blob, hostBlobDtor));
    installBlobState(b, blob);
    b.set("name", ev::fromUtf8(blob->name));
    b.set("lastModified", ev::fromDouble(blob->lastModified));
    b.set("webkitRelativePath", ev::fromUtf8(""));
    // Where it came from. Not a web property, and deliberately kept: a drop is
    // the one moment a page is handed a real filesystem path (docs/paths-api.js),
    // and the interpreted realm hands one over too.
    b.set("path", ev::fromUtf8(path));
    return b.get();
}
// ---------------------------------------------------------------------------

const HostBlob* hostBlobOf(Value v) { return mutableHostBlob(v); }

Value makeBlobValue(std::vector<uint8_t> bytes, std::string type) {
    auto* blob = new HostBlob();
    blob->bytes = std::move(bytes);
    blob->type = std::move(type);
    ObjectBuilder b(g_blobClass.make(blob, hostBlobDtor));
    installBlobState(b, blob);
    return b.get();
}
`;
}

/**
 * Emits the HostClass install block for Blob and File inside installFileGlobals().
 * @returns {string}
 */
export function emitBlobInstallBlock() {
  return `    g_blobClass.install(
        "Blob", 2,
        [](Value, std::span<const Value> a) {
            std::vector<uint8_t> bytes = collectParts(argAt(a, 0));
            return makeBlobValue(std::move(bytes), optionType(argAt(a, 1)));
        },
        decorateBlobProto);

    g_fileClass.install(
        "File", 3,
        [](Value, std::span<const Value> a) {
            auto* blob = new HostBlob();
            blob->bytes = collectParts(argAt(a, 0));
            blob->isFile = true;
            Value nameV = argAt(a, 1);
            blob->name = (ev::isObject(nameV) || ev::isUndefined(nameV))
                             ? "" : ev::toUtf8(nameV);
            Value options = argAt(a, 2);
            blob->type = optionType(options);
            if (ev::isObject(options)) {
                Value lm = ev::getProperty(options, "lastModified");
                if (!ev::isUndefined(lm)) blob->lastModified = ev::toDouble(lm);
            }

            ObjectBuilder b(g_fileClass.make(blob, hostBlobDtor));
            installBlobState(b, blob);
            b.set("name", ev::fromUtf8(blob->name));
            b.set("lastModified", ev::fromDouble(blob->lastModified));
            // webkitRelativePath is empty for a File the program built, and
            // present because file-input code reads it unconditionally.
            b.set("webkitRelativePath", ev::fromUtf8(""));
            return b.get();
        },
        // A File carries no methods of its own: it inherits Blob's, through
        // the chain below.
        nullptr);
    // \`file instanceof Blob\` is true on the web, and a File really does answer
    // slice/text/arrayBuffer. One chain buys both.
    g_fileClass.inherit(g_blobClass);`;
}
