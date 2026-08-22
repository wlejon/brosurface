// tools/audit_gen.mjs - IDL Namespace and Interface Identifier Generality Audit
// Extracts all interface and namespace names from idl/ and scans gen/*.mjs
// Fails (exit code 1) if any interface/namespace name appears in gen/ files.
// Passes (exit code 0) when gen/ is 100% generic and clean.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

/**
 * Finds all .idl files recursively within target dir.
 * @param {string} dir
 * @returns {string[]}
 */
function findIdlFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findIdlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.idl')) {
      files.push(path.resolve(full));
    }
  }
  return files;
}

/**
 * Extracts all interface and namespace names from IDLs.
 * @param {string} idlDir
 * @returns {string[]}
 */
export function extractIdlSymbols(idlDir = path.join(ROOT, 'idl')) {
  const idlFiles = findIdlFiles(idlDir);
  const symbols = new Set();

  for (const f of idlFiles) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    const tokens = tokenize(src, rel);
    const fileAst = parse(tokens, rel);

    for (const def of fileAst.definitions) {
      if (def.type === 'Interface' || def.type === 'Namespace') {
        symbols.add(def.name);
      }
    }
  }

  return Array.from(symbols).sort();
}

/**
 * Audits all .mjs files in gen/ against extracted IDL symbols.
 * @param {string} genDir
 * @param {string[]} symbols
 * @returns {{ violations: Array<{ file: string, line: number, symbol: string, content: string }>, auditedFiles: string[] }}
 */
export function auditGenFiles(genDir = path.join(ROOT, 'gen'), symbols = null) {
  if (!symbols) {
    symbols = extractIdlSymbols();
  }

  const genFiles = fs.readdirSync(genDir)
    .filter(f => f.endsWith('.mjs'))
    .map(f => path.join(genDir, f));

  const violations = [];

  for (const gf of genFiles) {
    const rel = path.relative(ROOT, gf).replace(/\\/g, '/');
    const content = fs.readFileSync(gf, 'utf8');
    const lines = content.split('\n');

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineNum = lineIdx + 1;
      const lineStr = lines[lineIdx];

      for (const sym of symbols) {
        const regex = new RegExp(`\\b${sym}\\b`);
        if (regex.test(lineStr)) {
          violations.push({
            file: rel,
            line: lineNum,
            symbol: sym,
            content: lineStr.trim(),
          });
        }
      }
    }
  }

  return {
    violations,
    auditedFiles: genFiles.map(f => path.relative(ROOT, f).replace(/\\/g, '/')),
  };
}

export function runAudit() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('       brosurface tools/audit_gen.mjs: Generator Generality Audit              ');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const symbols = extractIdlSymbols();
  console.log(`[Step 1] Extracted ${symbols.length} interface & namespace symbol(s) from idl/:`);
  for (const s of symbols) {
    console.log(`  - ${s}`);
  }

  console.log(`\n[Step 2] Scanning all gen/*.mjs files for \\b<Symbol>\\b occurrences...`);
  const { violations, auditedFiles } = auditGenFiles(path.join(ROOT, 'gen'), symbols);

  console.log(`Audited ${auditedFiles.length} generator file(s):`);
  for (const f of auditedFiles) {
    console.log(`  - ${f}`);
  }

  if (violations.length > 0) {
    console.error(`\n❌ AUDIT FAILED: Found ${violations.length} violating identifier occurrence(s) in gen/:\n`);
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} -> symbol '${v.symbol}': "${v.content}"`);
    }
    console.error(`\nAll generator files in gen/ must have 0 namespace-specific identifiers.`);
    return false;
  }

  console.log(`\n✅ AUDIT PASSED: 0 namespace-specific identifiers found across all ${auditedFiles.length} gen/ files!`);
  console.log(`   Generators in gen/ are 100% generic AST-driven.\n`);
  return true;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirect) {
  const ok = runAudit();
  if (!ok) {
    process.exit(1);
  }
}
