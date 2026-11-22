import 'server-only';

/* A thin client for any OpenAI-compatible chat endpoint (llama.cpp's llama-server, Ollama, a hosted API).
   Configuration comes from the environment only, so the key never reaches a browser or the repository:
     LOMU_AI_URL    base address, e.g. https://llama.example.com   (no AI features while this is empty)
     LOMU_AI_KEY    optional bearer key, sent as "Authorization: Bearer ..."
     LOMU_AI_MODEL  optional model name (llama-server ignores it) */

export const aiConfigured = () => !!process.env.LOMU_AI_URL?.trim();

/** Plain-language reason for a failed call, for the Settings test. */
export function explain(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/answered 30\d/.test(m)) return 'The address redirects to a login page. Use an address that accepts the key without a browser login.';
  if (/answered 40[13]/.test(m)) return 'The server refused the key (401/403). Check LOMU_AI_KEY.';
  if (/answered 404/.test(m)) return 'Nothing at /v1/chat/completions (404). Check LOMU_AI_URL.';
  if (/answered 50[234]/.test(m)) return 'The address answered but the model server behind it is not running (502/503/504).';
  if (/timeout|aborted/i.test(m)) return 'Timed out. The model is off, still loading, or too slow.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(m)) return 'Could not connect. Check the address and that this machine can reach it.';
  return m;
}

export async function chatJson(system: string, user: string, timeoutMs = 120_000): Promise<unknown> {
  const base = process.env.LOMU_AI_URL?.trim().replace(/\/+$/, '');
  if (!base) throw new Error('AI is not configured');
  const key = process.env.LOMU_AI_KEY?.trim();
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model: process.env.LOMU_AI_MODEL?.trim() || 'default',
      temperature: 0.8,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    redirect: 'manual', // a login page (302) means the endpoint is behind SSO and the key cannot get through
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`AI server answered ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson(body.choices?.[0]?.message?.content ?? '');
}

/** Models wrap JSON in prose, code fences or <think> blocks; take the first balanced object. */
export function parseJson(text: string): unknown {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI answer had no JSON');
  return JSON.parse(clean.slice(start, end + 1));
}

/** Settings test: one tiny request, so a wrong address, key or a stopped model shows up in seconds. */
export async function ping(): Promise<{ ms: number }> {
  const t0 = Date.now();
  await chatJson('Answer with JSON only.', 'Reply with {"ok": true}', 60_000);
  return { ms: Date.now() - t0 };
}
