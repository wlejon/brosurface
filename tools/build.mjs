import { runEmitDocs } from '../gen/emit_docs.mjs';
import { runEmitDts } from '../gen/emit_dts.mjs';
import { runEmitQjsbind } from '../gen/emit_qjsbind.mjs';
import { runEmitBronzeHost } from '../gen/emit_bronze_host.mjs';
import { runEmitStubs } from '../gen/emit_stubs.mjs';
import { runEmitCAbi } from '../gen/emit_c_abi.mjs';

console.log('Regenerating all artifacts from idl/ ...');
runEmitDocs('idl/', 'out/docs/');
runEmitDts('idl/', 'out/types/index.d.ts');
runEmitDts('idl/', 'out/bro.d.ts');
runEmitQjsbind('idl/', 'out/qjs/');
runEmitBronzeHost('idl/', 'out/bronze_host/');
runEmitStubs('idl/', 'out/stubs/feature_stubs.cpp');
runEmitCAbi('idl/', 'out/c_abi/');
console.log('Done!');
