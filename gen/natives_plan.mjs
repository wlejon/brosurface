// gen/natives_plan.mjs — from one subsystem's IDL to the list of natives it
// needs and the JavaScript that assembles its public shape over them.
//
// Generic and AST-driven: nothing in here knows a subsystem by name. The
// plan an emitter renders (gen/emit_natives.mjs) is:
//
//   natives   one entry per C entry point: its C prototype, its JS path under
//             `__bro_native.<subsystem>`, its bronze signature and kind
//   wrapper   the mounts, members and class shapes of the public surface,
//             each member already reduced to the JS lines that call its
//             natives (the emitter only wraps them in a file)
//   manual    every [manual] member, as the placeholder line the wrapper gets
//   errors    every IDL spelling the vocabulary refuses (schema/native_types)
//
// THE NAMING CONVENTION, shared by the C symbol and the JS path:
//
//   tail                          C symbol                JS path
//   <op>                          bro_<sub>_<op>          __bro_native.<sub>.<op>
//   <prop>_get / <prop>_set       (namespace property)     Getter / Setter kinds
//   <Class>                       bro_<sub>_<Class>_ctor  __bro_native.<sub>.<Class>   (Constructor)
//   <Class>_dtor                  bro_<sub>_<Class>_dtor  (the class destructor)
//   <Class>_<method>              bro_<sub>_<Class>_<m>   __bro_native.<sub>.<Class>_<m>
//   <Class>_<attr>_get / _set     ...                     ...
//   <op>_<member>                 a dictionary result's member read
//   <op>_at                       a handle-list result's element read
//
// WHY CLASS MEMBERS ARE FUNCTIONS, NOT METHODS. bronze lowers `obj.m()` to a
// Method-kind native only when it can see obj's class — a `new` of a native
// class or a captured const. A wrapper's receiver is `this`, which it cannot
// see, so a Method-kind registration would be unreachable from the very code
// that has to call it. Every instance member is therefore a Function-kind
// native whose first parameter is the class handle (`void* self`, typed as
// the class path, so a wrong receiver is a TypeError naming the class), and
// the constructor is the one Constructor-kind registration, which mints the
// class and its prototype.

import {
  NATIVE_ROOT, SCALARS, ARRAY_KINDS, resolveShape, createNativeTypeContext,
  classPathOf, hasAttr, getAttr, dictionaryMembers,
} from '../schema/native_types.mjs';
import { ValidationError } from '../schema/validator.mjs';

export { createNativeTypeContext };

const INDENT = '    ';

function jsLiteral(v) {
  if (v === null || v === undefined) return 'undefined';
  if (Array.isArray(v)) return '[]';
  if (typeof v === 'object') return '{}';
  return JSON.stringify(v);
}

function cIdent(s) {
  return s.replace(/[^A-Za-z0-9_]/g, '_');
}

/**
 * @param {Array<{fileAst, subsystem}>} astEntries  every IDL (types resolve across files)
 * @param {string} subsystem  the IDL basename to plan
 * @param {Iterable<string>} nativeSubsystems  the subsystems that are natives surfaces
 */
export function planNatives(astEntries, subsystem, nativeSubsystems) {
  const ctx = createNativeTypeContext(astEntries, nativeSubsystems);
  const entry = astEntries.find((e) => e.subsystem === subsystem);
  if (!entry) throw new Error(`no IDL for subsystem '${subsystem}'`);
  const planner = new Planner(ctx, subsystem, entry.fileAst);
  return planner.plan();
}

class Planner {
  constructor(ctx, subsystem, fileAst) {
    this.ctx = ctx;
    this.sub = subsystem;
    this.fileAst = fileAst;
    this.natives = [];
    this.tails = new Map();
    this.errors = [];
    this.manual = [];
    this.helpers = new Set();
    this.reads = new Set([NATIVE_ROOT]);
    this.dependsOn = new Set();
    this.classInfo = new Map();
  }

