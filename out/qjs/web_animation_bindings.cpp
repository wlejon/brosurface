#include "js/web_animation_bindings.h"
#include "js/dom_bindings_internal.h"
#include "js/runtime.h"
#include "engine/engine.h"
#include "engine/css_transitions.h"
#include "engine/web_animations.h"
#include "util/log.h"
#include <qjsbind/qjsbind.h>
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

namespace bro::js {

using bro::engine::WebAnimation;
using bro::engine::WebAnimationManager;
using bro::engine::CssPropertyId;
using bro::engine::KeyframeProperty;
using bro::engine::AnimationFillMode;
using bro::engine::AnimationDirection;

namespace {

struct AnimationJS {
    JSContext* ctx = nullptr;
    uint64_t id = 0;
    std::string customId;
    JSValue onfinish = JS_UNDEFINED;
    JSValue oncancel = JS_UNDEFINED;
    JSValue finishedPromise = JS_UNDEFINED;
    JSValue finishedResolve = JS_UNDEFINED;
    JSValue finishedReject = JS_UNDEFINED;
    bool finishedSettled = false;
    ~AnimationJS();
};

std::unordered_map<uint64_t, JSValue>& wrapperMirror() {
    static std::unordered_map<uint64_t, JSValue> m;
    return m;
}

std::unordered_map<uint64_t, JSValue>& strongPins() {
    static std::unordered_map<uint64_t, JSValue> m;
    return m;
}

AnimationJS::~AnimationJS() {
    wrapperMirror().erase(id);
    if (ctx) {
        JSRuntime* rt = JS_GetRuntime(ctx);
        if (!JS_IsUndefined(onfinish)) JS_FreeValueRT(rt, onfinish);
        if (!JS_IsUndefined(oncancel)) JS_FreeValueRT(rt, oncancel);
        if (!JS_IsUndefined(finishedPromise)) JS_FreeValueRT(rt, finishedPromise);
        if (!JS_IsUndefined(finishedResolve)) JS_FreeValueRT(rt, finishedResolve);
        if (!JS_IsUndefined(finishedReject)) JS_FreeValueRT(rt, finishedReject);
    }
}

void pinWrapper(JSContext* ctx, uint64_t id, JSValueConst obj) {
    auto& pins = strongPins();
    if (pins.find(id) == pins.end()) {
        pins[id] = JS_DupValue(ctx, obj);
    }
}

void unpinWrapper(JSContext* ctx, uint64_t id) {
    auto& pins = strongPins();
    auto it = pins.find(id);
    if (it != pins.end()) {
        JS_FreeValue(ctx, it->second);
        pins.erase(it);
    }
}

bro::engine::Engine* engineFor(JSContext* ctx) {
    return getEngineForCtx(ctx);
}

double nowFor(JSContext* ctx) {
    auto* eng = engineFor(ctx);
    return eng ? eng->currentTimeSec() : 0.0;
}

WebAnimation* recordFor(JSContext* ctx, uint64_t id) {
    auto* eng = engineFor(ctx);
    if (!eng) return nullptr;
    return eng->webAnimations().find(id);
}

void markTargetDirty(JSContext* ctx, const WebAnimation* anim) {
    if (!anim || !anim->target) return;
    auto* eng = engineFor(ctx);
    if (!eng) return;
    eng->webAnimations().onAnimationMutated(anim->id, anim->target);
}

JSValue makeAbortError(JSContext* ctx, const char* msg) {
    JSValue err = JS_NewError(ctx);
    JS_SetPropertyStr(ctx, err, "name", JS_NewString(ctx, "AbortError"));
    JS_SetPropertyStr(ctx, err, "message", JS_NewString(ctx, msg));
    return err;
}

void dropFinishedPromise(JSContext* ctx, AnimationJS* a) {
    if (ctx && !JS_IsUndefined(a->finishedPromise)) {
        JS_FreeValue(ctx, a->finishedPromise);
        JS_FreeValue(ctx, a->finishedResolve);
        JS_FreeValue(ctx, a->finishedReject);
        a->finishedPromise = JS_UNDEFINED;
        a->finishedResolve = JS_UNDEFINED;
        a->finishedReject  = JS_UNDEFINED;
    }
    a->finishedSettled = false;
}

void resolveFinishedPromise(JSContext* ctx, AnimationJS* a, JSValueConst selfObj) {
    if (JS_IsUndefined(a->finishedPromise) || a->finishedSettled) return;
    a->finishedSettled = true;
    if (!JS_IsUndefined(a->finishedResolve)) {
        JSValue arg = JS_DupValue(ctx, selfObj);
        JSValue ret = JS_Call(ctx, a->finishedResolve, JS_UNDEFINED, 1, &arg);
        JS_FreeValue(ctx, ret);
        JS_FreeValue(ctx, arg);
    }
}

void rejectFinishedPromise(JSContext* ctx, AnimationJS* a, JSValue errorVal) {
    if (JS_IsUndefined(a->finishedPromise) || a->finishedSettled) {
        JS_FreeValue(ctx, errorVal);
        return;
    }
    a->finishedSettled = true;
    if (!JS_IsUndefined(a->finishedReject)) {
        JSValue ret = JS_Call(ctx, a->finishedReject, JS_UNDEFINED, 1, &errorVal);
        JS_FreeValue(ctx, ret);
    }
    JS_FreeValue(ctx, errorVal);
}

void freshenPromiseIfSettled(AnimationJS* a) {
    if (!a->finishedSettled) return;
    if (a->ctx) dropFinishedPromise(a->ctx, a);
}

void fireHandler(JSContext* ctx, JSValueConst handler, JSValueConst selfObj,
                 const char* typeName) {
    if (!JS_IsFunction(ctx, handler)) return;
    JSValue ev = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, ev, "type", JS_NewString(ctx, typeName));
    JS_SetPropertyStr(ctx, ev, "target", JS_DupValue(ctx, selfObj));
    JS_SetPropertyStr(ctx, ev, "currentTarget", JS_DupValue(ctx, selfObj));
    JSValue ret = Runtime::callJs(ctx, handler, selfObj, 1, &ev,
                                  ErrorOrigin::listener("WebAnimation"));
    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, ev);
}

