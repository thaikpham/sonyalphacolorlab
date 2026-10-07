/**
 * The one upload ceiling, readable from the browser.
 *
 * `lib/lab/image-process.ts` owns the real check and is `server-only` — it
 * imports Sharp, which cannot be bundled for a client. The editor still needs
 * the number, to refuse an 80 MB file before spending a minute uploading it,
 * so the constant lives here and the processor imports it rather than
 * declaring its own. Two copies of a limit is how a client accepts what a
 * server refuses.
 *
 * 4 MiB, because the platform decides first: Vercel refuses a function request
 * body over 4.5 MB before the handler runs, with a plain-text 413. At 8 MiB a
 * 6 MB photograph passed the editor's check, died at the platform, and the
 * editor read "upload failed" rather than "too large".
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The file plus its multipart envelope — boundaries, part headers, an id. */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

/**
 * An obvious overrun, from the declared length alone.
 *
 * `request.formData()` buffers the whole body before a single field can be
 * read, so a check on `file.size` is a check after the cost. This one runs
 * first. A missing or unreadable header is not evidence of anything — the
 * file's own size is still checked once it is parsed.
 */
export function declaresOversizedBody(request: Request): boolean {
  const declared = Number(request.headers.get('content-length'));
  return Number.isFinite(declared) && declared > MAX_UPLOAD_REQUEST_BYTES;
}