  plan() {
    const activeDefs = this.fileAst.definitions.filter((d) => d.type === 'Namespace' || d.type === 'Interface');
    const allGated = activeDefs.length > 0 && activeDefs.every((d) => {
      const g = getAttr(d, 'gate') || getAttr(d, 'cpp_guard');
      return typeof g === 'string' && g.trim().length > 0;
    });
    let gate = null;
    if (allGated) {
      const gates = [];
      for (const def of activeDefs) {
        for (const key of ['gate', 'cpp_guard']) {
          const g = getAttr(def, key);
          if (typeof g === 'string' && g.trim() && !gates.includes(g.trim())) gates.push(g.trim());
        }
      }
      gate = gates.length === 0 ? null : gates.map((g) => (/\s/.test(g) ? `(${g})` : g)).join(' && ');
    }

    // Every class first: a native that names a class needs its constructor
    // registered before it, and the register order follows the natives list.
    const interfaces = this.fileAst.definitions.filter((d) => d.type === 'Interface');
    const namespaces = this.fileAst.definitions.filter((d) => d.type === 'Namespace');
    for (const iface of interfaces) this.planClassConstructor(iface);
    const classPlans = interfaces.map((iface) => this.planClassMembers(iface));
    const nsPlans = namespaces.map((ns) => this.planNamespace(ns));

    return {
      subsystem: this.sub,
      gate,
      natives: this.natives,
      wrapper: {
        reads: [...this.reads].sort(),
        helpers: this.helpers,
        namespaces: nsPlans,
        classes: classPlans,
      },
      manual: this.manual,
      errors: this.errors,
      dependsOn: [...this.dependsOn].sort(),
    };
  }

  // ---- naming -------------------------------------------------------------

  claimTail(tail, loc, scope) {
    const key = (this.sub === 'dunder_bro' && scope?.nsIdent) ? `${scope.nsIdent}_${tail}` : tail;
    if (this.tails.has(key)) {
      this.errors.push(new ValidationError(
        `native name '${key}' is produced twice (also by ${this.tails.get(key)}); rename one member`, loc));
    }
    this.tails.set(key, loc ? `${loc.file}:${loc.line}` : '?');
    return tail;
  }

  cName(tail, scope) {
    if (this.sub === 'dunder_bro' && scope?.nsIdent) {
      return `bro_dunder_bro_${cIdent(scope.nsIdent)}_${tail}`;
    }
    return `bro_${cIdent(this.sub)}_${tail}`;
  }

  jsPath(tail, scope) {
    if (this.sub === 'dunder_bro' && scope?.nativePath) {
      return `${NATIVE_ROOT}.${scope.nativePath}.${tail}`;
    }
    return `${NATIVE_ROOT}.${this.sub}.${tail}`;
  }

  addNative(n, scope) {
    if (scope?.gate && !n.gate) {
      n.gate = scope.gate;
    }
    this.natives.push(n);
    return n;
  }

  // ---- mounts -------------------------------------------------------------

  // Where a namespace's members go: `prefix` names the object ("bro." →
  // bro, "" → globalThis, "bro.x.y." → bro.x.y); [flatten] mounts
  // the members on that object itself instead of on a child named after
  // the namespace.
  mountForNamespace(ns) {
    const prefixAttr = getAttr(ns, 'prefix');
    const prefix = typeof prefixAttr === 'string' ? prefixAttr : 'bro.';
    const parts = prefix.split('.').filter(Boolean);
    const flatten = hasAttr(ns, 'flatten');
    const nsName = getAttr(ns, 'js_name') || ns.name.replace(/^dunder_/, '');
    const chain = flatten ? parts : [...parts, nsName];
    return this.mountChain(chain);
  }

  mountForInterface(iface) {
    const alias = getAttr(iface, 'js_alias');
    if (typeof alias === 'string' && alias) {
      const parts = alias.split('.');
      const name = parts.pop();
      return { ...this.mountChain(parts), name };
    }
    for (const key of ['global_var', 'js_global', 'global']) {
      const g = getAttr(iface, key);
      if (g === true || (typeof g === 'string' && g)) {
        return { ...this.mountChain([]), name: typeof g === 'string' ? g : iface.name };
      }
    }
    return { ...this.mountChain(['bro', this.sub]), name: iface.name };
  }

  // The JS expression of the object at a dotted chain, creating each level
  // it walks, and the public spelling of that object.
  mountChain(parts) {
    if (parts.length === 0) {
      this.reads.add('globalThis');
      return { expr: 'globalThis', publicPath: '' };
    }
    this.reads.add(parts[0]);
    let expr = parts[0];
    for (let i = 1; i < parts.length; i++) {
      this.helpers.add('mount');
      expr = `mount(${expr}, ${JSON.stringify(parts[i])})`;
    }
    return { expr, publicPath: parts.join('.') };
  }

  // ---- namespaces ----------------------------------------------------------