void settleFinish(JSContext* ctx, AnimationJS* a, JSValueConst selfObj) {
    resolveFinishedPromise(ctx, a, selfObj);
    if (!JS_IsUndefined(a->onfinish)) {
        fireHandler(ctx, a->onfinish, selfObj, "finish");
    }
    unpinWrapper(ctx, a->id);
}

JSValue wrapAnimation(JSContext* ctx, uint64_t id, const std::string& customId) {
    auto it = wrapperMirror().find(id);
    if (it != wrapperMirror().end()) {
        return JS_DupValue(ctx, it->second);
    }
    auto* a = new AnimationJS();
    a->ctx = ctx;
    a->id = id;
    a->customId = customId;
    JSValue obj = qjsbind::wrap<AnimationJS>(ctx, a);
    if (JS_IsException(obj)) {
        return obj;
    }
    wrapperMirror()[id] = obj;
    pinWrapper(ctx, id, obj);
    return obj;
}

CssPropertyId keyToCssProp(const std::string& key) {
    if (key == "opacity") return CssPropertyId::Opacity;
    if (key == "transform") return CssPropertyId::Transform;
    if (key == "backgroundColor" || key == "background-color")
        return CssPropertyId::BackgroundColor;
    if (key == "color") return CssPropertyId::Color;
    if (key == "width") return CssPropertyId::Width;
    if (key == "height") return CssPropertyId::Height;
    if (key == "top") return CssPropertyId::Top;
    if (key == "left") return CssPropertyId::Left;
    if (key == "right") return CssPropertyId::Right;
    if (key == "bottom") return CssPropertyId::Bottom;
    if (key == "margin" || key == "marginTop" || key == "margin-top")
        return CssPropertyId::MarginTop;
    if (key == "marginBottom" || key == "margin-bottom")
        return CssPropertyId::MarginBottom;
    if (key == "marginLeft" || key == "margin-left")
        return CssPropertyId::MarginLeft;
    if (key == "marginRight" || key == "margin-right")
        return CssPropertyId::MarginRight;
    if (key == "padding" || key == "paddingTop" || key == "padding-top")
        return CssPropertyId::PaddingTop;
    if (key == "paddingBottom" || key == "padding-bottom")
        return CssPropertyId::PaddingBottom;
    if (key == "paddingLeft" || key == "padding-left")
        return CssPropertyId::PaddingLeft;
    if (key == "paddingRight" || key == "padding-right")
        return CssPropertyId::PaddingRight;
    return CssPropertyId::Unknown;
}

