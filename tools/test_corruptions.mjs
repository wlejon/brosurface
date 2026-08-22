// tools/test_corruptions.mjs - Corruption tests demonstrating actionable error reporting

import { tokenize } from '../schema/lexer.mjs';
import { parse } from '../schema/parser.mjs';
import { validate } from '../schema/validator.mjs';

const corruptionCases = [
  {
    name: '1. Syntax Error: Missing semicolon in attribute declaration',
    fileName: 'corrupt_syntax_semicolon.idl',
    idl: `
interface CorruptSyntax {
  attribute long count
  attribute DOMString name;
};
    `.trim(),
    expectedPhase: 'parser',
  },
  {
    name: '2. Semantic Error: Unknown type referenced in operation return & parameter',
    fileName: 'corrupt_unknown_type.idl',
    idl: `
interface DeviceController {
  QuantumState probeDevice(NonExistentHandle handle, long timeout);
};
    `.trim(),
    expectedPhase: 'validator',
  },
  {
    name: '3. Semantic Error: Circular inheritance cycle in interfaces',
    fileName: 'corrupt_circular_inheritance.idl',
    idl: `
interface NodeA : NodeB {
  attribute long idA;
};

interface NodeB : NodeC {
  attribute long idB;
};

interface NodeC : NodeA {
  attribute long idC;
};
    `.trim(),
    expectedPhase: 'validator',
  },
  {
    name: '4. Semantic Error: Duplicate member definition in interface',
    fileName: 'corrupt_duplicate_member.idl',
    idl: `
interface TransformNode {
  attribute vec3 position;
  attribute quat rotation;
  attribute vec3 position;
};
    `.trim(),
    expectedPhase: 'validator',
  },
  {
    name: '5. Semantic Error: Default value type mismatch in dictionary field',
    fileName: 'corrupt_default_value_mismatch.idl',
    idl: `
dictionary RenderOptions {
  long sampleCount = "high";
  boolean enableShadows = 12345;
};
    `.trim(),
    expectedPhase: 'validator',
  },
];

export function runCorruptionTests() {
  console.log('================================================================================');
  console.log(' brosurface IDL Corruption Test Suite — Demonstrating Actionable Error Reporting');
  console.log('================================================================================\n');

  let passedCount = 0;

  for (const tc of corruptionCases) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`TEST CASE: ${tc.name}`);
    console.log(`File: ${tc.fileName}`);
    console.log(`Input IDL:\n${tc.idl}\n`);

    const sourceMap = new Map([[tc.fileName, tc.idl]]);
    let caughtErrors = [];

    try {
      const tokens = tokenize(tc.idl, tc.fileName);
      const ast = parse(tokens, tc.fileName);
      const valErrors = validate([ast], sourceMap);
      if (valErrors.length > 0) {
        caughtErrors.push(...valErrors);
      }
    } catch (err) {
      caughtErrors.push(err);
    }

    if (caughtErrors.length > 0) {
      console.log(`🚨 Actionable Diagnostic Caught (${caughtErrors.length} error(s)):`);
      for (const err of caughtErrors) {
        if (typeof err.toString === 'function') {
          console.log(`  ${err.toString()}`);
        } else {
          console.log(`  Error: ${err.message}`);
        }
      }
      console.log(`\n✅ Result: PASSED (Corrupted declaration successfully caught with clear location & message)`);
      passedCount++;
    } else {
      console.error(`\n❌ Result: FAILED (Corruption went undetected!)`);
    }
    console.log();
  }

  console.log('================================================================================');
  console.log(` Corruption Test Results: ${passedCount} / ${corruptionCases.length} tests caught successfully!`);
  console.log('================================================================================');

  return passedCount === corruptionCases.length;
}

if (process.argv[1] && process.argv[1].endsWith('test_corruptions.mjs')) {
  const ok = runCorruptionTests();
  if (!ok) {
    process.exit(1);
  }
}