  planNamespace(ns) {
    const mount = this.mountForNamespace(ns);
    const local = `ns_${cIdent(ns.name)}`;
    const nsGate = getAttr(ns, 'gate') || getAttr(ns, 'cpp_guard') || null;
    const prefixAttr = getAttr(ns, 'prefix');
    const prefix = typeof prefixAttr === 'string' ? prefixAttr : '';
    let nativePath = getAttr(ns, 'native_path');
    let cNs = getAttr(ns, 'cpp_namespace');
    if (prefix.startsWith('__bro.')) {
      const subPath = prefix.slice('__bro.'.length).replace(/\.$/, '');
      if (!nativePath) nativePath = subPath;
      if (!cNs) cNs = subPath.replace(/\./g, '_');
    } else {
      if (!nativePath) nativePath = ns.name.replace(/^dunder_/, '');
      if (!cNs) cNs = ns.name.replace(/^dunder_/, '');
    }
    const members = [];
    for (const m of ns.members) {
      if (m.type === 'ConstantMember') {
        members.push({ kind: 'constant', name: m.name, lines: [
          `Object.defineProperty(${local}, ${JSON.stringify(m.name)}, { value: ${jsLiteral(m.value)}, enumerable: true });`,
        ] });
      } else if (m.type === 'AttributeMember') {
        members.push(this.planProperty(m, { owner: local, publicPath: mount.publicPath, tail: m.name, self: false, isNamespace: true, nsIdent: cNs, nativePath, gate: nsGate }));
      } else if (m.type === 'OperationMember') {
        members.push(this.planOperation(m, { owner: local, publicPath: mount.publicPath, tail: m.name, self: false, isNamespace: true, nsIdent: cNs, nativePath, gate: nsGate }));
      }
    }
    return { name: ns.name, local, mountExpr: mount.expr, publicPath: mount.publicPath, members };
  }

  // ---- classes ---------------------------------------------------------------

  planClassConstructor(iface) {
    const path = classPathOf(this.sub, iface.name);
    const ctorMember = iface.members.find((m) => m.type === 'ConstructorMember');
    const manualCtor = ctorMember && hasAttr(ctorMember, 'manual');
    const view = hasAttr(iface, 'view');
    const finalizeAttr = getAttr(iface, 'finalize');
    const finalize = finalizeAttr === 'deferred' ? 'Deferred' : 'InSweep';
    if (finalizeAttr && finalizeAttr !== 'deferred' && finalizeAttr !== 'insweep') {
      this.errors.push(new ValidationError(`[finalize=${finalizeAttr}] on interface '${iface.name}': expected insweep or deferred`, iface.loc));
    }
    const dtorTail = view ? null : this.claimTail(`${iface.name}_dtor`, iface.loc);
    const dtor = view ? null : this.addNative({
      tail: dtorTail, cName: this.cName(dtorTail), jsPath: null, kind: 'dtor',
      ret: { c: 'void' }, cParams: [{ c: 'void*', name: 'self' }], bronzeParams: [],
      comment: `destructor of ${path}: frees what the constructor (or a native returning a ${iface.name}) allocated`,
    });

    const tail = this.claimTail(iface.name, iface.loc);
    const native = this.addNative({
      tail, cName: this.cName(`${iface.name}_ctor`), jsPath: this.jsPath(tail), kind: 'ctor',
      className: path, ret: { c: 'void*', bronze: path }, cParams: [], bronzeParams: [],
      dtor: dtor ? dtor.cName : null, finalize, publicName: iface.name,
      comment: '',
    });

    let ctorPlan;
    if (ctorMember && !manualCtor) {
      const args = this.planArgs(ctorMember.parameters, { what: `constructor of '${iface.name}'`, loc: ctorMember.loc, publicPath: '' });
      native.cParams.push(...args.cParams);
      native.bronzeParams.push(...args.bronzeParams);
      native.comment = `constructor of ${path}: returns the handle's data (freed by ${dtor ? dtor.cName : 'nobody: [view]'})`;
      ctorPlan = { kind: 'generated', params: args.jsParams, prelude: args.prelude, jsArgs: args.jsArgs };
    } else {
      native.comment = manualCtor
        ? `constructor of ${path}, minted for the class; the JS constructor is [manual] and may call this zero-argument spelling`
        : `constructor of ${path}: registered so the class exists (instances come from natives returning a ${iface.name}); never called by the wrapper, the body may return NULL`;
      ctorPlan = { kind: manualCtor ? 'manual' : 'none' };
    }
    this.classInfo.set(iface.name, { ctorPlan, path });
    return native;
  }