std::string valueToCss(JSContext* ctx, JSValueConst v) {
    if (JS_IsNumber(v)) {
        double d = 0;
        JS_ToFloat64(ctx, &d, v);
        char buf[64];
        std::snprintf(buf, sizeof(buf), "%.6g", d);
        return std::string(buf);
    }
    return jsToStdString(ctx, v);
}

void computeOffsets(std::vector<double>& offsets) {
    size_t n = offsets.size();
    if (n == 0) return;
    if (n == 1) { if (std::isnan(offsets[0])) offsets[0] = 1.0; return; }
    if (std::isnan(offsets[0])) offsets[0] = 0.0;
    if (std::isnan(offsets[n - 1])) offsets[n - 1] = 1.0;
    size_t i = 0;
    while (i < n) {
        if (!std::isnan(offsets[i])) { ++i; continue; }
        size_t start = i - 1;
        size_t end = i;
        while (end < n && std::isnan(offsets[end])) ++end;
        double startVal = offsets[start];
        double endVal = offsets[end];
        double step = (endVal - startVal) / (double)(end - start);
        for (size_t k = i; k < end; ++k) {
            offsets[k] = startVal + step * (double)(k - start);
        }
        i = end;
    }
}

bool parseKeyframeArray(JSContext* ctx, JSValueConst arr, uint32_t len,
                        std::vector<KeyframeProperty>& outProps,
                        std::string& defaultEasing) {
    struct RawKf {
        double offset = NAN;
        std::string easing;
        std::vector<std::pair<CssPropertyId, std::string>> props;
    };
    std::vector<RawKf> kfs;
    kfs.reserve(len);
    for (uint32_t i = 0; i < len; ++i) {
        JSValue item = JS_GetPropertyUint32(ctx, arr, i);
        if (!JS_IsObject(item)) { JS_FreeValue(ctx, item); continue; }
        RawKf kf;
        JSPropertyEnum* tab = nullptr;
        uint32_t plen = 0;
        if (JS_GetOwnPropertyNames(ctx, &tab, &plen, item,
                                   JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY) >= 0) {
            for (uint32_t p = 0; p < plen; ++p) {
                const char* key = JS_AtomToCString(ctx, tab[p].atom);
                if (!key) continue;
                JSValue val = JS_GetProperty(ctx, item, tab[p].atom);
                std::string k(key);
                JS_FreeCString(ctx, key);
                if (k == "offset") {
                    double off = 0;
                    if (!JS_IsNull(val) && !JS_IsUndefined(val) &&
                        JS_ToFloat64(ctx, &off, val) == 0) {
                        kf.offset = off;
                    }
                } else if (k == "easing") {
                    kf.easing = jsToStdString(ctx, val);
                } else {
                    CssPropertyId id = keyToCssProp(k);
                    if (id != CssPropertyId::Unknown) {
                        kf.props.push_back({id, valueToCss(ctx, val)});
                    }
                }
                JS_FreeValue(ctx, val);
            }
            js_free_prop_enum(ctx, tab, plen);
        }
        JS_FreeValue(ctx, item);
        kfs.push_back(std::move(kf));
    }
    if (kfs.empty()) return false;
    std::vector<double> offs(kfs.size());
    for (size_t i = 0; i < kfs.size(); ++i) offs[i] = kfs[i].offset;
    computeOffsets(offs);
    for (size_t i = 0; i < kfs.size(); ++i) {
        double off = std::clamp(offs[i], 0.0, 1.0);
        const std::string& ease = kfs[i].easing.empty() ? defaultEasing : kfs[i].easing;
        for (auto& [propId, cssVal] : kfs[i].props) {
            KeyframeProperty* bucket = nullptr;
            for (auto& bp : outProps) {
                if (bp.prop == propId) { bucket = &bp; break; }
            }
            if (!bucket) {
                outProps.push_back(KeyframeProperty{});
                bucket = &outProps.back();
                bucket->prop = propId;
            }
            bucket->frames.push_back(bro::engine::Keyframe{
                off, cssVal, ease, {}
            });
        }
    }
    for (auto& bp : outProps) {
        std::sort(bp.frames.begin(), bp.frames.end(),
                  [](const auto& a, const auto& b) { return a.offset < b.offset; });
    }
    return !outProps.empty();
}

