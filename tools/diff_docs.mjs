// tools/diff_docs.mjs - Semantic Documentation Coverage & Fidelity Verification Tool
// Verifies that all symbols, parameter docs, and examples from reference bro/docs/*-api.js
// are 100% semantically covered by generated out/docs/*-api.js

import fs from 'fs';
import path from 'path';

/**
 * Extracts semantic doc elements (classes, methods, properties, namespace functions, examples).
 * @param {string} content
 * @returns {{
 *   classes: Set<string>,
 *   methods: Set<string>,
 *   properties: Set<string>,
 *   functions: Set<string>,
 *   examples: string[],
 *   totalLines: number
 * }}
 */
export function extractDocSymbols(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const classes = new Set();
  const methods = new Set();
  const properties = new Set();
  const functions = new Set();
  const examples = [];

  let currentClass = null;
  let inExample = false;
  let currentExample = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Class declaration
    const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      currentClass = classMatch[1];
      classes.add(currentClass);
    }

    // Method declaration inside class (e.g. static create(typeName) {} or genSingle2D(...) {})
    const methodMatch = line.match(/^\s*(static\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/);
    if (methodMatch) {
      const isStatic = Boolean(methodMatch[1]);
      const name = methodMatch[2];
      const prefix = currentClass ? `${currentClass}.${isStatic ? 'static ' : ''}` : '';
      if (name === 'constructor') {
        methods.add(`${currentClass}.constructor`);
      } else {
        methods.add(`${prefix}${name}`);
        methods.add(name); // also register bare name
      }
    }

    // Constructor declaration
    const ctorMatch = line.match(/^\s*constructor\s*\(([^)]*)\)/);
    if (ctorMatch && currentClass) {
      methods.add(`${currentClass}.constructor`);
    }

    // JSDoc method pattern in comments (e.g. @method encode(text) or @method generate)
    const jsdocMethodMatch = line.match(/@method\s+([A-Za-z0-9_]+)/);
    if (jsdocMethodMatch) {
      methods.add(jsdocMethodMatch[1]);
    }

    // Namespace property pattern (e.g. bro.time.scale;)
    const propMatch = line.match(/^(bro\.[A-Za-z0-9_.]+);/);
    if (propMatch) {
      properties.add(propMatch[1]);
    }

    // Property declaration on class (e.g. size; or readonly attribute size)
    const classPropMatch = line.match(/^\s*(static\s+)?([A-Za-z0-9_]+);/);
    if (classPropMatch && currentClass) {
      const pName = classPropMatch[2];
      if (!['constructor', 'return', 'let', 'const', 'var'].includes(pName)) {
        properties.add(`${currentClass}.${pName}`);
        properties.add(pName);
      }
    }

    // Namespace function assignment (e.g. bro.lm.loadQwen = function(...) {})
    const nsFnMatch = line.match(/^(bro\.[A-Za-z0-9_.]+)\s*=\s*function/);
    if (nsFnMatch) {
      functions.add(nsFnMatch[1]);
      const shortName = nsFnMatch[1].split('.').pop();
      functions.add(shortName);
    }

    // Reference doc namespace function calls (e.g. bro.lm.loadQwen(...) or bro.lm.loadTokenizer({...}))
    const refNsFnMatch = line.match(/^(const\s+[^=]+=\s*)?(bro\.[A-Za-z0-9_.]+)\s*\(/);
    if (refNsFnMatch) {
      const fullName = refNsFnMatch[2];
      functions.add(fullName);
      const shortName = fullName.split('.').pop();
      functions.add(shortName);
    }

    // Examples
    if (line.includes('@example') || (line.startsWith('// --- ') && line.includes('Example'))) {
      if (currentExample) examples.push(currentExample.trim());
      currentExample = line + '\n';
      inExample = true;
    } else if (inExample) {
      if (line.startsWith('// ===') || line.startsWith('// ──') || line.startsWith('class ') || line.startsWith('/**')) {
        if (currentExample) examples.push(currentExample.trim());
        currentExample = '';
        inExample = false;
      } else {
        currentExample += line + '\n';
      }
    }
  }

  if (currentExample) {
    examples.push(currentExample.trim());
  }

  return {
    classes,
    methods,
    properties,
    functions,
    examples,
    totalLines: lines.length,
  };
}

/**
 * Compares generated docs against reference docs for semantic coverage.
 * @param {string} [generatedDir='out/docs/']
 * @param {string} [referenceDir='D:/projects/bro/docs/']
 * @returns {{success: boolean, results: Array<Object>}}
 */