  planClassMembers(iface) {
    const mount = this.mountForInterface(iface);
    const publicPath = mount.publicPath ? `${mount.publicPath}.${mount.name}` : mount.name;
    const { path, ctorPlan } = this.classInfo.get(iface.name);
    const members = [];
    const statics = [];
    const constants = [];
    for (const m of iface.members) {
      if (m.type === 'ConstructorMember') continue;
      if (m.type === 'ConstantMember') {
        constants.push({ name: m.name, value: jsLiteral(m.value) });
        continue;
      }
      const isStatic = Boolean(m.isStatic);
      const target = isStatic ? statics : members;
      const owner = isStatic ? iface.name : `${iface.name}.prototype`;
      const scope = {
        owner, publicPath: isStatic ? publicPath : `${publicPath}.prototype`,
        tail: `${iface.name}_${m.name}`, self: !isStatic, selfPath: path, isNamespace: false,
      };
      if (m.type === 'AttributeMember') target.push(this.planProperty(m, scope));
      else if (m.type === 'OperationMember') target.push(this.planOperation(m, scope));
    }
    if (ctorPlan.kind === 'manual') {
      this.manual.push({ publicPath, member: 'constructor', note: 'the constructor' });
    }
    return {
      name: iface.name, path, publicPath, mountExpr: mount.expr, mountName: mount.name,
      ctor: ctorPlan, members, statics, constants,
    };
  }

  // ---- properties ------------------------------------------------------------

  planProperty(m, scope) {
    const publicMember = `${scope.publicPath}.${m.name}`;
    if (hasAttr(m, 'manual')) {
      this.manual.push({ publicPath: scope.publicPath, member: m.name, note: 'an accessor' });
      return { kind: 'manual', name: m.name, note: 'accessor', publicMember };
    }
    const r = resolveShape(m.dataType, 'return', this.ctx, m.loc, `attribute '${m.name}' of ${scope.publicPath}`);
    if (r.error) {
      this.errors.push(r.error);
      return { kind: 'error', name: m.name };
    }
    const shape = r.shape;
    if (shape.kind === 'void') {
      this.errors.push(new ValidationError(`attribute '${m.name}' of ${scope.publicPath} cannot be void`, m.loc));
      return { kind: 'error', name: m.name };
    }
    if (shape.kind === 'dict' || shape.kind === 'seqDict' || shape.kind === 'seqHandle') {
      // An attribute reads like a zero-parameter operation.
      const op = { ...m, type: 'OperationMember', returnType: m.dataType, parameters: [], isStatic: m.isStatic };
      const plan = this.planOperation(op, { ...scope, tail: `${scope.tail}_get` });
      return { ...plan, kind: 'getterOp', name: m.name, readonly: true };
    }
    this.noteDependency(shape);
    const isNsProp = Boolean(scope.isNamespace);
    const selfParams = scope.self ? [{ c: 'void*', name: 'self' }] : [];
    const selfBronze = scope.self ? [scope.selfPath] : [];
    const ret = this.retSpec(shape, hasAttr(m, 'transfer'));

    // Read half.
    const getTail = this.claimTail(`${scope.tail}_get`, m.loc, scope);
    const getNative = this.addNative({
      tail: getTail, cName: this.cName(getTail, scope),
      jsPath: isNsProp ? this.jsPath(m.name, scope) : this.jsPath(getTail, scope),
      kind: isNsProp ? 'getter' : 'fn',
      ret: ret.cRet, cParams: [...selfParams, ...ret.extraCParams], bronzeParams: [...selfBronze],
      transfer: ret.transfer,
      comment: `${publicMember} read${scope.self ? '' : ''}`,
    }, scope);
    const getCall = isNsProp ? getNative.jsPath : `${getNative.jsPath}(${scope.self ? 'this' : ''})`;
    const getLines = ret.result(getCall);

    let setLines = null;
    if (!m.readonly) {
      const setTail = this.claimTail(`${scope.tail}_set`, m.loc, scope);
      const arg = this.argPlan(shape, 'v', 'required', 'v', 'v', { what: publicMember, loc: m.loc, setter: true });
      const setNative = this.addNative({
        tail: setTail, cName: this.cName(setTail, scope),
        jsPath: isNsProp ? this.jsPath(m.name, scope) : this.jsPath(setTail, scope),
        kind: isNsProp ? 'setter' : 'fn',
        ret: { c: 'void', bronze: 'void' }, cParams: [...selfParams, ...arg.cParams], bronzeParams: [...selfBronze, ...arg.bronzeParams],
        comment: `${publicMember} write`,
      }, scope);
      setLines = [...arg.prelude];
      if (isNsProp) setLines.push(`${setNative.jsPath} = ${arg.jsArgs[0]};`);
      else setLines.push(`${setNative.jsPath}(${[scope.self ? 'this' : null, ...arg.jsArgs].filter((x) => x !== null).join(', ')});`);
    }
    return { kind: 'accessor', name: m.name, getLines, setLines, readonly: m.readonly, publicMember };
  }

  // ---- operations -----------------------------------------------------------

