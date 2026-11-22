import 'server-only';

/* A thin client for any OpenAI-compatible chat endpoint (llama.cpp's llama-server, Ollama, a hosted API).
   Configuration comes from the environment only, so the key never reaches a browser or the repository:
     LOMU_AI_URL    base address, e.g. https://llama.splsystems.in   (no AI features while this is empty)
     LOMU_AI_KEY    optional bearer key, sent as "Authorization: Bearer ..."
     LOMU_AI_MODEL  optional model name (llama-server ignores it) */

export const aiConfigured = () => !!process.env.LOMU_AI_URL?.trim();

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
