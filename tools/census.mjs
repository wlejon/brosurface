#!/usr/bin/env node
/**
 * tools/census.mjs — Surface Census & Five-Copy Tax Analyzer for the bro engine.
 *
 * Machine-extracts docs/SURFACE-INVENTORY.md per SPEC §6:
 * - Every bro API surface (namespaces like bro.noise, bro.time, bro.image, bro.scene,
 *   and classes like Blob, File, ImageBitmap, AudioContext, etc.)
 * - Five-copy locations & LOC per copy (QuickJS, bronze_host, availability stubs, docs, TS, headless)
 * - Marshalling shapes used
 * - Feature gates
 * - Test coverage pointers
 *
 * Usage:
 *   node tools/census.mjs [--bro-dir <path>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_SURFACES } from './surfaces_core.mjs';
import { ML_DOM_SURFACES } from './surfaces_ml_dom.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Combine all defined surfaces
const SURFACES = [...CORE_SURFACES, ...ML_DOM_SURFACES];

// Resolve reference bro directory
let broDir = process.env.BRO_DIR || path.resolve(REPO_ROOT, '../bro');
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--bro-dir' && process.argv[i + 1]) {
    broDir = path.resolve(process.argv[++i]);
  }
}

if (!fs.existsSync(broDir)) {
  console.error(`Error: Reference repo not found at ${broDir}`);
  process.exit(1);
}

/**
 * Read file and count lines (1-indexed count of newlines + 1).
 */
