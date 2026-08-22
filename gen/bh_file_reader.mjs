// gen/bh_file_reader.mjs - bronze_host C++ Binding Emitter helper for FileReader
// Generates HostReader state, async read tasks, methods, constants, and HostClass wiring.

/**
 * Emits C++ definitions for HostReader struct, dtor, readerOf, setOn, and startRead task helper.
 * @returns {string}
 */
export function emitReaderStateAndHelpers() {
  return `// ---------------------------------------------------------------------------
// FileReader
// ---------------------------------------------------------------------------

struct HostReader {
    uint32_t tag = kHostReaderTag;  // must be first
    uint64_t generation = 0;        // bumped by abort() and by each new read
};

void hostReaderDtor(void* p) { delete static_cast<HostReader*>(p); }

HostReader* readerOf(Value v) {
    if (!ev::isObject(v)) return nullptr;
    auto* r = static_cast<HostReader*>(ev::handleData(v));
    if (!r || r->tag != kHostReaderTag) return nullptr;
    return r;
}

// Set a property on an object held in a Persistent, keeping the Persistent
// current: setProperty may MOVE the object and answers its new address.
void setOn(ev::Persistent& obj, const char* key, Value v) {
    obj.set(ev::setProperty(obj.get(), key, v));
}

// The one shape every read takes: latch a generation, queue the copy, and on
// the way out either publish \`result\` and fire load/loadend, or publish \`error\`
// and fire error/loadend. \`produce\` runs on the task, so it allocates safely.
void startRead(Value self, Value blobValue,
               std::function<Value(const std::vector<uint8_t>&)> produce) {
    HostReader* reader = readerOf(self);
    if (!reader) return;
    const HostBlob* blob = hostBlobOf(blobValue);

    ev::Persistent target(self);
    setOn(target, "readyState", ev::fromDouble(1));  // LOADING
    setOn(target, "result", ev::null());
    setOn(target, "error", ev::null());

    const uint64_t generation = ++reader->generation;
    // A copy, not a reference: the Blob value is not rooted by this closure and
    // the read must survive the program dropping it. Blobs are immutable and
    // usually small enough that this is the honest cost of the interface.
    std::vector<uint8_t> bytes = blob ? blob->bytes : std::vector<uint8_t>();
    const bool haveBlob = blob != nullptr;

    postHostTask([target, generation, bytes = std::move(bytes), haveBlob,
                  produce = std::move(produce)]() mutable {
        ev::Persistent self2(target);
        HostReader* r = readerOf(self2.get());
        // abort(), or a second read started before this one ran. Either way
        // this task's result is stale and must not be published — the web's
        // rule that a reader delivers exactly one terminal event per read.
        if (!r || r->generation != generation) return;

        r->generation = generation;
        setOn(self2, "readyState", ev::fromDouble(2));  // DONE
        if (!haveBlob) {
            ObjectBuilder err;
            err.set("name", ev::fromUtf8("NotFoundError"));
            err.set("message", ev::fromUtf8("FileReader: argument is not a Blob"));
            setOn(self2, "error", err.get());
            dispatchHostEvent(ev::Persistent(self2.get()), "error");
            dispatchHostEvent(ev::Persistent(self2.get()), "loadend");
            return;
        }
        setOn(self2, "result", produce(bytes));
        dispatchHostEvent(ev::Persistent(self2.get()), "load");
        dispatchHostEvent(ev::Persistent(self2.get()), "loadend");
    });
}

Value makeFileReaderValue() {
    auto* reader = new HostReader();
    ObjectBuilder b(g_readerClass.make(reader, hostReaderDtor));

    // Data properties first, so the shape is fixed before a read rewrites
    // them — the same reason host_image.cpp seeds width/height up front.
    { Value z = ev::fromDouble(0); b.set("readyState", z); }
    { Value n = ev::null(); b.set("result", n); }
    { Value n = ev::null(); b.set("error", n); }
    for (const char* slot : {"onload", "onerror", "onloadend", "onloadstart",
                             "onprogress", "onabort"}) {
        Value n = ev::null();
        b.set(slot, n);
    }
    return b.get();
}
`;
}

/**
 * Emits the FileReader prototype decoration function.
 * @param {Object} readerInterface - FileReader interface AST node
 * @returns {string}
 */
