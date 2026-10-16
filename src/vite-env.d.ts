/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_USE_EMULATORS?: string;
  /** Clave de sitio de reCAPTCHA para App Check: sin ella la IA queda apagada. */
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  /** "enterprise" (por defecto) o "v3". */
  readonly VITE_RECAPTCHA_PROVIDER?: string;
  /** Token de depuración de App Check para localhost ("true" para generar uno). */
  readonly VITE_APPCHECK_DEBUG_TOKEN?: string;
  /** Modelo de Gemini para texto (y para fotos si no hay VITE_AI_VISION_MODEL). */
  readonly VITE_AI_MODEL?: string;
  readonly VITE_AI_VISION_MODEL?: string;
  /** "true" apaga la IA aunque haya App Check. */
  readonly VITE_AI_DISABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