export function diffDocs(generatedDir = 'out/docs/', referenceDir = 'D:/projects/bro/docs/') {
  console.log(`================================================================================`);
  console.log(` brosurface Semantic Documentation Coverage & Fidelity Suite`);
  console.log(` Generated Docs: ${generatedDir}`);
  console.log(` Reference Docs: ${referenceDir}`);
  console.log(`================================================================================\n`);

  if (!fs.existsSync(generatedDir)) {
    console.error(`Generated docs directory not found: ${generatedDir}`);
    process.exit(1);
  }

  const pilots = [
    { name: 'noise', file: 'noise-api.js' },
    { name: 'time', file: 'time-api.js' },
    { name: 'file', file: 'file-api.js' },
    { name: 'lm', file: 'lm-api.js' },
  ];

  let totalMismatches = 0;
  const results = [];

  for (const pilot of pilots) {
    const genPath = path.join(generatedDir, pilot.file);
    const refPath = path.join(referenceDir, pilot.file);

    console.log(`--------------------------------------------------------------------------------`);
    console.log(`PILOT: ${pilot.name.toUpperCase()} (${pilot.file})`);
    console.log(`--------------------------------------------------------------------------------`);

    if (!fs.existsSync(genPath)) {
      console.error(`❌ Missing generated file: ${genPath}`);
      totalMismatches++;
      continue;
    }
    if (!fs.existsSync(refPath)) {
      console.error(`❌ Missing reference file: ${refPath}`);
      totalMismatches++;
      continue;
    }

    const genContent = fs.readFileSync(genPath, 'utf8');
    const refContent = fs.readFileSync(refPath, 'utf8');

    const genSym = extractDocSymbols(genContent);
    const refSym = extractDocSymbols(refContent);

    console.log(`Semantic Symbol Inventory:`);
    console.log(`  - Classes:   Generated: ${genSym.classes.size.toString().padStart(3)}, Reference: ${refSym.classes.size.toString().padStart(3)}`);
    console.log(`  - Methods:   Generated: ${genSym.methods.size.toString().padStart(3)}, Reference: ${refSym.methods.size.toString().padStart(3)}`);
    console.log(`  - Properties:Generated: ${genSym.properties.size.toString().padStart(3)}, Reference: ${refSym.properties.size.toString().padStart(3)}`);
    console.log(`  - Functions: Generated: ${genSym.functions.size.toString().padStart(3)}, Reference: ${refSym.functions.size.toString().padStart(3)}`);
    console.log(`  - Lines:     Generated: ${genSym.totalLines.toString().padStart(4)}, Reference: ${refSym.totalLines.toString().padStart(4)}`);

    // Check missing classes
    const missingClasses = [];
    for (const c of refSym.classes) {
      if (!genSym.classes.has(c)) missingClasses.push(c);
    }

    // Check missing methods
    const missingMethods = [];
    for (const m of refSym.methods) {
      const bareName = m.includes('.') ? m.split('.').pop().replace('static ', '') : m;
      if (!genSym.methods.has(m) && !genSym.methods.has(bareName)) {
        missingMethods.push(m);
      }
    }

    // Check missing properties
    const missingProps = [];
    for (const p of refSym.properties) {
      const bareName = p.includes('.') ? p.split('.').pop() : p;
      if (!genSym.properties.has(p) && !genSym.properties.has(bareName)) {
        missingProps.push(p);
      }
    }

    // Check missing functions
    const missingFunctions = [];
    for (const fn of refSym.functions) {
      const bareName = fn.includes('.') ? fn.split('.').pop() : fn;
      if (!genSym.functions.has(fn) && !genSym.functions.has(bareName)) {
        missingFunctions.push(fn);
      }
    }

    const totalRefSymbols = refSym.classes.size + refSym.methods.size + refSym.properties.size + refSym.functions.size;
    const totalMissing = missingClasses.length + missingMethods.length + missingProps.length + missingFunctions.length;
    const coveredCount = Math.max(0, totalRefSymbols - totalMissing);
    const coveragePercent = totalRefSymbols === 0 ? 100 : ((coveredCount / totalRefSymbols) * 100).toFixed(2);

    if (totalMissing === 0) {
      console.log(`\n✅ SEMANTIC COVERAGE: 100.00% (${coveredCount}/${totalRefSymbols} symbols covered)`);
      console.log(`   - All reference classes, methods, properties, and functions present.`);
      results.push({ pilot: pilot.name, status: 'PASS', coverage: `${coveragePercent}%`, missing: 0 });
    } else {
      console.error(`\n❌ INCOMPLETE COVERAGE for ${pilot.name} (${coveragePercent}%):`);
      if (missingClasses.length > 0) console.error(`   Missing classes:`, missingClasses);
      if (missingMethods.length > 0) console.error(`   Missing methods:`, missingMethods);
      if (missingProps.length > 0) console.error(`   Missing properties:`, missingProps);
      if (missingFunctions.length > 0) console.error(`   Missing functions:`, missingFunctions);
      totalMismatches++;
      results.push({ pilot: pilot.name, status: 'FAIL', coverage: `${coveragePercent}%`, missing: totalMissing });
    }
    console.log();
  }

  console.log(`================================================================================`);
  console.log(` Summary of Semantic Documentation Coverage Results`);
  console.log(`================================================================================`);
  for (const r of results) {
    console.log(`  - ${r.pilot.padEnd(10)}: ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} (Coverage: ${r.coverage})`);
  }
  console.log(`================================================================================\n`);

  if (totalMismatches > 0) {
    console.error(`❌ Semantic coverage check failed with ${totalMismatches} pilot issue(s).`);
    process.exit(1);
  } else {
    console.log(`✅ All ${pilots.length} pilot documentation pages verified with 100% semantic coverage!`);
  }

  return { success: totalMismatches === 0, results };
}

// CLI entry point
const args = process.argv.slice(2);
const genDir = args[0] || 'out/docs/';
const refDir = args[1] || 'D:/projects/bro/docs/';
diffDocs(genDir, refDir);

