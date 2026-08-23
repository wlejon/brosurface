#include "js/math_bindings.h"
#include <bromath/aabb.h>
#include <bromath/angle.h>
#include <bromath/color.h>
#include <bromath/curves.h>
#include <bromath/frustum.h>
#include <bromath/grid.h>
#include <bromath/hash.h>
#include <bromath/plane.h>
#include <bromath/ray.h>
#include <bromath/rng.h>
#include <bromath/scalar.h>
#include <bromath/segment.h>
#include <bromath/smoother.h>
#include <bromath/spatial_hash.h>
#include <bromath/sphere.h>
#include <bromath/vec.h>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

extern "C" {
#include "quickjs.h"
}

namespace bro::js {

static double propNum(JSContext* ctx, JSValueConst obj, const char* key) {
    JSValue v = JS_GetPropertyStr(ctx, obj, key);
    double d = 0;
    JS_ToFloat64(ctx, &d, v);
    JS_FreeValue(ctx, v);
    return d;
}

static double idxNum(JSContext* ctx, JSValueConst arr, uint32_t i) {
    JSValue v = JS_GetPropertyUint32(ctx, arr, i);
    double d = 0;
    JS_ToFloat64(ctx, &d, v);
    JS_FreeValue(ctx, v);
    return d;
}

static bool readVec3(JSContext* ctx, JSValueConst v, bromath::Vec3& o) {
    if (JS_IsArray(v)) {
        o = {(float)idxNum(ctx, v, 0), (float)idxNum(ctx, v, 1), (float)idxNum(ctx, v, 2)};
        return true;
    }
    if (JS_IsObject(v)) {
        o = {(float)propNum(ctx, v, "x"), (float)propNum(ctx, v, "y"), (float)propNum(ctx, v, "z")};
        return true;
    }
    return false;
}

static bool readVec2(JSContext* ctx, JSValueConst v, bromath::Vec2& o) {
    if (JS_IsArray(v)) {
        o = {(float)idxNum(ctx, v, 0), (float)idxNum(ctx, v, 1)};
        return true;
    }
    if (JS_IsObject(v)) {
        o = {(float)propNum(ctx, v, "x"), (float)propNum(ctx, v, "y")};
        return true;
    }
    return false;
}

static JSValue vec3ToJS(JSContext* ctx, bromath::Vec3 v) {
    JSValue o = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, o, "x", JS_NewFloat64(ctx, v.x));
    JS_SetPropertyStr(ctx, o, "y", JS_NewFloat64(ctx, v.y));
    JS_SetPropertyStr(ctx, o, "z", JS_NewFloat64(ctx, v.z));
    return o;
}

static JSValue vec2ToJS(JSContext* ctx, bromath::Vec2 v) {
    JSValue o = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, o, "x", JS_NewFloat64(ctx, v.x));
    JS_SetPropertyStr(ctx, o, "y", JS_NewFloat64(ctx, v.y));
    return o;
}

static JSValue colorToJS(JSContext* ctx, bromath::Color c) {
    JSValue o = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, o, "r", JS_NewFloat64(ctx, c.r));
    JS_SetPropertyStr(ctx, o, "g", JS_NewFloat64(ctx, c.g));
    JS_SetPropertyStr(ctx, o, "b", JS_NewFloat64(ctx, c.b));
    JS_SetPropertyStr(ctx, o, "a", JS_NewFloat64(ctx, c.a));
    return o;
}

#define REQ_V3(var, val) \
    bromath::Vec3 var{0, 0, 0}; \
    if (!readVec3(ctx, val, var)) return JS_ThrowTypeError(ctx, "expected a {x,y,z} or [x,y,z] vector");

#define REQ_V2(var, val) \
    bromath::Vec2 var{0, 0}; \
    if (!readVec2(ctx, val, var)) return JS_ThrowTypeError(ctx, "expected a {x,y} or [x,y] vector");

template <typename F>
static void mfn(JSContext* ctx, JSValue obj, const char* name, F&& fn) {
    qjsbind::detail::Method<F> m(std::forward<F>(fn));
    JS_SetPropertyStr(ctx, obj, name, m.create_function(ctx, name));
}

struct SpatialHashWrapper { bromath::SpatialHash3D h; };
using SHW = SpatialHashWrapper;

