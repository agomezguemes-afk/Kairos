import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  transcribeAudio,
  isSttAvailable,
  DEFAULT_STT_MODEL,
  GROQ_STT_ENDPOINT,
  STT_PROXY_PATH,
} from './transcribe';
import type { SttSessionAuth, SttUsageTracker, TranscribeInput } from './types';

const ENV_KEY = 'EXPO_PUBLIC_GROQ_API_KEY';
const SUPABASE_URL_KEY = 'EXPO_PUBLIC_SUPABASE_URL';
const SUPABASE_URL = 'https://proj.supabase.co';
const PROXY_ENDPOINT = `${SUPABASE_URL}${STT_PROXY_PATH}`;

// Same __DEV__ gymnastics as devFallback.test.ts: in node __DEV__ is
// undefined (release-like), so tests opt in to the dev-build path.
function setDev(value: boolean | undefined): void {
  if (value === undefined) {
    delete (globalThis as Record<string, unknown>).__DEV__;
  } else {
    (globalThis as Record<string, unknown>).__DEV__ = value;
  }
}

function fakeTracker(): SttUsageTracker & { recorded: number } {
  const t = {
    recorded: 0,
    record: async () => {
      t.recorded += 1;
    },
    count24h: async () => t.recorded,
    clear: async () => {
      t.recorded = 0;
    },
  };
  return t;
}

// Injected session source: token !== null simula un usuario con sesión.
function fakeAuth(token: string | null): SttSessionAuth {
  return { hasSession: () => token !== null, getToken: async () => token };
}

const INPUT: TranscribeInput = {
  uri: 'file:///tmp/utterance.m4a',
  mimeType: 'audio/m4a',
  durationMs: 4200,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

// The ambient FormData type differs between RN and node (undici) — read
// the multipart body through a structural view instead.
function formOf(init: RequestInit): { get(name: string): unknown } {
  return init.body as unknown as { get(name: string): unknown };
}

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  setDev(true);
  process.env[ENV_KEY] = 'gsk_test_key';
});

afterEach(() => {
  setDev(undefined);
  delete process.env[ENV_KEY];
  delete process.env[SUPABASE_URL_KEY];
  vi.unstubAllGlobals();
});

describe('transcribeAudio — éxito', () => {
  it('devuelve texto recortado, latencia y lenguaje detectado', async () => {
    stubFetch(async () =>
      jsonResponse({ text: '  tres series de sentadilla ', language: 'spanish' }),
    );
    const res = await transcribeAudio(INPUT, { usageTracker: fakeTracker() });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.text).toBe('tres series de sentadilla');
    expect(res.language).toBe('spanish');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it('lenguaje null cuando el upstream no lo reporta', async () => {
    stubFetch(async () => jsonResponse({ text: 'hola' }));
    const res = await transcribeAudio(INPUT, { usageTracker: fakeTracker() });
    expect(res).toMatchObject({ ok: true, text: 'hola', language: null });
  });

  it('incrementa la cuota STT en cada llamada procesada', async () => {
    stubFetch(async () => jsonResponse({ text: 'hola' }));
    const tracker = fakeTracker();
    await transcribeAudio(INPUT, { usageTracker: tracker });
    await transcribeAudio(INPUT, { usageTracker: tracker });
    expect(tracker.recorded).toBe(2);
  });
});

describe('transcribeAudio — forma de la petición', () => {
  it('POST multipart al endpoint de Groq con el modelo y es por defecto', async () => {
    const mock = stubFetch(async () => jsonResponse({ text: 'hola' }));
    await transcribeAudio(INPUT, { usageTracker: fakeTracker() });

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(GROQ_STT_ENDPOINT);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test_key');
    // No Content-Type manual: fetch pone el boundary multipart.
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();

    const form = formOf(init);
    expect(form.get('model')).toBe(DEFAULT_STT_MODEL);
    expect(form.get('language')).toBe('es');
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.get('file')).toBeTruthy();
    expect(form.get('prompt')).toBeNull();
    expect(form.get('temperature')).toBeNull();
  });

  it('respeta language, model, prompt y temperature del caller', async () => {
    const mock = stubFetch(async () => jsonResponse({ text: 'hi' }));
    await transcribeAudio(INPUT, {
      language: 'en',
      model: 'whisper-large-v3',
      prompt: 'RPE, sentadilla búlgara',
      temperature: 0.2,
      usageTracker: fakeTracker(),
    });

    const form = formOf(mock.mock.calls[0][1]);
    expect(form.get('language')).toBe('en');
    expect(form.get('model')).toBe('whisper-large-v3');
    expect(form.get('prompt')).toBe('RPE, sentadilla búlgara');
    expect(form.get('temperature')).toBe('0.2');
  });
});