  planOperation(op, scope) {
    const publicMember = `${scope.publicPath}.${op.name}`;
    const jsParamNames = op.parameters.map((p) => p.name);
    if (hasAttr(op, 'manual')) {
      this.manual.push({ publicPath: scope.publicPath, member: op.name, note: `operation (${jsParamNames.join(', ')})` });
      return { kind: 'manual', name: op.name, note: `operation (${jsParamNames.join(', ')})`, publicMember };
    }
    const r = resolveShape(op.returnType, 'return', this.ctx, op.loc, `result of ${publicMember}`);
    if (r.error) {
      this.errors.push(r.error);
      return { kind: 'error', name: op.name };
    }
    const args = this.planArgs(op.parameters, { what: publicMember, loc: op.loc, publicPath: publicMember });
    const shape = r.shape;
    this.noteDependency(shape);
    const selfParams = scope.self ? [{ c: 'void*', name: 'self' }] : [];
    const selfBronze = scope.self ? [scope.selfPath] : [];
    const selfArg = scope.self ? ['this'] : [];
    const tail = this.claimTail(scope.tail, op.loc, scope);
    const transfer = hasAttr(op, 'transfer');
    const lines = [...args.check, ...args.prelude];

    if (shape.kind === 'dict' || shape.kind === 'seqDict' || shape.kind === 'seqHandle') {
      // The operation runs and stashes; the reads answer from the stash.
      const indexed = shape.kind !== 'dict';
      const native = this.addNative({
        tail, cName: this.cName(tail, scope), jsPath: this.jsPath(tail, scope), kind: 'fn',
        ret: shape.kind === 'dict'
          ? (shape.nullable ? { c: 'bool', bronze: 'bool' } : { c: 'void', bronze: 'void' })
          : { c: 'int32_t', bronze: 'i32' },
        cParams: [...selfParams, ...args.cParams], bronzeParams: [...selfBronze, ...args.bronzeParams],
        comment: shape.kind === 'dict'
          ? `${publicMember}: runs the operation and keeps its ${shape.dict.name} result in a per-thread slot the ${tail}_<member> reads answer from until the next call${shape.nullable ? '; false = null' : ''}`
          : `${publicMember}: runs the operation, keeps the list in a per-thread slot, and answers its length; ${tail}_${shape.kind === 'seqHandle' ? 'at' : '<member>'}(index) reads from it`,
      }, scope);
      const call = `${native.jsPath}(${[...selfArg, ...args.jsArgs].join(', ')})`;
      if (shape.kind === 'dict') {
        if (shape.nullable) lines.push(`if (!${call}) return null;`);
        else lines.push(`${call};`);
        const obj = this.planDictReads(shape.dict, tail, [], false, transfer, scope);
        lines.push(`return ${obj};`);
      } else if (shape.kind === 'seqDict') {
        lines.push(`const n = ${call};`, 'const out = new Array(n);', 'for (let i = 0; i < n; i++) {');
        const obj = this.planDictReads(shape.dict, tail, [], true, transfer, scope);
        lines.push(`${INDENT}out[i] = ${obj};`, '}', 'return out;');
      } else {
        const atTail = this.claimTail(`${tail}_at`, op.loc, scope);
        const at = this.addNative({
          tail: atTail, cName: this.cName(atTail, scope), jsPath: this.jsPath(atTail, scope), kind: 'fn',
          ret: { c: 'void*', bronze: shape.path }, cParams: [{ c: 'int32_t', name: 'index' }], bronzeParams: ['i32'],
          comment: `${publicMember}: element [index] of the list ${tail} kept, as a ${shape.className} handle`,
        }, scope);
        lines.push(`const n = ${call};`, 'const out = new Array(n);',
          `for (let i = 0; i < n; i++) out[i] = ${at.jsPath}(i);`, 'return out;');
      }
    } else {
      const ret = this.retSpec(shape, transfer);
      const native = this.addNative({
        tail, cName: this.cName(tail, scope), jsPath: this.jsPath(tail, scope), kind: 'fn',
        ret: ret.cRet, cParams: [...selfParams, ...args.cParams, ...ret.extraCParams],
        bronzeParams: [...selfBronze, ...args.bronzeParams], transfer: ret.transfer,
        comment: publicMember,
      }, scope);
      const call = `${native.jsPath}(${[...selfArg, ...args.jsArgs].join(', ')})`;
      lines.push(...ret.result(call));
    }
    return { kind: 'operation', name: op.name, params: jsParamNames, lines, publicMember };
  }

