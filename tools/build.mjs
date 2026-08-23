import { runEmitDocs } from '../gen/emit_docs.mjs';
import { runEmitDts } from '../gen/emit_dts.mjs';
import { runEmitQjsbind } from '../gen/emit_qjsbind.mjs';
import { runEmitBronzeHost } from '../gen/emit_bronze_host.mjs';
import { runEmitStubs } from '../gen/emit_stubs.mjs';

console.log('Regenerating all artifacts from idl/ ...');
runEmitDocs('idl/', 'out/docs/');
runEmitDts('idl/', 'out/types/index.d.ts');
runEmitQjsbind('idl/', 'out/qjs/');
runEmitBronzeHost('idl/', 'out/bronze_host/');
runEmitStubs('idl/', 'out/stubs/feature_stubs.cpp');
console.log('Done!');