bool parseKeyframeObject(JSContext* ctx, JSValueConst obj,
                         std::vector<KeyframeProperty>& outProps,
                         std::string& defaultEasing) {
    JSPropertyEnum* tab = nullptr;
    uint32_t plen = 0;
    if (JS_GetOwnPropertyNames(ctx, &tab, &plen, obj,
                               JS_GPN_STRING_MASK | JS_GPN_ENUM_ONLY) < 0) {
        return false;
    }
    std::vector<double> userOffsets;
    std::string objEasing;
    for (uint32_t p = 0; p < plen; ++p) {
        const char* key = JS_AtomToCString(ctx, tab[p].atom);
        if (!key) continue;
        std::string k(key);
        JS_FreeCString(ctx, key);
        if (k == "offset") {
            JSValue val = JS_GetProperty(ctx, obj, tab[p].atom);
            if (JS_IsArray(val)) {
                uint32_t alen = getArrayLength(ctx, val);
                userOffsets.resize(alen);
                for (uint32_t i = 0; i < alen; ++i) {
                    JSValue iv = JS_GetPropertyUint32(ctx, val, i);
                    double off = 0;
                    if (JS_ToFloat64(ctx, &off, iv) == 0) userOffsets[i] = off;
                    else userOffsets[i] = NAN;
                    JS_FreeValue(ctx, iv);
                }
            } else if (JS_IsNumber(val)) {
                double off = 0; JS_ToFloat64(ctx, &off, val);
                userOffsets.push_back(off);
            }
            JS_FreeValue(ctx, val);
        } else if (k == "easing") {
            JSValue val = JS_GetProperty(ctx, obj, tab[p].atom);
            objEasing = jsToStdString(ctx, val);
            JS_FreeValue(ctx, val);
        }
    }
    const std::string& baseEase = objEasing.empty() ? defaultEasing : objEasing;
    for (uint32_t p = 0; p < plen; ++p) {
        const char* key = JS_AtomToCString(ctx, tab[p].atom);
        if (!key) continue;
        std::string k(key);
        JS_FreeCString(ctx, key);
        if (k == "offset" || k == "easing") continue;
        CssPropertyId propId = keyToCssProp(k);
        if (propId == CssPropertyId::Unknown) continue;
        JSValue val = JS_GetProperty(ctx, obj, tab[p].atom);
        std::vector<std::string> values;
        if (JS_IsArray(val)) {
            uint32_t alen = getArrayLength(ctx, val);
            values.reserve(alen);
            for (uint32_t i = 0; i < alen; ++i) {
                JSValue iv = JS_GetPropertyUint32(ctx, val, i);
                values.push_back(valueToCss(ctx, iv));
                JS_FreeValue(ctx, iv);
            }
        } else {
            values.push_back(valueToCss(ctx, val));
        }
        JS_FreeValue(ctx, val);
        if (values.empty()) continue;
        std::vector<double> offs = userOffsets;
        if (offs.size() != values.size()) {
            offs.assign(values.size(), NAN);
        }
        computeOffsets(offs);
        KeyframeProperty bp;
        bp.prop = propId;
        bp.frames.reserve(values.size());
        for (size_t i = 0; i < values.size(); ++i) {
            bp.frames.push_back(bro::engine::Keyframe{
                std::clamp(offs[i], 0.0, 1.0), values[i], baseEase, {}
            });
        }
        std::sort(bp.frames.begin(), bp.frames.end(),
                  [](const auto& a, const auto& b) { return a.offset < b.offset; });
        outProps.push_back(std::move(bp));
    }
    js_free_prop_enum(ctx, tab, plen);
    return !outProps.empty();
}