export function emitReaderProto(readerInterface) {
  return `// Everything a FileReader can DO, decorated once onto FileReader.prototype.
void decorateReaderProto(ObjectBuilder& b) {
    // The readyState constants sit on the prototype AND on the constructor,
    // which is where the web has them (\`reader.DONE\` and \`FileReader.DONE\`
    // both work); they are the same for every reader, so neither copy is
    // per-instance state.
    b.set("EMPTY", ev::fromDouble(0));
    b.set("LOADING", ev::fromDouble(1));
    b.set("DONE", ev::fromDouble(2));

    b.def("readAsText", 2, [](Value self, std::span<const Value> a) {
        // The encoding argument is accepted and ignored: the bytes a Blob holds
        // in this runtime came from UTF-8 sources, and a real transcoder here
        // would be a second, worse copy of the one brokit already has.
        startRead(self, argAt(a, 0), [](const std::vector<uint8_t>& bytes) {
            return ev::fromUtf8(std::string(bytes.begin(), bytes.end()));
        });
        return ev::undefined();
    });
    b.def("readAsArrayBuffer", 1, [](Value self, std::span<const Value> a) {
        startRead(self, argAt(a, 0), [](const std::vector<uint8_t>& bytes) {
            return bytesToArrayBuffer(bytes);
        });
        return ev::undefined();
    });
    b.def("readAsBinaryString", 1, [](Value self, std::span<const Value> a) {
        startRead(self, argAt(a, 0), [](const std::vector<uint8_t>& bytes) {
            // One character per BYTE, which is what the legacy method means —
            // not a UTF-8 decode.
            std::string s;
            s.reserve(bytes.size());
            for (uint8_t c : bytes) s += static_cast<char>(c);
            return ev::fromUtf8(s);
        });
        return ev::undefined();
    });
    b.def("readAsDataURL", 1, [](Value self, std::span<const Value> a) {
        const HostBlob* blob = hostBlobOf(argAt(a, 0));
        std::string mime = blob && !blob->type.empty() ? blob->type
                                                       : "application/octet-stream";
        startRead(self, argAt(a, 0),
                  [mime](const std::vector<uint8_t>& bytes) {
                      return ev::fromUtf8("data:" + mime + ";base64," +
                                          base64Encode(bytes));
                  });
        return ev::undefined();
    });
    b.def("abort", 0, [](Value self, std::span<const Value>) {
        HostReader* r = readerOf(self);
        if (!r) return ev::undefined();
        // Bumping the generation is the abort: the queued task finds a number
        // that is not its own and publishes nothing.
        ++r->generation;
        ev::Persistent target(self);
        setOn(target, "readyState", ev::fromDouble(2));
        setOn(target, "result", ev::null());
        dispatchHostEvent(ev::Persistent(target.get()), "abort");
        dispatchHostEvent(ev::Persistent(target.get()), "loadend");
        return ev::undefined();
    });

    b.def("addEventListener", 2, [](Value thisValue, std::span<const Value> a) {
        ev::Persistent self(thisValue);
        Value typeV = argAt(a, 0);
        if (ev::isObject(typeV)) return ev::undefined();
        addHostListener(self, ev::toUtf8(typeV), argAt(a, 1));
        return ev::undefined();
    });
    b.def("removeEventListener", 2, [](Value thisValue, std::span<const Value> a) {
        ev::Persistent self(thisValue);
        Value typeV = argAt(a, 0);
        if (ev::isObject(typeV)) return ev::undefined();
        removeHostListener(self, ev::toUtf8(typeV), argAt(a, 1));
        return ev::undefined();
    });
}
`;
}

/**
 * Emits the HostClass install block for FileReader inside installFileGlobals().
 * @returns {string}
 */
export function emitReaderInstallBlock() {
  return `    g_readerClass.install(
        "FileReader", 0,
        [](Value, std::span<const Value>) { return makeFileReaderValue(); },
        decorateReaderProto);
    // The web has the constants on the constructor too.
    g_readerClass.setStatic("EMPTY", ev::fromDouble(0));
    g_readerClass.setStatic("LOADING", ev::fromDouble(1));
    g_readerClass.setStatic("DONE", ev::fromDouble(2));`;
}