describe('transcribeAudio — indisponibilidad y validación local', () => {
  it('sin clave dev → unavailable sin tocar la red', async () => {
    setDev(undefined);
    const mock = stubFetch(async () => jsonResponse({ text: 'nope' }));
    expect(isSttAvailable()).toBe(false);

    const res = await transcribeAudio(INPUT);
    expect(res).toMatchObject({ ok: false, error: { kind: 'unavailable', retryable: false } });
    expect(mock).not.toHaveBeenCalled();
  });

  it('uri vacío → invalid_audio sin tocar la red', async () => {
    const mock = stubFetch(async () => jsonResponse({ text: 'nope' }));
    const res = await transcribeAudio({ ...INPUT, uri: '   ' });
    expect(res).toMatchObject({ ok: false, error: { kind: 'invalid_audio', retryable: false } });
    expect(mock).not.toHaveBeenCalled();
  });

  it('grabación de duración 0 → invalid_audio', async () => {
    stubFetch(async () => jsonResponse({ text: 'nope' }));
    const res = await transcribeAudio({ ...INPUT, durationMs: 0 });
    expect(res).toMatchObject({ ok: false, error: { kind: 'invalid_audio' } });
  });
});

describe('transcribeAudio — taxonomía HTTP', () => {
  const cases: { status: number; kind: string; retryable: boolean }[] = [
    { status: 401, kind: 'auth', retryable: false },
    { status: 403, kind: 'auth', retryable: false },
    { status: 400, kind: 'invalid_audio', retryable: false },
    { status: 413, kind: 'invalid_audio', retryable: false },
    { status: 429, kind: 'rate_limited', retryable: true },
    { status: 500, kind: 'server', retryable: true },
    { status: 503, kind: 'server', retryable: true },
  ];

  for (const c of cases) {
    it(`${c.status} → ${c.kind} (retryable: ${c.retryable}) sin contar cuota`, async () => {
      stubFetch(async () => new Response('upstream detail', { status: c.status }));
      const tracker = fakeTracker();
      const res = await transcribeAudio(INPUT, { usageTracker: tracker });

      expect(res).toMatchObject({
        ok: false,
        error: { kind: c.kind, retryable: c.retryable, status: c.status },
      });
      expect(tracker.recorded).toBe(0);
    });
  }
});

describe('transcribeAudio — transporte', () => {
  it('fetch que revienta → network, retryable', async () => {
    stubFetch(async () => {
      throw new TypeError('Network request failed');
    });
    const tracker = fakeTracker();
    const res = await transcribeAudio(INPUT, { usageTracker: tracker });
    expect(res).toMatchObject({ ok: false, error: { kind: 'network', retryable: true } });
    expect(tracker.recorded).toBe(0);
  });

  it('cap de latencia superado → timeout', async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted by signal')));
        }),
    );
    const res = await transcribeAudio(INPUT, { timeoutMs: 20, usageTracker: fakeTracker() });
    expect(res).toMatchObject({ ok: false, error: { kind: 'timeout', retryable: true } });
  });

  it('señal ya abortada → aborted sin tocar la red', async () => {
    const mock = stubFetch(async () => jsonResponse({ text: 'nope' }));
    const ac = new AbortController();
    ac.abort();
    const res = await transcribeAudio(INPUT, { signal: ac.signal, usageTracker: fakeTracker() });
    expect(res).toMatchObject({ ok: false, error: { kind: 'aborted', retryable: false } });
    expect(mock).not.toHaveBeenCalled();
  });

  it('abort del caller en vuelo → aborted, no timeout', async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted by signal')));
        }),
    );
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 5);
    const res = await transcribeAudio(INPUT, { signal: ac.signal, usageTracker: fakeTracker() });
    expect(res).toMatchObject({ ok: false, error: { kind: 'aborted' } });
  });
});