void parseOptions(JSContext* ctx, JSValueConst optVal, WebAnimation& anim,
                  std::string& outId, std::string& defaultEasing) {
    if (JS_IsNumber(optVal)) {
        double dur = 0;
        JS_ToFloat64(ctx, &dur, optVal);
        anim.timing.durationSec = std::max(0.0, dur / 1000.0);
        return;
    }
    if (!JS_IsObject(optVal)) return;
    JSValue v = JS_GetPropertyStr(ctx, optVal, "duration");
    if (JS_IsNumber(v)) {
        double dur = 0; JS_ToFloat64(ctx, &dur, v);
        anim.timing.durationSec = std::max(0.0, dur / 1000.0);
    }
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "delay");
    if (JS_IsNumber(v)) {
        double d = 0; JS_ToFloat64(ctx, &d, v);
        anim.timing.delaySec = d / 1000.0;
    }
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "endDelay");
    if (JS_IsNumber(v)) {
        double d = 0; JS_ToFloat64(ctx, &d, v);
        anim.timing.endDelaySec = d / 1000.0;
    }
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "iterations");
    if (JS_IsNumber(v)) {
        double it = 1; JS_ToFloat64(ctx, &it, v);
        anim.timing.iterations = std::isnan(it) ? 1.0 : std::max(0.0, it);
    }
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "direction");
    if (JS_IsString(v)) {
        std::string dir = jsToStdString(ctx, v);
        if (dir == "reverse") anim.timing.direction = AnimationDirection::Reverse;
        else if (dir == "alternate") anim.timing.direction = AnimationDirection::Alternate;
        else if (dir == "alternate-reverse")
            anim.timing.direction = AnimationDirection::AlternateReverse;
        else anim.timing.direction = AnimationDirection::Normal;
    }
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "fill");
    if (JS_IsString(v)) {
        std::string fill = jsToStdString(ctx, v);
        if (fill == "forwards") anim.timing.fill = AnimationFillMode::Forwards;
        else if (fill == "backwards") anim.timing.fill = AnimationFillMode::Backwards;
        else if (fill == "both") anim.timing.fill = AnimationFillMode::Both;
        else anim.timing.fill = AnimationFillMode::None;
    }
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "easing");
    if (JS_IsString(v)) defaultEasing = jsToStdString(ctx, v);
    JS_FreeValue(ctx, v);
    v = JS_GetPropertyStr(ctx, optVal, "id");
    if (JS_IsString(v)) outId = jsToStdString(ctx, v);
    JS_FreeValue(ctx, v);
}

AnimationJS* self(JSValueConst v) {
    return static_cast<AnimationJS*>(
        JS_GetOpaque(v, qjsbind::class_id<AnimationJS>()));
}

JSValue js_anim_play(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_UNDEFINED;
    freshenPromiseIfSettled(a);
    rec->play(nowFor(ctx));
    pinWrapper(ctx, a->id, this_val);
    markTargetDirty(ctx, rec);
    return JS_UNDEFINED;
}

JSValue js_anim_pause(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_UNDEFINED;
    rec->pause(nowFor(ctx));
    markTargetDirty(ctx, rec);
    return JS_UNDEFINED;
}

JSValue js_anim_cancel(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (rec) {
        rec->cancel();
        markTargetDirty(ctx, rec);
    }
    rejectFinishedPromise(ctx, a, makeAbortError(ctx, "The animation was cancelled"));
    if (!JS_IsUndefined(a->oncancel)) {
        fireHandler(ctx, a->oncancel, this_val, "cancel");
    }
    unpinWrapper(ctx, a->id);
    return JS_UNDEFINED;
}