  // The reads of a dictionary result: one native per leaf member, an object
  // literal that calls them. `indexed` reads take the list index. A [manual]
  // member has no read: the hand-written wrapper assembles it (from the other
  // members, typically), so the object literal leaves it out.
  planDictReads(dict, tail, pathParts, indexed, transfer, scope) {
    const fields = [];
    for (const m of dictionaryMembers(dict, this.ctx)) {
      if (hasAttr(m, 'manual')) continue;
      const memberPath = [...pathParts, m.name];
      const r = resolveShape(m.dataType, 'memberReturn', this.ctx, m.loc, `member '${m.name}' of dictionary '${dict.name}'`);
      if (r.error) { this.errors.push(r.error); continue; }
      const shape = r.shape;
      if (shape.kind === 'dict') {
        fields.push(`${m.name}: ${this.planDictReads(shape.dict, tail, memberPath, indexed, transfer, scope)}`);
        continue;
      }
      this.noteDependency(shape);
      const readTail = this.claimTail(`${tail}_${memberPath.join('_')}`, m.loc, scope);
      const ret = this.retSpec(shape, transfer || hasAttr(m, 'transfer'));
      const native = this.addNative({
        tail: readTail, cName: this.cName(readTail, scope), jsPath: this.jsPath(readTail, scope), kind: 'fn',
        ret: ret.cRet, cParams: [...(indexed ? [{ c: 'int32_t', name: 'index' }] : []), ...ret.extraCParams],
        bronzeParams: indexed ? ['i32'] : [], transfer: ret.transfer,
        comment: `${dict.name}.${memberPath.join('.')} of the result ${tail} kept${indexed ? ', at [index]' : ''}`,
      }, scope);
      const call = `${native.jsPath}(${indexed ? 'i' : ''})`;
      fields.push(`${m.name}: ${ret.expr(call)}`);
    }
    return `{ ${fields.join(', ')} }`;
  }

  // How a result shape crosses: the C return type, any trailing buffer
  // parameter, and the JS that turns the call into the documented value.
  retSpec(shape, transfer) {
    switch (shape.kind) {
      case 'void':
        return { cRet: { c: 'void', bronze: 'void' }, extraCParams: [], result: (call) => [`${call};`], expr: (call) => call };
      case 'scalar':
        return { cRet: { c: shape.c, bronze: shape.bronze }, extraCParams: [], result: (call) => [`return ${call};`], expr: (call) => call };
      case 'handle':
        return { cRet: { c: 'void*', bronze: shape.path }, extraCParams: [], result: (call) => [`return ${call};`], expr: (call) => call };
      case 'json':
        return { cRet: { c: 'const char*', bronze: 'str', json: shape.jsonOf }, extraCParams: [], result: (call) => [`return JSON.parse(${call});`], expr: (call) => `JSON.parse(${call})` };
      case 'array': {
        let expr;
        if (shape.retAs === 'array') expr = (call) => `Array.from(${call})`;
        else if (shape.retAs === 'buffer') { this.helpers.add('bufferOf'); expr = (call) => `bufferOf(${call})`; }
        else expr = (call) => call;
        return {
          cRet: { c: 'void', bronze: shape.bronze, buffer: true },
          extraCParams: [{ c: 'bronze_native_buffer*', name: 'out' }],
          transfer: Boolean(transfer),
          result: (call) => [`return ${expr(call)};`], expr,
        };
      }
      default:
        throw new Error(`retSpec: unexpected shape ${shape.kind}`);
    }
  }

  noteDependency(shape) {
    const sub = shape && (shape.subsystem);
    if (sub && sub !== this.sub) this.dependsOn.add(sub);
  }

  // ---- arguments --------------------------------------------------------------

  // Every parameter of an operation: the C parameters they become, the
  // bronze types, the JS argument expressions, the required checks and
  // the dictionary preludes.
  planArgs(parameters, info) {
    const out = { cParams: [], bronzeParams: [], jsArgs: [], check: [], prelude: [], jsParams: parameters.map((p) => p.name) };
    for (const p of parameters) {
      if (p.variadic) {
        this.errors.push(new ValidationError(`parameter '${p.name}' of ${info.what}: a variadic parameter has no native spelling; declare a sequence<T>, or [manual]`, p.loc || info.loc));
        continue;
      }
      const r = resolveShape(p.dataType, 'param', this.ctx, p.loc || info.loc, `parameter '${p.name}' of ${info.what}`);
      if (r.error) { this.errors.push(r.error); continue; }
      const mode = !p.optional ? 'required' : (p.defaultValue !== null ? { default: p.defaultValue } : 'optional');
      const a = this.argPlan(r.shape, p.name, mode, cIdent(p.name), p.name, { what: info.what, loc: p.loc || info.loc, strict: hasAttr(p, 'strict') });
      out.cParams.push(...a.cParams);
      out.bronzeParams.push(...a.bronzeParams);
      out.jsArgs.push(...a.jsArgs);
      out.check.push(...a.check);
      out.prelude.push(...a.prelude);
    }
    return out;
  }