static void installSpatialHash(JSContext* ctx) {
    qjsbind::Class<SHW>(ctx, "SpatialHash3D")
    .constructor([](JSContext* ctx, int argc, JSValueConst* argv) -> SHW* {
        double cs = 1.0; int64_t b = 1024;
        if (argc > 0) JS_ToFloat64(ctx, &cs, argv[0]);
        if (argc > 1) JS_ToInt64(ctx, &b, argv[1]);
        SHW* w = new SHW();
        w->h = bromath::spatialHashCreate((float)cs, (uint32_t)b);
        return w;
    })
    .method("insert", [](SHW* w, double id, double x, double y, double z) {
        bromath::spatialHashInsert(w->h, (uint32_t)id, {(float)x, (float)y, (float)z});
    }, qjsbind::returns_this)
    .method("remove", [](SHW* w, double id, double x, double y, double z) -> bool {
        return bromath::spatialHashRemove(w->h, (uint32_t)id, {(float)x, (float)y, (float)z});
    })
    .method("queryRadius", [](SHW* w, JSContext* ctx, double x, double y, double z, double r) -> JSValue {
        auto res = bromath::spatialHashQueryRadius(w->h, {(float)x, (float)y, (float)z}, (float)r);
        JSValue arr = JS_NewArray(ctx);
        for (uint32_t i = 0; i < (uint32_t)res.size(); ++i) {
            JS_SetPropertyUint32(ctx, arr, i, JS_NewFloat64(ctx, (double)res[i]));
        }
        return arr;
    })
    .method("queryAABB", [](SHW* w, JSContext* ctx, double minX, double minY, double minZ, double maxX, double maxY, double maxZ) -> JSValue {
        bromath::AABB b{{(float)minX, (float)minY, (float)minZ}, {(float)maxX, (float)maxY, (float)maxZ}};
        auto res = bromath::spatialHashQueryAABB(w->h, b);
        JSValue arr = JS_NewArray(ctx);
        for (uint32_t i = 0; i < (uint32_t)res.size(); ++i) {
            JS_SetPropertyUint32(ctx, arr, i, JS_NewFloat64(ctx, (double)res[i]));
        }
        return arr;
    })
    .method("nearest", [](SHW* w, JSContext* ctx, double x, double y, double z, double maxDist) -> JSValue {
        float d = 0;
        uint32_t id = bromath::spatialHashNearest(w->h, {(float)x, (float)y, (float)z}, (float)maxDist, &d);
        if (id == UINT32_MAX) return JS_NULL;
        JSValue o = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, o, "id", JS_NewFloat64(ctx, (double)id));
        JS_SetPropertyStr(ctx, o, "dist", JS_NewFloat64(ctx, (double)d));
        return o;
    })
    .method("clear", [](SHW* w) { bromath::spatialHashClear(w->h); }, qjsbind::returns_this)
    .get("size", [](SHW* w) -> double { return (double)w->h.totalEntries; });
}

struct RngWrapper { uint64_t state = 0; };
using RNGW = RngWrapper;

static void installRng(JSContext* ctx) {
    qjsbind::Class<RNGW>(ctx, "Rng")
    .constructor([](JSContext* ctx, int argc, JSValueConst* argv) -> RNGW* {
        int64_t seed = 0;
        if (argc > 0) JS_ToInt64(ctx, &seed, argv[0]);
        RNGW* w = new RNGW();
        w->state = (uint64_t)seed;
        return w;
    })
    .method("reseed", [](RNGW* w, JSContext* ctx, JSValue v) {
        int64_t seed = 0;
        JS_ToInt64(ctx, &seed, v);
        w->state = (uint64_t)seed;
    }, qjsbind::returns_this)
    .method("float01", [](RNGW* w) -> double { return (double)bromath::randFloat01(w->state); })
    .method("signed", [](RNGW* w) -> double { return (double)bromath::randSigned(w->state); })
    .method("range", [](RNGW* w, double lo, double hi) -> double { return (double)bromath::randRange(w->state, (float)lo, (float)hi); })
    .method("int", [](RNGW* w, int lo, int hi) -> int { return bromath::randInt(w->state, lo, hi); })
    .method("uint32", [](RNGW* w) -> double { return (double)(uint32_t)(bromath::splitmix64(w->state) >> 32); })
    .method("normal", [](RNGW* w) -> double { return (double)bromath::randNormal(w->state); })
    .method("gaussian2D", [](RNGW* w, JSContext* ctx, double sigma) -> JSValue { return vec2ToJS(ctx, bromath::randGaussian2D(w->state, (float)sigma)); })
    .method("inUnitDisc", [](RNGW* w, JSContext* ctx) -> JSValue { return vec2ToJS(ctx, bromath::randInUnitDisc(w->state)); })
    .method("inUnitSphere", [](RNGW* w, JSContext* ctx) -> JSValue { return vec3ToJS(ctx, bromath::randInUnitSphere(w->state)); })
    .method("onUnitSphere", [](RNGW* w, JSContext* ctx) -> JSValue { return vec3ToJS(ctx, bromath::randOnUnitSphere(w->state)); });
}