JSValue js_anim_finish(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_UNDEFINED;
    if (rec->timing.iterations == std::numeric_limits<double>::infinity() ||
        std::isinf(rec->timing.iterations)) {
        return JS_ThrowTypeError(ctx, "Cannot finish an infinite animation");
    }
    rec->finish(nowFor(ctx));
    markTargetDirty(ctx, rec);
    settleFinish(ctx, a, this_val);
    return JS_UNDEFINED;
}

JSValue js_anim_reverse(JSContext* ctx, JSValueConst this_val, int, JSValueConst*) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_UNDEFINED;
    freshenPromiseIfSettled(a);
    rec->reverse(nowFor(ctx));
    pinWrapper(ctx, a->id, this_val);
    markTargetDirty(ctx, rec);
    return JS_UNDEFINED;
}

JSValue js_anim_get_currentTime(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a) return JS_NULL;
    auto* rec = recordFor(ctx, a->id);
    if (!rec || rec->playState == WebAnimation::PlayState::Idle) return JS_NULL;
    return JS_NewFloat64(ctx, rec->currentTimeMs(nowFor(ctx)));
}

JSValue js_anim_set_currentTime(JSContext* ctx, JSValueConst this_val, JSValueConst val) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_UNDEFINED;
    if (JS_IsNull(val) || JS_IsUndefined(val)) {
        rec->cancel();
        markTargetDirty(ctx, rec);
        return JS_UNDEFINED;
    }
    double ms = 0;
    if (JS_ToFloat64(ctx, &ms, val) != 0) return JS_UNDEFINED;
    rec->setCurrentTimeMs(ms, nowFor(ctx));
    markTargetDirty(ctx, rec);
    return JS_UNDEFINED;
}

JSValue js_anim_get_playbackRate(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a) return JS_NewFloat64(ctx, 1.0);
    auto* rec = recordFor(ctx, a->id);
    return JS_NewFloat64(ctx, rec ? rec->playbackRate : 1.0);
}

JSValue js_anim_set_playbackRate(JSContext* ctx, JSValueConst this_val, JSValueConst val) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_UNDEFINED;
    double r = 1.0;
    if (JS_ToFloat64(ctx, &r, val) == 0 && !std::isnan(r)) {
        rec->playbackRate = r;
        markTargetDirty(ctx, rec);
    }
    return JS_UNDEFINED;
}

JSValue js_anim_get_playState(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a) return JS_NewString(ctx, "idle");
    auto* rec = recordFor(ctx, a->id);
    if (!rec) return JS_NewString(ctx, "idle");
    return JS_NewString(ctx, rec->playStateString(nowFor(ctx)));
}

JSValue js_anim_get_pending(JSContext* ctx, JSValueConst /*this_val*/) {
    return JS_NewBool(ctx, false);
}

JSValue js_anim_get_id(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a) return JS_NewString(ctx, "");
    return JS_NewString(ctx, a->customId.c_str());
}

JSValue js_anim_set_id(JSContext* ctx, JSValueConst this_val, JSValueConst val) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    a->customId = jsToStdString(ctx, val);
    return JS_UNDEFINED;
}

JSValue js_anim_get_finished(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    if (!JS_IsUndefined(a->finishedPromise)) {
        return JS_DupValue(ctx, a->finishedPromise);
    }
    JSValue funcs[2];
    a->finishedPromise = JS_NewPromiseCapability(ctx, funcs);
    a->finishedResolve = funcs[0];
    a->finishedReject  = funcs[1];
    a->finishedSettled = false;
    auto* rec = recordFor(ctx, a->id);
    if (rec && rec->isFinished(nowFor(ctx))) {
        resolveFinishedPromise(ctx, a, this_val);
    }
    return JS_DupValue(ctx, a->finishedPromise);
}

JSValue js_anim_get_onfinish(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a || JS_IsUndefined(a->onfinish)) return JS_NULL;
    return JS_DupValue(ctx, a->onfinish);
}

