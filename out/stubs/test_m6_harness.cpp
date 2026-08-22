#include "js/feature_stub.h"
#include "js/lm_bindings.h"
#include <cassert>
#include <iostream>
#include <string>

// Include the generated stub TU directly
#include "feature_stubs.cpp"

int main() {
    std::cout << "[Test Harness] Initializing QuickJS runtime and context..." << std::endl;
    JSRuntime* rt = JS_NewRuntime();
    assert(rt != nullptr);
    JSContext* ctx = JS_NewContext(rt);
    assert(ctx != nullptr);

    std::cout << "[Test Harness] Installing generated lm stub bindings (BRO_WITH_LM=0)..." << std::endl;
    bro::js::installLmBindings(ctx);

    // Test 1: Feature detection property
    std::cout << "[Test Harness] Checking bro.lm.available property..." << std::endl;
    JSValue r1 = JS_Eval(ctx, "bro.lm.available === false", 26, "<test>", JS_EVAL_TYPE_GLOBAL);
    int isAvailFalse = JS_ToBool(ctx, r1);
    JS_FreeValue(ctx, r1);
    assert(isAvailFalse == 1);
    std::cout << "  ✅ PASS: bro.lm.available === false" << std::endl;

    // Test 2: Calling methods on stub throws clear "compiled without BRO_WITH_LM" error
    std::cout << "[Test Harness] Testing calling methods on stub proxy..." << std::endl;
    JSValue r2 = JS_Eval(ctx, "try { bro.lm.loadQwen(); false; } catch (e) { e.message; }", 57, "<test>", JS_EVAL_TYPE_GLOBAL);
    const char* errStr = JS_ToCString(ctx, r2);
    std::string errMsg = errStr ? errStr : "";
    JS_FreeCString(ctx, errStr);
    JS_FreeValue(ctx, r2);

    std::cout << "  Received exception: \"" << errMsg << "\"" << std::endl;
    assert(errMsg == "bro.lm is unavailable: this build was compiled without BRO_WITH_LM");
    std::cout << "  ✅ PASS: Caught expected unavailable exception on bro.lm.loadQwen()" << std::endl;

    // Test 3: Calling generate on stub throws same clear error
    JSValue r3 = JS_Eval(ctx, "try { bro.lm.generate(); false; } catch (e) { e.message; }", 57, "<test>", JS_EVAL_TYPE_GLOBAL);
    const char* errStr2 = JS_ToCString(ctx, r3);
    std::string errMsg2 = errStr2 ? errStr2 : "";
    JS_FreeCString(ctx, errStr2);
    JS_FreeValue(ctx, r3);
    assert(errMsg2 == "bro.lm is unavailable: this build was compiled without BRO_WITH_LM");
    std::cout << "  ✅ PASS: Caught expected unavailable exception on bro.lm.generate()" << std::endl;

    JS_FreeContext(ctx);
    JS_FreeRuntime(rt);
    std::cout << "[Test Harness] Teardown clean." << std::endl;
    return 0;
}