describe('transcribeAudio — respuestas raras del upstream', () => {
  it('2xx sin JSON → bad_response (y sí cuenta cuota: Groq ya procesó)', async () => {
    stubFetch(async () => new Response('not json at all', { status: 200 }));
    const tracker = fakeTracker();
    const res = await transcribeAudio(INPUT, { usageTracker: tracker });
    expect(res).toMatchObject({ ok: false, error: { kind: 'bad_response', retryable: true } });
    expect(tracker.recorded).toBe(1);
  });

  it('2xx con JSON sin campo text → bad_response', async () => {
    stubFetch(async () => jsonResponse({ language: 'spanish' }));
    const res = await transcribeAudio(INPUT, { usageTracker: fakeTracker() });
    expect(res).toMatchObject({ ok: false, error: { kind: 'bad_response' } });
  });

  it('transcripción en blanco → empty, retryable, con cuota contada', async () => {
    stubFetch(async () => jsonResponse({ text: '   ' }));
    const tracker = fakeTracker();
    const res = await transcribeAudio(INPUT, { usageTracker: tracker });
    expect(res).toMatchObject({ ok: false, error: { kind: 'empty', retryable: true } });
    expect(tracker.recorded).toBe(1);
  });

  it('un tracker que lanza no rompe el resultado', async () => {
    stubFetch(async () => jsonResponse({ text: 'hola' }));
    const broken: SttUsageTracker = {
      record: async () => {
        throw new Error('storage exploded');
      },
      count24h: async () => 0,
      clear: async () => {},
    };
    const res = await transcribeAudio(INPUT, { usageTracker: broken });
    expect(res).toMatchObject({ ok: true, text: 'hola' });
  });
});

// ── M2b: matriz de enrutado proxy (ai-stt) / directo (clave dev) ─────

describe('transcribeAudio — enrutado proxy/directo', () => {
  it('con sesión → POST al proxy ai-stt con el JWT, aunque exista clave dev', async () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    const mock = stubFetch(async () => jsonResponse({ text: 'hola', language: 'spanish' }));
    const tracker = fakeTracker();

    const res = await transcribeAudio(INPUT, { auth: fakeAuth('jwt_abc'), usageTracker: tracker });

    expect(res).toMatchObject({ ok: true, text: 'hola', language: 'spanish' });
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(PROXY_ENDPOINT);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt_abc');
    // Sin Content-Type manual también en el proxy: fetch pone el boundary.
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    // Mismo wire format multipart en ambas rutas.
    const form = formOf(init);
    expect(form.get('model')).toBe(DEFAULT_STT_MODEL);
    expect(form.get('language')).toBe('es');
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.get('file')).toBeTruthy();
    // La cuota client-side sigue contando en la ruta proxy (el servidor
    // no registra STT en ai_quota — ver quota.ts).
    expect(tracker.recorded).toBe(1);
  });

  it('normaliza la barra final de EXPO_PUBLIC_SUPABASE_URL', async () => {
    process.env[SUPABASE_URL_KEY] = `${SUPABASE_URL}/`;
    const mock = stubFetch(async () => jsonResponse({ text: 'hola' }));
    await transcribeAudio(INPUT, { auth: fakeAuth('jwt_abc'), usageTracker: fakeTracker() });
    expect(mock.mock.calls[0][0]).toBe(PROXY_ENDPOINT);
  });

  it('sin sesión + clave dev → directo a Groq con la clave dev', async () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    const mock = stubFetch(async () => jsonResponse({ text: 'hola' }));
    await transcribeAudio(INPUT, { auth: fakeAuth(null), usageTracker: fakeTracker() });
    const [url, init] = mock.mock.calls[0];
    expect(url).toBe(GROQ_STT_ENDPOINT);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test_key');
  });

  it('sesión cacheada pero token evaporado → cae a la ruta directa dev', async () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    const mock = stubFetch(async () => jsonResponse({ text: 'hola' }));
    const staleAuth: SttSessionAuth = { hasSession: () => true, getToken: async () => null };
    await transcribeAudio(INPUT, { auth: staleAuth, usageTracker: fakeTracker() });
    expect(mock.mock.calls[0][0]).toBe(GROQ_STT_ENDPOINT);
  });

  it('sin sesión y sin clave dev → unavailable sin tocar la red', async () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    setDev(undefined);
    delete process.env[ENV_KEY];
    const mock = stubFetch(async () => jsonResponse({ text: 'nope' }));
    const res = await transcribeAudio(INPUT, { auth: fakeAuth(null) });
    expect(res).toMatchObject({ ok: false, error: { kind: 'unavailable', retryable: false } });
    expect(mock).not.toHaveBeenCalled();
  });

  it('sin URL de Supabase la sesión no habilita el proxy: manda la clave dev', async () => {
    // beforeEach no setea la URL — con sesión pero sin endpoint proxy
    // configurado, la ruta directa dev es la única.
    const mock = stubFetch(async () => jsonResponse({ text: 'hola' }));
    await transcribeAudio(INPUT, { auth: fakeAuth('jwt_abc'), usageTracker: fakeTracker() });
    expect(mock.mock.calls[0][0]).toBe(GROQ_STT_ENDPOINT);
  });
});

