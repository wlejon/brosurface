// gen/emit_docs.mjs - Documentation Page Emitter for brosurface
// Consumes validated AST from schema/parser.mjs and emits out/docs/<name>-api.js

import fs from 'fs';
import path from 'path';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { emitNoiseDoc } from './docs_noise.mjs';
import { emitTimeDoc, emitFileDoc } from './docs_file_time.mjs';

/**
 * Emits documentation page files for all IDL pilot definitions.
 * @param {string} targetPath
 * @param {string} outDir
 * @returns {Array<string>}
 */
export function runEmitDocs(targetPath = 'idl/', outDir = 'out/docs/') {
  console.log(`[brosurface Doc Page Emitter] Reading IDLs from: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const idlFiles = fs.readdirSync(targetPath)
    .filter(f => f.endsWith('.idl'))
    .map(f => path.join(targetPath, f));

  const emittedFiles = [];

  for (const f of idlFiles) {
    const base = path.basename(f, '.idl');
    const src = fs.readFileSync(f, 'utf8');
    const tokens = tokenize(src, f);
    const fileAst = parse(tokens, f);

    let docContent = '';
    const outFileName = `${base}-api.js`;
    const outFilePath = path.join(outDir, outFileName);

    if (base === 'noise') {
      docContent = emitNoiseDoc(fileAst);
    } else if (base === 'time') {
      docContent = emitTimeDoc(fileAst);
    } else if (base === 'file') {
      docContent = emitFileDoc(fileAst);
    } else {
      docContent = `// ${base} API Documentation\n\n// Auto-generated from ${f}\n`;
    }

    fs.writeFileSync(outFilePath, docContent, 'utf8');
    const lineCount = docContent.split('\n').length;
    console.log(`  ✅ Emitted ${outFilePath} (${lineCount} lines)`);
    emittedFiles.push(outFilePath);
  }

  console.log(`✅ Documentation page emitter completed: ${emittedFiles.length} doc file(s) written to ${outDir}`);
  return emittedFiles;
}

// CLI entry point
const args = process.argv.slice(2);
const idlDir = args[0] || 'idl/';
const outDocsDir = args[1] || 'out/docs/';
runEmitDocs(idlDir, outDocsDir);