struct SmootherWrapper { bromath::Smoother s; };
using SMW = SmootherWrapper;

static void installSmoother(JSContext* ctx) {
    qjsbind::Class<SMW>(ctx, "Smoother")
    .constructor([](JSContext* ctx, int argc, JSValueConst* argv) -> SMW* {
        SMW* w = new SMW();
        if (argc >= 2) {
            double timeMs = 0, sr = 0;
            JS_ToFloat64(ctx, &timeMs, argv[0]);
            JS_ToFloat64(ctx, &sr, argv[1]);
            bromath::smootherSetTime(w->s, (float)timeMs, (float)sr);
        }
        return w;
    })
    .method("setTime", [](SMW* w, double timeMs, double sampleRate) { bromath::smootherSetTime(w->s, (float)timeMs, (float)sampleRate); }, qjsbind::returns_this)
    .method("reset", [](SMW* w, double value) { bromath::smootherReset(w->s, (float)value); }, qjsbind::returns_this)
    .method("setTarget", [](SMW* w, double t) { bromath::smootherTarget(w->s, (float)t); }, qjsbind::returns_this)
    .method("tick", [](SMW* w) -> double { return (double)bromath::smootherTick(w->s); })
    .method("tickN", [](SMW* w, int n) -> double { return (double)bromath::smootherTickN(w->s, n); })
    .get("current", [](SMW* w) -> double { return (double)w->s.current; })
    .get("target",  [](SMW* w) -> double { return (double)w->s.target; })
    .get("coeff",   [](SMW* w) -> double { return (double)w->s.coeff; });
}

