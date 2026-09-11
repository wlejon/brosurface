struct BroDOMParserImpl {
    int dummy = 0;
};

extern "C" {

void* bro_DOMParser_create(void) {
    return new BroDOMParserImpl();
}

void bro_DOMParser_destroy(void* self) {
    delete static_cast<BroDOMParserImpl*>(self);
}

void* bro_DOMParser_parseFromString(void* /*self*/, const char* /*str*/, const char* /*type*/) {
    return nullptr;
}

} // extern "C"
