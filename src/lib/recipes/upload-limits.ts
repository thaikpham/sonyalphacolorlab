/**
 * The one upload ceiling, readable from the browser.
 *
 * `lib/lab/image-process.ts` owns the real check and is `server-only` — it
 * imports Sharp, which cannot be bundled for a client. The editor still needs
 * the number, to refuse an 80 MB file before spending a minute uploading it,
 * so the constant lives here and the processor imports it rather than
 * declaring its own. Two copies of a limit is how a client accepts what a
 * server refuses.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