static void installFreeFunctions(JSContext* ctx, JSValue m) {
    mfn(ctx, m, "cubicEase", [](double p1x, double p1y, double p2x, double p2y, double x) -> double {
        bromath::CubicEase c{(float)p1x, (float)p1y, (float)p2x, (float)p2y};
        return (double)bromath::ccubicEase(c, (float)x);
    });
    mfn(ctx, m, "bezier", [](JSContext* ctx, JSValue p0, JSValue p1, JSValue p2, JSValue p3, double t) -> JSValue {
        REQ_V3(a, p0); REQ_V3(b, p1); REQ_V3(c, p2); REQ_V3(d, p3);
        return vec3ToJS(ctx, bromath::cbezier(a, b, c, d, (float)t));
    });
    mfn(ctx, m, "bezierTangent", [](JSContext* ctx, JSValue p0, JSValue p1, JSValue p2, JSValue p3, double t) -> JSValue {
        REQ_V3(a, p0); REQ_V3(b, p1); REQ_V3(c, p2); REQ_V3(d, p3);
        return vec3ToJS(ctx, bromath::cbezierTangent(a, b, c, d, (float)t));
    });
    mfn(ctx, m, "catmullRom", [](JSContext* ctx, JSValue p0, JSValue p1, JSValue p2, JSValue p3, double t) -> JSValue {
        REQ_V3(a, p0); REQ_V3(b, p1); REQ_V3(c, p2); REQ_V3(d, p3);
        return vec3ToJS(ctx, bromath::ccatmullRom(a, b, c, d, (float)t));
    });
    mfn(ctx, m, "hermite", [](JSContext* ctx, JSValue p0, JSValue m0, JSValue p1, JSValue m1, double t) -> JSValue {
        REQ_V3(a, p0); REQ_V3(ta, m0); REQ_V3(b, p1); REQ_V3(tb, m1);
        return vec3ToJS(ctx, bromath::chermite(a, ta, b, tb, (float)t));
    });
    mfn(ctx, m, "fromHex", [](JSContext* ctx, std::string hex) -> JSValue { return colorToJS(ctx, bromath::cfromHex(hex.c_str())); });
    mfn(ctx, m, "fromHSV", [](JSContext* ctx, double h, double s, double v, JSValue a) -> JSValue {
        double av = 1.0; if (!JS_IsUndefined(a)) JS_ToFloat64(ctx, &av, a);
        return colorToJS(ctx, bromath::cfromHSV((float)h, (float)s, (float)v, (float)av));
    });
    mfn(ctx, m, "fromColor8", [](JSContext* ctx, double r, double g, double b, JSValue a) -> JSValue {
        double av = 255.0; if (!JS_IsUndefined(a)) JS_ToFloat64(ctx, &av, a);
        bromath::Color8 c8{(uint8_t)r, (uint8_t)g, (uint8_t)b, (uint8_t)av};
        return colorToJS(ctx, bromath::cfromColor8(c8));
    });
    mfn(ctx, m, "toColor8", [](JSContext* ctx, double r, double g, double b, JSValue a) -> JSValue {
        double av = 1.0; if (!JS_IsUndefined(a)) JS_ToFloat64(ctx, &av, a);
        bromath::Color8 c8 = bromath::ctoColor8(bromath::Color{(float)r, (float)g, (float)b, (float)av});
        JSValue o = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, o, "r", JS_NewInt32(ctx, c8.r));
        JS_SetPropertyStr(ctx, o, "g", JS_NewInt32(ctx, c8.g));
        JS_SetPropertyStr(ctx, o, "b", JS_NewInt32(ctx, c8.b));
        JS_SetPropertyStr(ctx, o, "a", JS_NewInt32(ctx, c8.a));
        return o;
    });
    mfn(ctx, m, "linearToSrgb", [](double c) -> double { return (double)bromath::clinearToSrgb((float)c); });
    mfn(ctx, m, "srgbToLinear", [](double c) -> double { return (double)bromath::csrgbToLinear((float)c); });
    mfn(ctx, m, "lerp", [](double a, double b, double t) -> double { return (double)bromath::lerp((float)a, (float)b, (float)t); });
    mfn(ctx, m, "clamp", [](double x, double lo, double hi) -> double { return (double)bromath::clamp((float)x, (float)lo, (float)hi); });
    mfn(ctx, m, "saturate", [](double x) -> double { return (double)bromath::saturate((float)x); });
    mfn(ctx, m, "invLerp", [](double a, double b, double x) -> double { return (double)bromath::invLerp((float)a, (float)b, (float)x); });
    mfn(ctx, m, "remap", [](double x, double inMin, double inMax, double outMin, double outMax) -> double {
        return (double)bromath::remap((float)x, (float)inMin, (float)inMax, (float)outMin, (float)outMax);
    });
    mfn(ctx, m, "smoothstep", [](double e0, double e1, double x) -> double { return (double)bromath::smoothstep((float)e0, (float)e1, (float)x); });
    mfn(ctx, m, "smootherstep", [](double e0, double e1, double x) -> double { return (double)bromath::smootherstep((float)e0, (float)e1, (float)x); });
    mfn(ctx, m, "degToRad", [](double deg) -> double { return (double)bromath::degToRad((float)deg); });
    mfn(ctx, m, "radToDeg", [](double rad) -> double { return (double)bromath::radToDeg((float)rad); });
    mfn(ctx, m, "wrapAngle", [](double a) -> double { return (double)bromath::wrapAngle((float)a); });
    mfn(ctx, m, "angleDiff", [](double a, double b) -> double { return (double)bromath::angleDiff((float)a, (float)b); });
    mfn(ctx, m, "rayPlaneIntersect", [](JSContext* ctx, JSValue rOrigin, JSValue rDir, JSValue pNormal, double pD) -> JSValue {
        REQ_V3(ro, rOrigin); REQ_V3(rd, rDir); REQ_V3(pn, pNormal);
        float t = 0;
        if (!bromath::crayPlaneIntersect(bromath::Ray{ro, rd}, bromath::Plane{pn, (float)pD}, t))
            return JS_NULL;
        return JS_NewFloat64(ctx, (double)t);
    });
    mfn(ctx, m, "raySphereIntersect", [](JSContext* ctx, JSValue rOrigin, JSValue rDir, JSValue sCenter, double sRadius) -> JSValue {
        REQ_V3(ro, rOrigin); REQ_V3(rd, rDir); REQ_V3(sc, sCenter);
        float tMin = 0, tMax = 0;
        if (!bromath::craySphereIntersect(bromath::Ray{ro, rd}, bromath::Sphere{sc, (float)sRadius}, tMin, tMax))
            return JS_NULL;
        JSValue o = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, o, "tMin", JS_NewFloat64(ctx, (double)tMin));
        JS_SetPropertyStr(ctx, o, "tMax", JS_NewFloat64(ctx, (double)tMax));
        return o;
    });
    mfn(ctx, m, "rayAABBIntersect", [](JSContext* ctx, JSValue rOrigin, JSValue rDir, JSValue bMin, JSValue bMax) -> JSValue {
        REQ_V3(ro, rOrigin); REQ_V3(rd, rDir); REQ_V3(mn, bMin); REQ_V3(mx, bMax);
        float tMin = 0, tMax = 0;
        if (!bromath::crayAABBIntersect(bromath::Ray{ro, rd}, bromath::AABB{mn, mx}, tMin, tMax))
            return JS_NULL;
        JSValue o = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, o, "tMin", JS_NewFloat64(ctx, (double)tMin));
        JS_SetPropertyStr(ctx, o, "tMax", JS_NewFloat64(ctx, (double)tMax));
        return o;
    });
    mfn(ctx, m, "sphereAABBOverlap", [](JSContext* ctx, JSValue sCenter, double sRadius, JSValue bMin, JSValue bMax) -> JSValue {
        REQ_V3(sc, sCenter); REQ_V3(mn, bMin); REQ_V3(mx, bMax);
        return JS_NewBool(ctx, bromath::csphereAABBOverlap(bromath::Sphere{sc, (float)sRadius}, bromath::AABB{mn, mx}));
    });
    mfn(ctx, m, "pointInAABB", [](JSContext* ctx, JSValue point, JSValue bMin, JSValue bMax) -> JSValue {
        REQ_V3(p, point); REQ_V3(mn, bMin); REQ_V3(mx, bMax);
        return JS_NewBool(ctx, bromath::cpointInAABB(p, bromath::AABB{mn, mx}));
    });
    mfn(ctx, m, "closestPointAABB", [](JSContext* ctx, JSValue point, JSValue bMin, JSValue bMax) -> JSValue {
        REQ_V3(p, point); REQ_V3(mn, bMin); REQ_V3(mx, bMax);
        return vec3ToJS(ctx, bromath::cclosestPointAABB(p, bromath::AABB{mn, mx}));
    });
    mfn(ctx, m, "aabbOverlap", [](JSContext* ctx, JSValue aMin, JSValue aMax, JSValue bMin, JSValue bMax) -> JSValue {
        REQ_V3(amn, aMin); REQ_V3(amx, aMax); REQ_V3(bmn, bMin); REQ_V3(bmx, bMax);
        return JS_NewBool(ctx, bromath::caabbOverlap(bromath::AABB{amn, amx}, bromath::AABB{bmn, bmx}));
    });
    mfn(ctx, m, "aabbContains", [](JSContext* ctx, JSValue aMin, JSValue aMax, JSValue bMin, JSValue bMax) -> JSValue {
        REQ_V3(amn, aMin); REQ_V3(amx, aMax); REQ_V3(bmn, bMin); REQ_V3(bmx, bMax);
        return JS_NewBool(ctx, bromath::caabbContains(bromath::AABB{amn, amx}, bromath::AABB{bmn, bmx}));
    });
    auto readGrid = [](JSContext* ctx, JSValueConst g) -> bromath::GridFootprint2D {
        bromath::GridFootprint2D f;
        JSValue origin = JS_GetPropertyStr(ctx, g, "origin");
        bromath::Vec2 o{0, 0};
        readVec2(ctx, origin, o);
        JS_FreeValue(ctx, origin);
        f.origin = o;
        f.cellSize = (float)propNum(ctx, g, "cellSize");
        f.width = (int)propNum(ctx, g, "width");
        f.depth = (int)propNum(ctx, g, "depth");
        return f;
    };
    mfn(ctx, m, "gridIndex2D", [readGrid](JSContext* ctx, JSValue grid, int col, int row) -> JSValue {
        return JS_NewInt32(ctx, bromath::gridIndex2D(readGrid(ctx, grid), col, row));
    });
    mfn(ctx, m, "gridInBounds", [readGrid](JSContext* ctx, JSValue grid, int col, int row) -> JSValue {
        return JS_NewBool(ctx, bromath::gridInBounds(readGrid(ctx, grid), col, row));
    });
    mfn(ctx, m, "gridCellOf", [readGrid](JSContext* ctx, JSValue grid, JSValue point) -> JSValue {
        bromath::Vec2 p{0, 0};
        if (!readVec2(ctx, point, p)) return JS_ThrowTypeError(ctx, "expected a {x,y} or [x,y] point");
        int col = 0, row = 0;
        bromath::gridCellOf(readGrid(ctx, grid), p, col, row);
        JSValue o = JS_NewObject(ctx);
        JS_SetPropertyStr(ctx, o, "col", JS_NewInt32(ctx, col));
        JS_SetPropertyStr(ctx, o, "row", JS_NewInt32(ctx, row));
        return o;
    });
    mfn(ctx, m, "gridCellCenter", [readGrid](JSContext* ctx, JSValue grid, int col, int row) -> JSValue {
        return vec2ToJS(ctx, bromath::gridCellCenter(readGrid(ctx, grid), col, row));
    });
    mfn(ctx, m, "fnv1a32", [](JSContext* ctx, std::string data, JSValue seed) -> JSValue {
        uint32_t s = 2166136261u;
        if (!JS_IsUndefined(seed)) { int64_t sv = 0; JS_ToInt64(ctx, &sv, seed); s = (uint32_t)sv; }
        return JS_NewFloat64(ctx, (double)bromath::fnv1a32(data.data(), data.size(), s));
    });
    mfn(ctx, m, "hashU32", [](JSContext* ctx, double x) -> JSValue { return JS_NewFloat64(ctx, (double)bromath::hashU32((uint32_t)(int64_t)x)); });
    mfn(ctx, m, "cellHash", [](JSContext* ctx, double x, double y, JSValue z) -> JSValue {
        if (JS_IsUndefined(z)) return JS_NewFloat64(ctx, (double)bromath::cellHash((int32_t)x, (int32_t)y));
        double zv = 0; JS_ToFloat64(ctx, &zv, z);
        return JS_NewFloat64(ctx, (double)bromath::cellHash((int32_t)x, (int32_t)y, (int32_t)zv));
    });
    mfn(ctx, m, "positionToCell", [](JSContext* ctx, JSValue point, double cellSize, double bucketCount) -> JSValue {
        REQ_V3(p, point);
        return JS_NewFloat64(ctx, (double)bromath::positionToCell(p, (float)cellSize, (uint32_t)bucketCount));
    });
}