JSValue js_anim_set_onfinish(JSContext* ctx, JSValueConst this_val, JSValueConst val) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    if (!JS_IsUndefined(a->onfinish)) JS_FreeValue(ctx, a->onfinish);
    a->onfinish = JS_IsFunction(ctx, val) ? JS_DupValue(ctx, val) : JS_UNDEFINED;
    return JS_UNDEFINED;
}

JSValue js_anim_get_oncancel(JSContext* ctx, JSValueConst this_val) {
    auto* a = self(this_val);
    if (!a || JS_IsUndefined(a->oncancel)) return JS_NULL;
    return JS_DupValue(ctx, a->oncancel);
}

JSValue js_anim_set_oncancel(JSContext* ctx, JSValueConst this_val, JSValueConst val) {
    auto* a = self(this_val);
    if (!a) return JS_UNDEFINED;
    if (!JS_IsUndefined(a->oncancel)) JS_FreeValue(ctx, a->oncancel);
    a->oncancel = JS_IsFunction(ctx, val) ? JS_DupValue(ctx, val) : JS_UNDEFINED;
    return JS_UNDEFINED;
}

const JSCFunctionListEntry js_animation_proto_funcs[] = {
    JS_CFUNC_DEF("play", 0, js_anim_play),
    JS_CFUNC_DEF("pause", 0, js_anim_pause),
    JS_CFUNC_DEF("cancel", 0, js_anim_cancel),
    JS_CFUNC_DEF("finish", 0, js_anim_finish),
    JS_CFUNC_DEF("reverse", 0, js_anim_reverse),
    JS_CGETSET_DEF("currentTime", js_anim_get_currentTime, js_anim_set_currentTime),
    JS_CGETSET_DEF("playbackRate", js_anim_get_playbackRate, js_anim_set_playbackRate),
    JS_CGETSET_DEF("playState", js_anim_get_playState, nullptr),
    JS_CGETSET_DEF("pending", js_anim_get_pending, nullptr),
    JS_CGETSET_DEF("id", js_anim_get_id, js_anim_set_id),
    JS_CGETSET_DEF("finished", js_anim_get_finished, nullptr),
    JS_CGETSET_DEF("onfinish", js_anim_get_onfinish, js_anim_set_onfinish),
    JS_CGETSET_DEF("oncancel", js_anim_get_oncancel, js_anim_set_oncancel),
};

JSValue js_element_animate(JSContext* ctx, JSValueConst this_val,
                           int argc, JSValueConst* argv) {
    if (argc < 1) return JS_ThrowTypeError(ctx, "animate: keyframes required");
    dom::Element* target = getElement(this_val);
    if (!target) return JS_ThrowTypeError(ctx, "animate called on non-Element");
    auto* eng = engineFor(ctx);
    if (!eng) return JS_ThrowTypeError(ctx, "no active Engine for realm");
    std::string defaultEasing = "linear";
    std::string customId;
    std::vector<KeyframeProperty> kfProps;
    JSValueConst kfArg = argv[0];
    if (JS_IsArray(kfArg)) {
        uint32_t len = getArrayLength(ctx, kfArg);
        parseKeyframeArray(ctx, kfArg, len, kfProps, defaultEasing);
    } else if (JS_IsObject(kfArg)) {
        parseKeyframeObject(ctx, kfArg, kfProps, defaultEasing);
    } else {
        return JS_ThrowTypeError(ctx, "keyframes must be an array or object");
    }
    WebAnimation anim;
    anim.target = target;
    anim.defaultEasing = defaultEasing;
    anim.properties = std::move(kfProps);
    if (argc >= 2) {
        parseOptions(ctx, argv[1], anim, customId, defaultEasing);
        anim.defaultEasing = defaultEasing;
    }
    double now = nowFor(ctx);
    anim.startTimeSec = now;
    anim.playState = WebAnimation::PlayState::Running;
    uint64_t id = eng->webAnimations().add(std::move(anim));
    JSValue wrapper = wrapAnimation(ctx, id, customId);
    markTargetDirty(ctx, eng->webAnimations().find(id));
    return wrapper;
}

