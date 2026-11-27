import 'server-only';

/* Request bodies with a ceiling. Route handlers get no limit of their own, and a chunked upload has no content-length to
   check up front, so the body is counted as it is read and the read is abandoned the moment it goes over. */

export class TooLarge extends Error {
  constructor() {
    super('request too large');
  }
}

export async function readText(req: Request, max: number): Promise<string> {
  if (Number(req.headers.get('content-length') ?? 0) > max) throw new TooLarge();
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new TooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Parses a JSON body of at most [max] bytes (default 16 KB: plenty for a sign-in). Throws on bad JSON or an oversize body. */
export async function readJson<T = any>(req: Request, max = 16 * 1024): Promise<T> {
  return JSON.parse(await readText(req, max)) as T;
}
