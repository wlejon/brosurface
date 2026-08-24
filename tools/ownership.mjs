/**
 * tools/ownership.mjs — who owns bro's copy of each emitted translation unit.
 *
 * Read by `sync_to_bro.mjs` before it writes and by `drift.mjs` when it
 * reports, so the two can never hold different lists. It used to be exactly
 * that: a five-name skip list inlined in the sync, and a second copy of the
 * same five names in the drift report.
 *
 *   generator  — the emitter authors this TU; bro's copy is a build artifact,
 *                and drift is a bug in one direction or the other. This is the
 *                default, and it is meant to stay the only answer for anything
 *                the IDL describes.
 *   brokit     — vendored; brokit standalone is upstream and bro's copy is not
 *                ours to write.
 *
 * There is deliberately no third owner. When a file drifts far enough that the
 * emitter can no longer reproduce it, the fix is `tools/refold.mjs` — pull
 * bro's copy back into the IDL blobs — not an exemption that quietly stops the
 * generator from authoring it. Five files reached that state once; refolding
 * them took a command each.
 */

/** @typedef {'generator' | 'brokit'} Owner */

/** Keyed by `<channel>/<file>`; channels are the out/ subdirectory names. */
const OWNERSHIP = {
  'qjs/blob.cpp': ['brokit', 'lives in brokit standalone'],
  'qjs/noise.cpp': ['brokit', 'lives in brokit standalone'],
  'qjs/intl.cpp': ['brokit', 'lives in brokit standalone'],
  'qjs/vendor_globals.cpp': ['brokit', 'lives in brokit standalone'],
  'qjs/image_gpu.cpp': ['brokit', 'bro-side JS polyfill, not a binding'],
};

/**
 * @param {string} channel out/ subdirectory ('qjs', 'bronze_host')
 * @param {string} file basename
 * @returns {{ owner: Owner, why: string }}
 */
export function ownerOf(channel, file) {
  const entry = OWNERSHIP[`${channel}/${file}`];
  if (!entry) return { owner: 'generator', why: '' };
  return { owner: entry[0], why: entry[1] };
}

/** True when a sync may write bro's copy of this TU. */
export function isSynced(channel, file) {
  return ownerOf(channel, file).owner === 'generator';
}