JSValue js_element_getAnimations(JSContext* ctx, JSValueConst this_val,
                                 int /*argc*/, JSValueConst* /*argv*/) {
    dom::Element* target = getElement(this_val);
    if (!target) return JS_ThrowTypeError(ctx, "getAnimations called on non-Element");
    auto* eng = engineFor(ctx);
    if (!eng) return JS_NewArray(ctx);
    std::vector<uint64_t> ids = eng->webAnimations().getAnimationsForTarget(target);
    JSValue arr = JS_NewArray(ctx);
    for (uint32_t i = 0; i < (uint32_t)ids.size(); ++i) {
        JSValue w = wrapAnimation(ctx, ids[i], "");
        JS_SetPropertyUint32(ctx, arr, i, w);
    }
    return arr;
}

JSValue js_document_getAnimations(JSContext* ctx, JSValueConst /*this_val*/,
                                  int /*argc*/, JSValueConst* /*argv*/) {
    auto* eng = engineFor(ctx);
    if (!eng) return JS_NewArray(ctx);
    std::vector<uint64_t> ids = eng->webAnimations().getAllAnimations();
    JSValue arr = JS_NewArray(ctx);
    for (uint32_t i = 0; i < (uint32_t)ids.size(); ++i) {
        JSValue w = wrapAnimation(ctx, ids[i], "");
        JS_SetPropertyUint32(ctx, arr, i, w);
    }
    return arr;
}

} // namespace

void cleanupWebAnimationBindings(JSContext* ctx) {
    auto& pins = strongPins();
    for (auto it = pins.begin(); it != pins.end(); ) {
        auto* a = static_cast<AnimationJS*>(
            JS_GetOpaque(it->second, qjsbind::class_id<AnimationJS>()));
        if (a && a->ctx == ctx) {
            JS_FreeValue(ctx, it->second);
            it = pins.erase(it);
        } else {
            ++it;
        }
    }
}

void deliverWebAnimationFinishEvents(JSContext* ctx, std::vector<uint64_t> ids) {
    for (uint64_t id : ids) {
        auto mIt = wrapperMirror().find(id);
        if (mIt == wrapperMirror().end()) continue;
        JSValue obj = JS_DupValue(ctx, mIt->second);
        auto* a = static_cast<AnimationJS*>(
            JS_GetOpaque(obj, qjsbind::class_id<AnimationJS>()));
        if (a && a->ctx == ctx) settleFinish(ctx, a, obj);
        JS_FreeValue(ctx, obj);
    }
}

void installWebAnimationBindings(JSContext* ctx)
{
    qjsbind::Class<AnimationJS>(ctx, "Animation", qjsbind::NoGlobal)
            .gc_mark([](AnimationJS* a, JSRuntime* rt, JS_MarkFunc* mark) {
                JS_MarkValue(rt, a->onfinish, mark);
                JS_MarkValue(rt, a->oncancel, mark);
                JS_MarkValue(rt, a->finishedPromise, mark);
                JS_MarkValue(rt, a->finishedResolve, mark);
                JS_MarkValue(rt, a->finishedReject, mark);
            })
            .function_list(js_animation_proto_funcs,
                           sizeof(js_animation_proto_funcs) /
                               sizeof(js_animation_proto_funcs[0]));
    
        JSValue eproto = JS_GetClassProto(ctx, js_element_class_id);
        if (JS_IsObject(eproto)) {
            JS_SetPropertyStr(ctx, eproto, "animate",
                JS_NewCFunction(ctx, js_element_animate, "animate", 2));
            JS_SetPropertyStr(ctx, eproto, "getAnimations",
                JS_NewCFunction(ctx, js_element_getAnimations, "getAnimations", 0));
        }
        JS_FreeValue(ctx, eproto);
    
        JSValue dproto = JS_GetClassProto(ctx, js_document_class_id);
        if (JS_IsObject(dproto)) {
            JS_SetPropertyStr(ctx, dproto, "getAnimations",
                JS_NewCFunction(ctx, js_document_getAnimations, "getAnimations", 0));
        }
        JS_FreeValue(ctx, dproto);
}

} // namespace bro::js
