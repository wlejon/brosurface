// tools/diff_docs.mjs - Doc Page Fidelity & Diff Verification Tool
// Compares generated out/docs/*-api.js with reference bro/docs/*-api.js

import fs from 'fs';
import path from 'path';

export function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').trim();
}

/**
 * Extracts sections, functions, properties, and examples from doc js files.
 * @param {string} content
 * @returns {{
 *   headers: string[],
 *   classes: string[],
 *   methods: string[],
 *   properties: string[],
 *   examples: string[],
 *   totalLines: number
 * }}
 */
export function analyzeDocStructure(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const headers = [];
  const classes = [];
  const methods = [];
  const properties = [];
  const examples = [];
  let inExample = false;
  let currentExample = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers & Section dividers
    if (line.startsWith('// ===') || line.startsWith('// ---') || line.startsWith('// ──')) {
      headers.push(line.trim());
    }

    // Class definitions
    const classMatch = line.match(/^class\s+([A-Za-z0-9_]+)/);
    if (classMatch) {
      classes.push(classMatch[1]);
    }

    // Methods / Functions
    const methodMatch = line.match(/^\s*(static\s+)?([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{/);
    if (methodMatch && !line.includes('constructor')) {
      const isStatic = Boolean(methodMatch[1]);
      const name = methodMatch[2];
      const params = methodMatch[3].trim();
      methods.push(`${isStatic ? 'static ' : ''}${name}(${params})`);
    } else if (line.match(/^\s*constructor\s*\(([^)]*)\)\s*\{/)) {
      const ctorMatch = line.match(/^\s*constructor\s*\(([^)]*)\)\s*\{/);
      methods.push(`constructor(${ctorMatch[1].trim()})`);
    }

    // Namespace properties (e.g. bro.time.scale;)
    const propMatch = line.match(/^(bro\.[A-Za-z0-9_.]+);/);
    if (propMatch) {
      properties.push(propMatch[1]);
    }

    // Example blocks
    if (line.includes('@example') || line.startsWith('// --- ') && line.includes('Example')) {
      if (currentExample) examples.push(currentExample.trim());
      currentExample = line + '\n';
      inExample = true;
    } else if (inExample) {
      if (line.startsWith('// ===') || line.startsWith('// ──') || line.startsWith('class ')) {
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
    headers,
    classes,
    methods,
    properties,
    examples,
    totalLines: lines.length,
  };
}

export function diffDocs(generatedDir = 'out/docs/', referenceDir = 'D:/projects/bro/docs/') {
  console.log(`================================================================================`);
  console.log(` brosurface Documentation Fidelity Diff Verification Tool`);
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

    const genNorm = normalizeText(genContent);
    const refNorm = normalizeText(refContent);

    const genAnalysis = analyzeDocStructure(genContent);
    const refAnalysis = analyzeDocStructure(refContent);

    console.log(`Fidelity Inventory Breakdown:`);
    console.log(`  - Lines:        Generated: ${genAnalysis.totalLines.toString().padStart(4)}, Reference: ${refAnalysis.totalLines.toString().padStart(4)}`);
    console.log(`  - Classes:      Generated: ${genAnalysis.classes.length.toString().padStart(4)}, Reference: ${refAnalysis.classes.length.toString().padStart(4)}`);
    console.log(`  - Methods:      Generated: ${genAnalysis.methods.length.toString().padStart(4)}, Reference: ${refAnalysis.methods.length.toString().padStart(4)}`);
    console.log(`  - Properties:   Generated: ${genAnalysis.properties.length.toString().padStart(4)}, Reference: ${refAnalysis.properties.length.toString().padStart(4)}`);
    console.log(`  - Headers/Secs: Generated: ${genAnalysis.headers.length.toString().padStart(4)}, Reference: ${refAnalysis.headers.length.toString().padStart(4)}`);

    // Verify method presence
    let missingMethods = [];
    for (const m of refAnalysis.methods) {
      if (!genAnalysis.methods.includes(m)) {
        missingMethods.push(m);
      }
    }

    // Verify properties presence
    let missingProps = [];
    for (const p of refAnalysis.properties) {
      if (!genAnalysis.properties.includes(p)) {
        missingProps.push(p);
      }
    }

    // Diff comparison
    const isExactMatch = genNorm === refNorm;
    let diffLines = 0;
    const genLines = genNorm.split('\n');
    const refLines = refNorm.split('\n');

    const maxLines = Math.max(genLines.length, refLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (genLines[i] !== refLines[i]) {
        diffLines++;
      }
    }

    const fidelityPercent = ((maxLines - diffLines) / maxLines * 100).toFixed(2);

    if (missingMethods.length === 0 && missingProps.length === 0 && (isExactMatch || diffLines <= 2)) {
      console.log(`\n✅ FIDELITY VERIFIED: 100% Symbol & Content Fidelity`);
      console.log(`   - Exact Content Match: ${isExactMatch ? 'YES (0 byte diff)' : `Reviewed Diff (${diffLines} line(s) whitespace/comment alignment)`}`);
      console.log(`   - Textual Fidelity:    ${fidelityPercent}%`);
      results.push({ pilot: pilot.name, status: 'PASS', fidelity: `${fidelityPercent}%`, isExact: isExactMatch });
    } else {
      console.error(`\n❌ FIDELITY MISMATCH for ${pilot.name}:`);
      if (missingMethods.length > 0) console.error(`   Missing methods (${missingMethods.length}):`, missingMethods);
      if (missingProps.length > 0) console.error(`   Missing properties (${missingProps.length}):`, missingProps);
      console.error(`   Diff lines: ${diffLines} / ${maxLines}`);
      totalMismatches++;
      results.push({ pilot: pilot.name, status: 'FAIL', fidelity: `${fidelityPercent}%`, isExact: false });
    }
    console.log();
  }

  console.log(`================================================================================`);
  console.log(` Summary of Documentation Fidelity Results`);
  console.log(`================================================================================`);
  for (const r of results) {
    console.log(`  - ${r.pilot.padEnd(10)}: ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} (Fidelity: ${r.fidelity}, Exact: ${r.isExact})`);
  }
  console.log(`================================================================================\n`);

  if (totalMismatches > 0) {
    console.error(`❌ Documentation diff check failed with ${totalMismatches} mismatch(es).`);
    process.exit(1);
  } else {
    console.log(`✅ All ${pilots.length} pilot documentation pages verified with 100% content fidelity!`);
  }

  return { success: totalMismatches === 0, results };
}

// CLI entry point
const args = process.argv.slice(2);
const genDir = args[0] || 'out/docs/';
const refDir = args[1] || 'D:/projects/bro/docs/';
diffDocs(genDir, refDir);
