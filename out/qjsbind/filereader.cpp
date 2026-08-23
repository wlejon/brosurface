#include "api/api.h"

namespace brokit::api {

static thread_local JSClassID file_reader_class_id = 0;

static void file_reader_finalizer(JSRuntime*, JSValue val)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque(val, file_reader_class_id));
    delete w;
}

static JSClassDef file_reader_class_def = { "FileReader", file_reader_finalizer };

static JSValue newGetter(JSContext* ctx, JSValue (*fn)(JSContext*, JSValueConst),
                          const char* name)
{
    JSCFunctionType ft;
    ft.getter = fn;
    return JS_NewCFunction2(ctx, ft.generic, name, 0, JS_CFUNC_getter, 0);
}

static JSValue file_reader_read_as_array_buffer(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "readAsArrayBuffer(blob)");

    JSValueConst blob = argv[0];

    return JS_UNDEFINED;
}

static JSValue file_reader_read_as_binary_string(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "readAsBinaryString(blob)");

    JSValueConst blob = argv[0];

    return JS_UNDEFINED;
}

static JSValue file_reader_read_as_text(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "readAsText(blob, encoding)");

    JSValueConst blob = argv[0];
    std::string encoding = "";
    if (argc > 1 && !JS_IsUndefined(argv[1])) {
        const char* encoding_cstr = JS_ToCString(ctx, argv[1]);
        if (!encoding_cstr) return JS_EXCEPTION;
        encoding = encoding_cstr;
        JS_FreeCString(ctx, encoding_cstr);
    }

    return JS_UNDEFINED;
}

static JSValue file_reader_read_as_data_url(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 1)
        return JS_ThrowTypeError(ctx, "readAsDataURL(blob)");

    JSValueConst blob = argv[0];

    return JS_UNDEFINED;
}

static JSValue file_reader_abort(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;

    return JS_UNDEFINED;
}

static JSValue file_reader_add_event_listener(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "addEventListener(type, listener)");

    const char* type_cstr = JS_ToCString(ctx, argv[0]);
    if (!type_cstr) return JS_EXCEPTION;
    std::string type = type_cstr;
    JS_FreeCString(ctx, type_cstr);
    JSValueConst listener = argv[1];

    return JS_UNDEFINED;
}

static JSValue file_reader_remove_event_listener(JSContext* ctx, JSValueConst this_val,
                                    int argc, JSValueConst* argv)
{
    auto* w = static_cast<FileReaderWrapper*>(JS_GetOpaque2(ctx, this_val, file_reader_class_id));
    if (!w) return JS_EXCEPTION;
    if (argc < 2)
        return JS_ThrowTypeError(ctx, "removeEventListener(type, listener)");

    const char* type_cstr = JS_ToCString(ctx, argv[0]);
    if (!type_cstr) return JS_EXCEPTION;
    std::string type = type_cstr;
    JS_FreeCString(ctx, type_cstr);
    JSValueConst listener = argv[1];

    return JS_UNDEFINED;
}

static JSValue js_file_reader_readyState(JSContext* ctx, JSValueConst this_val)
{
    return JS_NewUint32(ctx, static_cast<uint32_t>(0));
}