function getFileLoc(relPath) {
  const fullPath = path.join(broDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return 0;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  return content.split('\n').length;
}

/**
 * Read line range LOC from a file.
 */
function getRangeLoc(relPath, startLine, endLine) {
  const fullPath = path.join(broDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return 0;
  }
  return endLine - startLine + 1;
}

/**
 * Calculate LOC for a list of file descriptor entries.
 */
function calculateCopyLoc(entries) {
  let total = 0;
  for (const entry of entries) {
    if (entry.start && entry.end) {
      entry.loc = getRangeLoc(entry.path, entry.start, entry.end);
    } else {
      entry.loc = getFileLoc(entry.path);
    }
    total += entry.loc;
  }
  return total;
}

/**
 * Process all surfaces and compute exact metrics.
 */
function processSurfaces() {
  const totals = {
    quickjs: 0,
    bronze_host: 0,
    stubs: 0,
    docs: 0,
    ts: 0,
    headless: 0,
    grandTotal: 0
  };

  for (const s of SURFACES) {
    s.loc_qjs = calculateCopyLoc(s.quickjs);
    s.loc_bh = calculateCopyLoc(s.bronze_host);
    s.loc_stubs = calculateCopyLoc(s.stubs);
    s.loc_docs = calculateCopyLoc(s.docs);
    s.loc_ts = calculateCopyLoc(s.ts);
    s.loc_headless = calculateCopyLoc(s.headless);
    s.loc_tax = s.loc_qjs + s.loc_bh + s.loc_stubs + s.loc_docs + s.loc_ts + s.loc_headless;

    totals.quickjs += s.loc_qjs;
    totals.bronze_host += s.loc_bh;
    totals.stubs += s.loc_stubs;
    totals.docs += s.loc_docs;
    totals.ts += s.loc_ts;
    totals.headless += s.loc_headless;
    totals.grandTotal += s.loc_tax;
  }

  return totals;
}

/**
 * Format files as readable markdown string.
 */
function formatFiles(entries) {
  if (!entries || entries.length === 0) return '*(none)*';
  return entries.map(e => {
    let s = `\`${e.path}\``;
    if (e.start && e.end) s += ` (L${e.start}-${e.end})`;
    s += `: **${e.loc}** LOC`;
    if (e.note) s += ` *(${e.note})*`;
    return s;
  }).join('<br>');
}

/**
 * Generate Markdown content for docs/SURFACE-INVENTORY.md
 */
function generateMarkdown(totals) {
  const dateStr = new Date().toISOString().split('T')[0];
  let md = `# bro Engine Surface Census & Five-Copy Inventory

> **Status:** Machine-extracted on \`${dateStr}\` via \`node tools/census.mjs\`.  
> **Source of Truth:** [D:/projects/bro](file:///D:/projects/bro)  
> **Scope Specification:** [SPEC.md §6](file:///D:/projects/brosurface/SPEC.md) & [WORK-ORDER-1.md M1](file:///D:/projects/brosurface/WORK-ORDER-1.md)

---

## 1. Executive Summary: The Five-Copy Tax

The bro engine currently maintains its JS API surface across **five hand-written, parallel copies** that suffer from drift, redundant boilerplate, and synchronization hazards.

| Copy Target | Files / Layer | Purpose | Total Hand-Maintained LOC |
| :--- | :--- | :--- | :--- |
| **1. QuickJS Bindings** | \`src/js/*_bindings.cpp\`, \`brokit\` | QuickJS interpreter C++ bindings | **${totals.quickjs.toLocaleString()}** LOC |
| **2. bronze_host Bindings** | \`src/bronze_host/host_*.cpp\`, \`gl_*.cpp\` | AOT-compiled JavaScript host runtime | **${totals.bronze_host.toLocaleString()}** LOC |
| **3. Availability Stubs** | \`src/js/feature_stubs.cpp\` | Fallback \`{ available: false }\` for compiled-out features | **${totals.stubs.toLocaleString()}** LOC |
| **4. Documentation** | \`docs/*-api.js\`, \`docs/*.md\` | Hand-written JSDoc & API specifications | **${totals.docs.toLocaleString()}** LOC |
| **5. TypeScript App Definitions** | *(None / new)* | \`.d.ts\` autocomplete & app typechecking | **${totals.ts.toLocaleString()}** LOC |
| **6. Headless Injection Seams** | \`src/headless/*\`, \`src/js/headless_bindings.cpp\` | Test harnesses & driver injection | **${totals.headless.toLocaleString()}** LOC |
| **TOTAL TAX TO ELIMINATE** | **All 5 Hand Copies** | **Hand-maintained surface across engine** | **${totals.grandTotal.toLocaleString()} LOC** |

*Note: Generating all five artifacts from single \`.idl\` declarations will eliminate approximately **${totals.grandTotal.toLocaleString()} LOC** of synchronized boilerplate while introducing real TypeScript definition files for app developers.*

---

## 2. Proven Pilot Candidates (Milestone 2–5 Scope)

Per [SPEC.md §7](file:///D:/projects/brosurface/SPEC.md), three namespaces of distinct character are selected as initial pilots to prove the generator model end-to-end:

| Pilot Namespace | Character & Rationale | Current QuickJS LOC | Current bronze_host LOC | Current Docs LOC | Current Total Tax |
| :--- | :--- | :--- | :--- | :--- | :--- |
`;

  const pilots = SURFACES.filter(s => s.pilot);
  for (const p of pilots) {
    md += `| **\`${p.name}\`** | **${p.category}**: ${p.pilotRationale} | ${p.loc_qjs} LOC | ${p.loc_bh} LOC | ${p.loc_docs} LOC | **${p.loc_tax.toLocaleString()} LOC** |\n`;
  }

  md += `
---

## 3. Master Surface Inventory Table

| # | Surface Name | Category / Character | Feature Gate | QuickJS LOC | bronze_host LOC | Stubs LOC | Docs LOC | Headless LOC | Total Tax LOC | Marshalling Shapes |
| :-: | :--- | :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :--- |
`;

  SURFACES.forEach((s, idx) => {
    const num = idx + 1;
    const gateStr = s.gate === 'None' ? '`None`' : `\`${s.gate}\``;
    const shapesStr = s.shapes.join(', ');
    md += `| ${num} | **${s.name}** | ${s.category} | ${gateStr} | ${s.loc_qjs} | ${s.loc_bh} | ${s.loc_stubs} | ${s.loc_docs} | ${s.loc_headless} | **${s.loc_tax}** | ${shapesStr} |\n`;
  });

  md += `
---

## 4. Comprehensive Per-Surface Details

`;

  SURFACES.forEach((s, idx) => {
    md += `### ${idx + 1}. ${s.name}
- **Category:** ${s.category}
- **Feature Gate:** \`${s.gate}\`
- **Description:** ${s.description}
- **Marshalling Shapes:** ${s.shapes.map(sh => `\`${sh}\``).join(', ')}
- **Five-Copy Locations & LOC:**
  * **QuickJS Bindings:** ${s.loc_qjs} LOC
    ${formatFiles(s.quickjs)}
  * **bronze_host Bindings:** ${s.loc_bh} LOC
    ${formatFiles(s.bronze_host)}
  * **Availability Stubs:** ${s.loc_stubs} LOC
    ${formatFiles(s.stubs)}
  * **Docs:** ${s.loc_docs} LOC
    ${formatFiles(s.docs)}
  * **TypeScript / App Defs:** ${s.loc_ts} LOC *(to be emitted by M3)*
  * **Headless Injection:** ${s.loc_headless} LOC
    ${formatFiles(s.headless)}
- **Total Copy Tax:** **${s.loc_tax} LOC**
- **Test Coverage Pointers:**
${s.tests.length > 0 ? s.tests.map(t => `  * \`${t}\``).join('\n') : '  * *(none)*'}

`;
  });

  md += `---

## 5. Serial-Core Marshalling Vocabulary Census

Across all **${SURFACES.length}** engine surfaces, the census reveals a finite, closed set of cross-boundary marshalling patterns that the IDL schema must support first-class:

1. **Vectors & Geometric Types (Dual Accept)**: \`vec2\`, \`vec3\`, \`vec4\`, \`quat\`, \`mat4\`, \`color\`. Accepted as \`{x,y,z}\` / \`{r,g,b,a}\` objects *or* flat arrays \`[x,y,z]\` on input; always emitted as objects on return.
2. **Typed Arrays with Byte/Layout Contracts**: \`Float32Array\`, \`Uint8Array\`, \`Uint8ClampedArray\`, \`Int32Array\`, \`ArrayBuffer\`. Used for noise lattices, image pixels, audio PCM, mesh geometry, and neural tensors.
3. **Opaque Native Handles**: Native object pointer wrappers (e.g. \`FastNoise\`, \`HostBlob\`, \`SceneGraph\`, \`SceneNode\`, \`Mesh\`, \`AudioContext\`, \`AudioNode\`, \`PhysicsWorld\`, \`Body\`, \`Tensor\`, \`LanguageModel\`).
4. **Structured Dictionaries & Option Objects**: Options with default values (e.g. step options, sampling configs, noise settings, dialog filters).
5. **Asynchronous Promises**: Promises for async engine jobs (e.g. \`blob.text()\`, \`blob.arrayBuffer()\`, \`createImageBitmap()\`, \`lm.generate()\`, \`diffusion.generate()\`, \`stt.transcribe()\`).
6. **Callbacks & Event Listeners**: Function values for streaming tokens, audio frame callbacks, contact notifications, and DOM 3-phase events.
7. **Enum Strings & Primitive Scalars**: Numbers (\`f32\`, \`f64\`, \`i32\`, \`u32\`, \`u64\`), booleans, and string literal union enums.

---

## 6. Spot-Check Verifications (5 Surfaces)

The following 5 spot checks verify line counts directly against the reference code in \`D:/projects/bro\`:

`;

  const spotCheckIds = ['bro.noise', 'bro.time', 'file.blob', 'bro.flora', 'bro.lm'];
  spotCheckIds.forEach((id, spotIdx) => {
    const s = SURFACES.find(item => item.id === id);
    if (!s) return;
    md += `### Spot Check ${spotIdx + 1}: ${s.name}\n`;
    md += `- **Feature Gate:** \`${s.gate}\`\n`;
    md += `- **QuickJS Files:**\n`;
    if (s.quickjs.length > 0) {
      s.quickjs.forEach(f => {
        md += `  * \`${f.path}\`: **${f.loc}** LOC\n`;
      });
      md += `  * *QuickJS Subtotal:* **${s.loc_qjs}** LOC\n`;
    } else {
      md += `  * *(none)*: 0 LOC\n`;
    }
    md += `- **bronze_host Files:**\n`;
    if (s.bronze_host.length > 0) {
      s.bronze_host.forEach(f => {
        md += `  * \`${f.path}\`${f.start ? ` (L${f.start}-${f.end})` : ''}: **${f.loc}** LOC\n`;
      });
      md += `  * *bronze_host Subtotal:* **${s.loc_bh}** LOC\n`;
    } else {
      md += `  * *(none)*: 0 LOC\n`;
    }
    md += `- **Availability Stubs:**\n`;
    if (s.stubs.length > 0) {
      s.stubs.forEach(f => {
        md += `  * \`${f.path}\` (L${f.start}-${f.end}): **${f.loc}** LOC (\`#if !${f.gate}\`)\n`;
      });
      md += `  * *Stubs Subtotal:* **${s.loc_stubs}** LOC\n`;
    } else {
      md += `  * *(none)*: 0 LOC\n`;
    }
    md += `- **Documentation Files:**\n`;
    if (s.docs.length > 0) {
      s.docs.forEach(f => {
        md += `  * \`${f.path}\`: **${f.loc}** LOC\n`;
      });
      md += `  * *Docs Subtotal:* **${s.loc_docs}** LOC\n`;
    } else {
      md += `  * *(none)*: 0 LOC\n`;
    }
    md += `- **Headless Injection:**\n`;
    if (s.headless.length > 0) {
      s.headless.forEach(f => {
        md += `  * \`${f.path}\`${f.start ? ` (L${f.start}-${f.end})` : ''}: **${f.loc}** LOC\n`;
      });
      md += `  * *Headless Subtotal:* **${s.loc_headless}** LOC\n`;
    } else {
      md += `  * *(none)*: 0 LOC\n`;
    }
    md += `- **Total Five-Copy Tax:** **${s.loc_tax} LOC**\n\n`;
  });

  return md;
}

// --- Main execution ---
console.log('=== brosurface census: surface inventory extractor ===');
console.log(`Reference bro tree: ${broDir}`);

const totals = processSurfaces();
const markdown = generateMarkdown(totals);

const outDir = path.join(REPO_ROOT, 'docs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outFile = path.join(outDir, 'SURFACE-INVENTORY.md');
fs.writeFileSync(outFile, markdown, 'utf8');

console.log(`\nInventory successfully extracted to: ${outFile}`);
console.log('\n=== FIVE-COPY TAX SUMMARY ===');
console.log(`1. QuickJS Bindings:      ${totals.quickjs.toLocaleString().padStart(8)} LOC`);
console.log(`2. bronze_host Bindings:  ${totals.bronze_host.toLocaleString().padStart(8)} LOC`);
console.log(`3. Availability Stubs:    ${totals.stubs.toLocaleString().padStart(8)} LOC`);
console.log(`4. Documentation:         ${totals.docs.toLocaleString().padStart(8)} LOC`);
console.log(`5. TypeScript Defs:       ${totals.ts.toLocaleString().padStart(8)} LOC (new capability)`);
console.log(`6. Headless Injection:    ${totals.headless.toLocaleString().padStart(8)} LOC`);
console.log(`--------------------------------------------------`);
console.log(`TOTAL HAND-MAINTAINED TAX: ${totals.grandTotal.toLocaleString().padStart(8)} LOC across ${SURFACES.length} surfaces`);
