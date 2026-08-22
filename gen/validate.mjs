// gen/validate.mjs - IDL Validation & Lossless Round-Trip Verification CLI

import fs from 'fs';
import path from 'path';
import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { serialize } from '../schema/serializer.mjs';
import { validate } from '../schema/validator.mjs';
import { astEquals } from '../schema/ast.mjs';

function findIdlFiles(dirOrFile) {
  const stat = fs.statSync(dirOrFile);
  if (stat.isFile()) {
    return [path.resolve(dirOrFile)];
  }
  const files = [];
  const entries = fs.readdirSync(dirOrFile, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirOrFile, entry.name);
    if (entry.isDirectory()) {
      files.push(...findIdlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.idl')) {
      files.push(path.resolve(full));
    }
  }
  return files;
}

export function runValidation(targetPath = 'idl/') {
  console.log(`[brosurface IDL Validator] Validating IDLs in: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const idlFiles = findIdlFiles(targetPath);
  if (idlFiles.length === 0) {
    console.warn(`No .idl files found in: ${targetPath}`);
    return { success: true, files: 0, errors: [] };
  }

  console.log(`Found ${idlFiles.length} IDL file(s):`);
  for (const f of idlFiles) {
    console.log(`  - ${path.relative(process.cwd(), f)}`);
  }

  const astMap = new Map();
  const sourceMap = new Map();
  const astList = [];
  let parseErrors = [];

  // 1. Lex and Parse all files
  for (const filePath of idlFiles) {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const source = fs.readFileSync(filePath, 'utf8');
    sourceMap.set(relativePath, source);

    try {
      const tokens = tokenize(source, relativePath);
      const fileAst = parse(tokens, relativePath);
      astMap.set(relativePath, fileAst);
      astList.push(fileAst);
    } catch (err) {
      parseErrors.push({
        file: relativePath,
        line: err.line || 1,
        col: err.col || 1,
        message: err.message,
        toString() {
          return err.message;
        },
      });
    }
  }

  if (parseErrors.length > 0) {
    console.error(`\n❌ Parse errors encountered (${parseErrors.length}):`);
    for (const err of parseErrors) {
      console.error(`  ${err.toString()}`);
    }
    return { success: false, errors: parseErrors };
  }

  // 2. Semantic Validation
  const valErrors = validate(astList, sourceMap);
  if (valErrors.length > 0) {
    console.error(`\n❌ Semantic validation errors encountered (${valErrors.length}):`);
    for (const err of valErrors) {
      console.error(`  ${err.toString()}`);
    }
    return { success: false, errors: valErrors };
  }

  // 3. Lossless Round-Trip Verification
  let roundTripMismatches = [];

  for (const [relativePath, ast1] of astMap.entries()) {
    try {
      const serialized = serialize(ast1);
      const tokens2 = tokenize(serialized, relativePath + ' (serialized)');
      const ast2 = parse(tokens2, relativePath + ' (serialized)');

      if (!astEquals(ast1, ast2)) {
        roundTripMismatches.push({
          file: relativePath,
          message: 'Serialized AST does not structurally match original AST',
        });
      }
    } catch (err) {
      roundTripMismatches.push({
        file: relativePath,
        message: `Round-trip error: ${err.message}`,
      });
    }
  }

  if (roundTripMismatches.length > 0) {
    console.error(`\n❌ Lossless round-trip mismatches (${roundTripMismatches.length}):`);
    for (const m of roundTripMismatches) {
      console.error(`  ${m.file}: ${m.message}`);
    }
    return { success: false, errors: roundTripMismatches };
  }

  // Summary counts
  let totalInterfaces = 0;
  let totalNamespaces = 0;
  let totalDictionaries = 0;
  let totalEnums = 0;
  let totalTypedefs = 0;

  for (const fileAst of astList) {
    for (const def of fileAst.definitions) {
      if (def.type === 'Interface') totalInterfaces++;
      if (def.type === 'Namespace') totalNamespaces++;
      if (def.type === 'Dictionary') totalDictionaries++;
      if (def.type === 'Enum') totalEnums++;
      if (def.type === 'Typedef') totalTypedefs++;
    }
  }

  console.log(`\n✅ All ${idlFiles.length} IDL file(s) passed validation and lossless round-trip!`);
  console.log(`Summary of symbols:`);
  console.log(`  - Interfaces:   ${totalInterfaces}`);
  console.log(`  - Namespaces:   ${totalNamespaces}`);
  console.log(`  - Dictionaries: ${totalDictionaries}`);
  console.log(`  - Enums:        ${totalEnums}`);
  console.log(`  - Typedefs:     ${totalTypedefs}`);
  console.log(`  - Round-Trip:   100% Lossless (parse -> serialize -> parse)`);

  return { success: true, files: idlFiles.length, errors: [] };
}

// CLI entry point
const args = process.argv.slice(2);
const target = args[0] || 'idl/';
const result = runValidation(target);

if (!result.success) {
  process.exit(1);
}