  /**
   * One value crossing in. `src` is the JS expression holding it, `mode` is
   * 'required', 'optional' (no declared default) or {default}. `info.strict`
   * is the [strict] attribute: a string the wrapper type-checks rather than
   * letting the native lowering ToString-coerce (a number handed to a loader
   * path would otherwise become a wrong path, not a TypeError).
   */
  argPlan(shape, src, mode, cName, jsName, info) {
    // jsZeros runs parallel to jsArgs: the expression each argument takes
    // when an enclosing optional dictionary was not passed at all.
    const out = { cParams: [], bronzeParams: [], jsArgs: [], jsZeros: [], check: [], prelude: [] };
    const required = mode === 'required';
    const dflt = mode !== 'required' && mode !== 'optional' ? mode.default : undefined;
    const optionalNoDefault = mode === 'optional';
    const what = `${info.what}: ${jsName}`;
    if (required && !info.setter) out.check.push(`if (${src} === undefined) throw new TypeError(${JSON.stringify(`${what} is required`)});`);
    if (info.strict) {
      if (shape.kind !== 'scalar' || shape.bronze !== 'str') {
        this.errors.push(new ValidationError(
          `${what}: [strict] applies to a DOMString (the only type the native lowering coerces silently); drop it, or declare a DOMString`, info.loc));
        return out;
      }
      out.check.push(`if (${src} !== undefined && typeof ${src} !== 'string') throw new TypeError(${JSON.stringify(`${what} must be a string`)});`);
    }
    this.noteDependency(shape);

    switch (shape.kind) {
      case 'scalar': {
        if (optionalNoDefault) {
          out.cParams.push({ c: 'bool', name: `${cName}_given` }, { c: shape.c, name: cName });
          out.bronzeParams.push('bool', shape.bronze);
          out.jsArgs.push(`${src} !== undefined`, `${src} === undefined ? ${shape.zero} : ${src}`);
          out.jsZeros.push('false', shape.zero);
        } else {
          out.cParams.push({ c: shape.c, name: cName });
          out.bronzeParams.push(shape.bronze);
          out.jsArgs.push(dflt !== undefined ? `${src} === undefined ? ${jsLiteral(dflt)} : ${src}` : src);
          out.jsZeros.push(dflt !== undefined ? jsLiteral(dflt) : shape.zero);
        }
        return out;
      }
      case 'array': {
        const conv = this.arrayConverter(shape);
        const empty = `EMPTY_${shape.elem.toUpperCase()}`;
        this.helpers.add(empty);
        out.cParams.push({ c: `const ${shape.c}*`, name: cName }, { c: 'uint32_t', name: `${cName}_len` });
        out.bronzeParams.push(shape.bronze);
        out.jsArgs.push(required ? `${conv}(${src})` : `${src} === undefined ? ${empty} : ${conv}(${src})`);
        out.jsZeros.push(empty);
        return out;
      }
      case 'handle': {
        if (!required) {
          this.errors.push(new ValidationError(
            `${what}: an optional ${shape.className} has no absent spelling (a missing handle is a TypeError at the call); make it required, or [manual]`, info.loc));
          return out;
        }
        out.cParams.push({ c: 'void*', name: cName });
        out.bronzeParams.push(shape.path);
        out.jsArgs.push(src);
        out.jsZeros.push(null);
        return out;
      }
      case 'callback': {
        out.cParams.push({ c: 'uint64_t', name: cName });
        out.bronzeParams.push('dynamic');
        out.jsArgs.push(src);
        out.jsZeros.push('undefined');
        return out;
      }
      case 'json': {
        out.cParams.push({ c: 'const char*', name: cName, json: shape.jsonOf });
        out.bronzeParams.push('str');
        if (required) out.jsArgs.push(`JSON.stringify(${src})`);
        else if (dflt !== undefined) out.jsArgs.push(`${src} === undefined ? ${JSON.stringify(JSON.stringify(dflt))} : JSON.stringify(${src})`);
        else out.jsArgs.push(`${src} === undefined ? '' : JSON.stringify(${src})`);
        out.jsZeros.push(dflt !== undefined ? JSON.stringify(JSON.stringify(dflt)) : "''");
        return out;
      }
      case 'dict':
        return this.dictArgPlan(shape, src, mode, cName, jsName, info, out);
      default:
        this.errors.push(new ValidationError(`${what}: a ${shape.kind} cannot be passed`, info.loc));
        return out;
    }
  }