static void aliasCtor(JSContext* ctx, JSValue global, JSValue mathObj, const char* name) {
    JSValue ctor = JS_GetPropertyStr(ctx, global, name);
    if (!JS_IsUndefined(ctor) && !JS_IsException(ctor)) {
        JS_SetPropertyStr(ctx, mathObj, name, JS_DupValue(ctx, ctor));
    }
    JS_FreeValue(ctx, ctor);
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

void MathBindings::install(JSContext* ctx) {
    installSpatialHash(ctx);
        installRng(ctx);
        installSmoother(ctx);
    
        JSValue global = JS_GetGlobalObject(ctx);
        JSValue broObj = JS_GetPropertyStr(ctx, global, "bro");
        if (JS_IsUndefined(broObj) || JS_IsException(broObj)) {
            JS_FreeValue(ctx, broObj);
            broObj = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, global, "bro", JS_DupValue(ctx, broObj));
        }
        JSValue mathObj = JS_GetPropertyStr(ctx, broObj, "math");
        if (JS_IsUndefined(mathObj) || JS_IsException(mathObj)) {
            JS_FreeValue(ctx, mathObj);
            mathObj = JS_NewObject(ctx);
            JS_SetPropertyStr(ctx, broObj, "math", JS_DupValue(ctx, mathObj));
        }
    
        aliasCtor(ctx, global, mathObj, "SpatialHash3D");
        aliasCtor(ctx, global, mathObj, "Rng");
        aliasCtor(ctx, global, mathObj, "Smoother");
    
        installFreeFunctions(ctx, mathObj);
    
        JS_FreeValue(ctx, mathObj);
        JS_FreeValue(ctx, broObj);
        JS_FreeValue(ctx, global);
}


} // namespace bro::js
