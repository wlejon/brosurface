// tools/build.mjs — regenerate every artifact under out/ from idl/.
import { runEmitDocs } from '../gen/emit_docs.mjs';
import { runEmitDts } from '../gen/emit_dts.mjs';
import { runEmitNatives } from '../gen/emit_natives.mjs';

console.log('Regenerating all artifacts from idl/ ...');
runEmitDocs('idl/', 'out/docs/');
runEmitDts('idl/', 'out/types/index.d.ts');
runEmitDts('idl/', 'out/bro.d.ts');
runEmitNatives('idl/', 'out/natives/');
console.log('Done!');