describe('isSttAvailable — enrutado', () => {
  it('true con sesión + URL de proxy, sin clave dev', () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    setDev(undefined);
    delete process.env[ENV_KEY];
    expect(isSttAvailable(fakeAuth('jwt_abc'))).toBe(true);
  });

  it('false con URL de proxy pero sin sesión ni clave dev', () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    setDev(undefined);
    delete process.env[ENV_KEY];
    expect(isSttAvailable(fakeAuth(null))).toBe(false);
  });

  it('true sin sesión cuando hay clave dev (aunque haya URL de proxy)', () => {
    process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
    expect(isSttAvailable(fakeAuth(null))).toBe(true);
  });
});

describe('transcribeAudio — taxonomía HTTP vía proxy', () => {
  // El proxy normaliza los errores upstream a estos statuses (ver
  // supabase/functions/ai-stt/index.ts); el mapeo status→kind es el
  // mismo que en la ruta directa.
  const cases: { status: number; kind: string; retryable: boolean }[] = [
    { status: 401, kind: 'auth', retryable: false }, // JWT inválido/caducado
    { status: 400, kind: 'invalid_audio', retryable: false }, // audio rechazado
    { status: 413, kind: 'invalid_audio', retryable: false }, // cap de 10MB
    { status: 429, kind: 'rate_limited', retryable: true }, // rate limit passthrough
    { status: 500, kind: 'server', retryable: true }, // server_misconfigured
    { status: 502, kind: 'server', retryable: true }, // upstream_error
    { status: 504, kind: 'server', retryable: true }, // upstream_unreachable
  ];

  for (const c of cases) {
    it(`proxy ${c.status} → ${c.kind} (retryable: ${c.retryable}) sin contar cuota`, async () => {
      process.env[SUPABASE_URL_KEY] = SUPABASE_URL;
      const mock = stubFetch(async () => jsonResponse({ error: 'normalized_error' }, c.status));
      const tracker = fakeTracker();

      const res = await transcribeAudio(INPUT, {
        auth: fakeAuth('jwt_abc'),
        usageTracker: tracker,
      });

      expect(mock.mock.calls[0][0]).toBe(PROXY_ENDPOINT);
      expect(res).toMatchObject({
        ok: false,
        error: { kind: c.kind, retryable: c.retryable, status: c.status },
      });
      expect(tracker.recorded).toBe(0);
    });
  }
});
