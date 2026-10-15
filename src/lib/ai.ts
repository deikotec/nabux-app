/**
 * IA de Nabux: Gemini a través de Firebase AI Logic, llamado directamente desde el navegador.
 *
 * Sin servidor propio y sin claves en el código: Firebase hace de intermediario y App Check
 * (reCAPTCHA) demuestra que la petición sale de esta app. Firebase exige App Check para AI Logic,
 * así que la IA solo se enciende cuando hay `VITE_RECAPTCHA_SITE_KEY`; sin ella, todo lo que
 * usa IA sigue funcionando con reglas automáticas y la pantalla lo dice.
 *
 * El SDK de IA y App Check se cargan bajo demanda (la primera vez que se usa la IA), para no
 * pesar en el POS ni mostrar reCAPTCHA donde no hace falta.
 */
import type { GenerativeModel } from 'firebase/ai';
import { app, firebaseConfigMissing } from './firebase';

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? '';

/** La IA está configurada en este despliegue (no garantiza que el servicio responda). */
export const aiConfigured = !!SITE_KEY && !firebaseConfigMissing && import.meta.env.VITE_AI_DISABLED !== 'true';

/** Modelos a probar, en orden. Si uno no existe en el proyecto se pasa al siguiente y se recuerda. */
const TEXT_MODELS = uniq([import.meta.env.VITE_AI_MODEL, 'gemini-3.5-flash-lite', 'gemini-3.6-flash']);
const VISION_MODELS = uniq([import.meta.env.VITE_AI_VISION_MODEL, import.meta.env.VITE_AI_MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);

function uniq(list: (string | undefined)[]): string[] {
  return Array.from(new Set(list.map((m) => m?.trim()).filter((m): m is string => !!m)));
}

export type AiErrorKind = 'not-configured' | 'app-check' | 'not-enabled' | 'billing' | 'quota' | 'network' | 'blocked' | 'bad-response' | 'unknown';

/** Error de IA con un mensaje listo para mostrar. */
export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
  }
}

const NOT_CONFIGURED = new AiError(
  'not-configured',
  'La IA no está activada en este negocio. Se usan reglas automáticas; pide al administrador que active Firebase AI Logic y App Check.'
);

/** Tras un fallo de configuración no se reintenta en toda la sesión: cada intento sería otro error igual. */
let fatal: AiError | null = null;

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const raw = e instanceof Error ? e.message : String(e);
  const msg = raw.toLowerCase();
  if (msg.includes('app check') || msg.includes('appcheck') || msg.includes('recaptcha')) {
    return new AiError('app-check', 'La IA está bloqueada: falta activar App Check para Firebase AI Logic en la consola de Firebase.');
  }
  if (msg.includes('api-not-enabled') || msg.includes('has not been used') || msg.includes('is disabled') || msg.includes('deactivated')) {
    return new AiError('not-enabled', 'Firebase AI Logic no está habilitado en el proyecto de Firebase.');
  }
  if (msg.includes('prepayment') || msg.includes('credits are depleted') || msg.includes('billing')) {
    return new AiError('billing', 'La cuenta de IA del proyecto no tiene saldo. El administrador debe recargar créditos de la API de Gemini en AI Studio (ai.studio).');
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit')) {
    return new AiError('quota', 'La IA alcanzó su límite de uso por ahora. Espera un par de minutos e inténtalo de nuevo.');
  }
  if (msg.includes('safety') || msg.includes('blocked')) {
    return new AiError('blocked', 'La IA no pudo procesar este contenido.');
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch-error') || !navigator.onLine) {
    return new AiError('network', 'No hay conexión con el servicio de IA. Revisa tu internet.');
  }
  console.error('Error de IA', e);
  return new AiError('unknown', 'La IA no respondió como se esperaba. Puedes seguir sin ella.');
}

function isModelNotFound(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes('404') || msg.includes('not found') || (msg.includes('model') && msg.includes('not supported'));
}

type AiSdk = typeof import('firebase/ai');
let sdkPromise: Promise<{ sdk: AiSdk; ai: ReturnType<AiSdk['getAI']> }> | null = null;

async function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
        // Token de depuración para localhost (se registra en Firebase → App Check → Administrar tokens de depuración).
        (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
          import.meta.env.VITE_APPCHECK_DEBUG_TOKEN === 'true' ? true : import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
      }
      const appCheck = await import('firebase/app-check');
      const provider =
        import.meta.env.VITE_RECAPTCHA_PROVIDER === 'v3' ? new appCheck.ReCaptchaV3Provider(SITE_KEY) : new appCheck.ReCaptchaEnterpriseProvider(SITE_KEY);
      try {
        appCheck.initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
      } catch {
        /* ya estaba inicializado (recarga en caliente) */
      }
      const sdk = await import('firebase/ai');
      return { sdk, ai: sdk.getAI(app, { backend: new sdk.GoogleAIBackend() }) };
    })();
    sdkPromise.catch(() => {
      sdkPromise = null;
    });
  }
  return sdkPromise;
}

/** Modelo que funcionó la última vez, por tipo de tarea. */
const workingModel: { text?: string; vision?: string } = {};

export type AiPart = string | { mimeType: string; data: string };

export interface JsonRequest {
  /** Instrucciones de sistema. */
  system: string;
  /** Contenido del usuario: textos e imágenes (base64). */
  parts: AiPart[];
  /** JSON Schema de la respuesta. */
  schema: Record<string, unknown>;
  /** Usa el modelo de visión (más preciso leyendo fotos). */
  vision?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Pide al modelo una respuesta JSON con el esquema dado y la devuelve ya parseada.
 * Lanza `AiError` con un mensaje para el usuario si algo falla.
 */
export async function generateJson<T>(req: JsonRequest): Promise<T> {
  if (!aiConfigured) throw NOT_CONFIGURED;
  if (fatal) throw fatal;
  let loaded: Awaited<ReturnType<typeof loadSdk>>;
  try {
    loaded = await loadSdk();
  } catch (e) {
    throw toAiError(e);
  }
  const { sdk, ai } = loaded;
  const slot = req.vision ? 'vision' : 'text';
  const candidates = workingModel[slot] ? [workingModel[slot]!] : req.vision ? VISION_MODELS : TEXT_MODELS;

  let lastError: unknown = null;
  for (const name of candidates) {
    const model: GenerativeModel = sdk.getGenerativeModel(ai, {
      model: name,
      systemInstruction: req.system,
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: req.schema,
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.maxOutputTokens
      }
    });
    try {
      const result = await model.generateContent(req.parts.map((p) => (typeof p === 'string' ? p : { type: 'inlineData' as const, inlineData: p })));
      workingModel[slot] = name;
      const text = result.response.text();
      const parsed = parseJson(text);
      if (parsed === null) throw new AiError('bad-response', 'La IA devolvió una respuesta incompleta. Inténtalo de nuevo.');
      return parsed as T;
    } catch (e) {
      lastError = e;
      if (e instanceof AiError) throw e;
      if (isModelNotFound(e)) continue;
      const err = toAiError(e);
      if (err.kind === 'app-check' || err.kind === 'not-enabled' || err.kind === 'billing') fatal = err;
      throw err;
    }
  }
  throw toAiError(lastError ?? new Error('Ningún modelo de IA disponible'));
}

/** Saca el JSON de la respuesta aunque venga envuelto en ``` o con texto alrededor. */
function parseJson(text: string): unknown {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const candidates = [raw];
  const start = raw.search(/[{[]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* siguiente candidato */
    }
  }
  return null;
}

/** Convierte un Blob a base64 (sin el prefijo data:). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}