  // A dictionary parameter unpacks member by member. With no declared
  // default and either required members or the dual-accept vector shape,
  // the C side gets a leading `bool <name>_given`, and every member reads
  // as absent when the dictionary is; otherwise an absent dictionary is
  // the same as one with every member absent, and no flag is needed. A
  // [manual] member does not cross (the hand-written wrapper folds it into
  // the members that do).
  dictArgPlan(shape, src, mode, cName, jsName, info, out) {
    const dict = shape.dict;
    const members = dictionaryMembers(dict, this.ctx).filter((m) => !hasAttr(m, 'manual'));
    const local = `d_${cName}`;
    const required = mode === 'required';
    const optionalNoDefault = mode === 'optional';
    const needsFlag = optionalNoDefault && (shape.dualAccept || members.some((m) => m.required));
    if (needsFlag) {
      out.cParams.push({ c: 'bool', name: `${cName}_given` });
      out.bronzeParams.push('bool');
      out.jsArgs.push(`${src} !== undefined`);
      out.jsZeros.push('false');
      out.prelude.push(`const ${local} = ${src} === undefined ? null : ${src};`);
    } else if (required) {
      out.prelude.push(`const ${local} = ${src};`);
    } else {
      out.prelude.push(`const ${local} = ${src} === undefined ? {} : ${src};`);
    }
    members.forEach((m, index) => {
      const memberWhat = `member '${m.name}' of dictionary '${dict.name}' (${info.what})`;
      const r = resolveShape(m.dataType, 'member', this.ctx, m.loc || info.loc, memberWhat);
      if (r.error) { this.errors.push(r.error); return; }
      if (needsFlag && r.shape.kind === 'handle') {
        this.errors.push(new ValidationError(
          `${memberWhat}: a handle member of a dictionary that may be absent has no absent spelling; give the dictionary a default (= {}), or [manual]`, m.loc || info.loc));
        return;
      }
      let memberSrc;
      if (shape.dualAccept) {
        this.helpers.add('vc');
        memberSrc = `vc(${local}, ${index}, ${JSON.stringify(m.name)})`;
      } else {
        memberSrc = `${local}.${m.name}`;
      }
      const mMode = m.required ? 'required' : (m.defaultValue !== null ? { default: m.defaultValue } : 'optional');
      const sub = this.argPlan(r.shape, memberSrc, mMode, `${cName}_${cIdent(m.name)}`, `${jsName}.${m.name}`, { what: info.what, loc: m.loc || info.loc, strict: hasAttr(m, 'strict') });
      if (needsFlag) {
        // Absent dictionary: every member argument is its absent value, and
        // no member is required.
        sub.check = sub.check.map((line) => line.replace('if (', `if (${local} !== null && `));
        sub.jsArgs = sub.jsArgs.map((expr, i) => `${local} === null ? ${sub.jsZeros[i]} : (${expr})`);
      }
      out.cParams.push(...sub.cParams);
      out.bronzeParams.push(...sub.bronzeParams);
      out.jsArgs.push(...sub.jsArgs);
      out.jsZeros.push(...sub.jsZeros);
      out.prelude.push(...sub.check);
      out.prelude.push(...sub.prelude);
    });
    return out;
  }

  arrayConverter(shape) {
    if (shape.source === 'bytes' || shape.source === 'view') {
      this.helpers.add('bytesOf');
      return 'bytesOf';
    }
    const name = `to${shape.elem.toUpperCase()}`;
    this.helpers.add(name);
    return name;
  }
}

/** The helper definitions a wrapper may need, keyed by name. */
export const JS_HELPERS = {
  mount: "const mount = (root, name) => root[name] !== undefined ? root[name] : (root[name] = {});",
  vc: "const vc = (v, i, k) => v[k] !== undefined ? v[k] : v[i];",
  bytesOf: "const bytesOf = (v) => v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);",
  bufferOf: "const bufferOf = (a) => a.byteOffset === 0 && a.byteLength === a.buffer.byteLength ? a.buffer : a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength);",
};
for (const [elem, k] of Object.entries(ARRAY_KINDS)) {
  JS_HELPERS[`to${elem.toUpperCase()}`] = `const to${elem.toUpperCase()} = (v) => v instanceof ${k.jsCtor} ? v : ${k.jsCtor}.from(v);`;
  JS_HELPERS[`EMPTY_${elem.toUpperCase()}`] = `const EMPTY_${elem.toUpperCase()} = new ${k.jsCtor}(0);`;
}

export { SCALARS, ARRAY_KINDS };
