// Minimal Groq wrapper. Reuses the existing EXPO_PUBLIC_GROQ_API_KEY env var.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const REQUEST_TIMEOUT_MS = 25_000;

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqOptions {
  model?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export function getGroqApiKey(): string | null {
  const k = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  return typeof k === 'string' && k.trim().length > 0 ? k.trim() : null;
}

export function isGroqAvailable(): boolean {
  return getGroqApiKey() !== null;
}

export async function callGroq(messages: GroqMessage[], opts: GroqOptions = {}): Promise<string> {
  const key = getGroqApiKey();
  if (!key) throw new Error('EXPO_PUBLIC_GROQ_API_KEY no configurada');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        messages,
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 1024,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json?.choices?.[0]?.message?.content ?? '';
}
