import 'server-only';

export const aiConfigured = () => !!process.env.LOMU_AI_URL?.trim();

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
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`AI server answered ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJson(body.choices?.[0]?.message?.content ?? '');
}

export function parseJson(text: string): unknown {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI answer had no JSON');
  return JSON.parse(clean.slice(start, end + 1));
}

export async function ping(): Promise<{ ms: number }> {
  const t0 = Date.now();
  await chatJson('Answer with JSON only.', 'Reply with {"ok": true}', 60_000);
  return { ms: Date.now() - t0 };
}