static JSValue js_file_reader_result(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_error(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_onloadstart(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_onprogress(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_onload(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_onabort(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_onerror(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_onloadend(JSContext* ctx, JSValueConst this_val)
{
    return 0;
}

static JSValue js_file_reader_constructor(JSContext* ctx, JSValueConst new_target,
                                    int argc, JSValueConst* argv)
{
    JSValue proto = JS_GetPropertyStr(ctx, new_target, "prototype");
    if (JS_IsException(proto)) return proto;
    JSValue obj = JS_NewObjectProtoClass(ctx, proto, file_reader_class_id);
    JS_FreeValue(ctx, proto);
    return obj;
}

void installFileReader(JSContext* ctx)
{
    JSRuntime* rt = JS_GetRuntime(ctx);
    JSValue global = JS_GetGlobalObject(ctx);

    // Register FileReader class
    if (file_reader_class_id == 0) JS_NewClassID(rt, &file_reader_class_id);
    JS_NewClass(rt, file_reader_class_id, &file_reader_class_def);

    JSValue file_readerProto = JS_NewObject(ctx);

    JSAtom file_reader_readyState_atom = JS_NewAtom(ctx, "readyState");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_readyState_atom,
                            newGetter(ctx, js_file_reader_readyState, "readyState"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_readyState_atom);
    JSAtom file_reader_result_atom = JS_NewAtom(ctx, "result");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_result_atom,
                            newGetter(ctx, js_file_reader_result, "result"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_result_atom);
    JSAtom file_reader_error_atom = JS_NewAtom(ctx, "error");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_error_atom,
                            newGetter(ctx, js_file_reader_error, "error"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_error_atom);
    JSAtom file_reader_onloadstart_atom = JS_NewAtom(ctx, "onloadstart");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_onloadstart_atom,
                            newGetter(ctx, js_file_reader_onloadstart, "onloadstart"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_onloadstart_atom);
    JSAtom file_reader_onprogress_atom = JS_NewAtom(ctx, "onprogress");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_onprogress_atom,
                            newGetter(ctx, js_file_reader_onprogress, "onprogress"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_onprogress_atom);
    JSAtom file_reader_onload_atom = JS_NewAtom(ctx, "onload");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_onload_atom,
                            newGetter(ctx, js_file_reader_onload, "onload"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_onload_atom);
    JSAtom file_reader_onabort_atom = JS_NewAtom(ctx, "onabort");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_onabort_atom,
                            newGetter(ctx, js_file_reader_onabort, "onabort"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_onabort_atom);
    JSAtom file_reader_onerror_atom = JS_NewAtom(ctx, "onerror");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_onerror_atom,
                            newGetter(ctx, js_file_reader_onerror, "onerror"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_onerror_atom);
    JSAtom file_reader_onloadend_atom = JS_NewAtom(ctx, "onloadend");
    JS_DefinePropertyGetSet(ctx, file_readerProto, file_reader_onloadend_atom,
                            newGetter(ctx, js_file_reader_onloadend, "onloadend"),
                            JS_UNDEFINED, 0);
    JS_FreeAtom(ctx, file_reader_onloadend_atom);

    JS_SetPropertyStr(ctx, file_readerProto, "readAsArrayBuffer",
        JS_NewCFunction(ctx, file_reader_read_as_array_buffer, "readAsArrayBuffer", 1));
    JS_SetPropertyStr(ctx, file_readerProto, "readAsBinaryString",
        JS_NewCFunction(ctx, file_reader_read_as_binary_string, "readAsBinaryString", 1));
    JS_SetPropertyStr(ctx, file_readerProto, "readAsText",
        JS_NewCFunction(ctx, file_reader_read_as_text, "readAsText", 2));
    JS_SetPropertyStr(ctx, file_readerProto, "readAsDataURL",
        JS_NewCFunction(ctx, file_reader_read_as_data_url, "readAsDataURL", 1));
    JS_SetPropertyStr(ctx, file_readerProto, "abort",
        JS_NewCFunction(ctx, file_reader_abort, "abort", 0));
    JS_SetPropertyStr(ctx, file_readerProto, "addEventListener",
        JS_NewCFunction(ctx, file_reader_add_event_listener, "addEventListener", 2));
    JS_SetPropertyStr(ctx, file_readerProto, "removeEventListener",
        JS_NewCFunction(ctx, file_reader_remove_event_listener, "removeEventListener", 2));

    JS_SetClassProto(ctx, file_reader_class_id, file_readerProto);

    JSValue file_readerCtor = JS_NewCFunction2(ctx, js_file_reader_constructor, "FileReader", 0,
                                         JS_CFUNC_constructor, 0);
    file_readerProto = JS_GetClassProto(ctx, file_reader_class_id);
    JS_SetPropertyStr(ctx, file_readerCtor, "prototype", JS_DupValue(ctx, file_readerProto));
    JS_SetPropertyStr(ctx, file_readerProto, "constructor", JS_DupValue(ctx, file_readerCtor));
    JS_FreeValue(ctx, file_readerProto);

    JS_SetPropertyStr(ctx, global, "FileReader", file_readerCtor);

    JS_FreeValue(ctx, global);
}

} // namespace brokit::api
