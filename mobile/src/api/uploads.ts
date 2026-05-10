/**
 * Helper d'upload de fichier vers le backend (POST /api/uploads).
 *
 * Le backend reçoit un multipart/form-data avec le champ "file", l'envoie
 * sur Cloudflare R2, et renvoie l'URL publique permettant de consommer le
 * fichier (à stocker dans avatar_url ou media_url).
 *
 * Note importante : on ne peut PAS utiliser `apiRequest` (qui fait un
 * JSON.stringify du body). On a besoin du Content-Type multipart avec
 * boundary, que React Native génère automatiquement quand on passe un
 * FormData à fetch.
 */
import { useAuthStore } from '../store/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

interface UploadOptions {
  /**
   * Sous-dossier R2 où ranger le fichier ("avatars", "messages", etc.).
   * Le backend sanitize cette valeur, donc on peut envoyer ce qu'on veut.
   */
  prefix?: string;
  /**
   * Type MIME explicite. Si omis, on essaie de le déduire de l'extension
   * de l'URI locale.
   */
  contentType?: string;
  /** Nom de fichier optionnel (info pour le serveur, pas critique). */
  fileName?: string;
}

export class UploadError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Upload un fichier local (URI file://...) vers le backend.
 * Retourne l'URL publique R2 utilisable comme avatar_url ou media_url.
 */
export async function uploadFile(
  localUri: string,
  opts: UploadOptions = {},
): Promise<string> {
  const tokens = useAuthStore.getState().tokens;
  if (!tokens) {
    throw new UploadError(401, 'not_authenticated');
  }

  const contentType = opts.contentType ?? guessContentType(localUri);
  const fileName = opts.fileName ?? guessFileName(localUri);

  const formData = new FormData();
  // React Native accepte cet objet spécial { uri, type, name } pour un fichier
  // local. TypeScript est strict, d'où le @ts-expect-error.
  // @ts-expect-error : FormData natif RN ≠ FormData web
  formData.append('file', {
    uri: localUri,
    type: contentType,
    name: fileName,
  });
  if (opts.prefix) {
    formData.append('prefix', opts.prefix);
  }

  // ATTENTION : on NE met PAS le header Content-Type, fetch le génère
  // automatiquement avec le bon boundary multipart.
  const response = await fetch(`${BASE_URL}/api/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/json',
    },
    body: formData as unknown as BodyInit,
  });

  if (!response.ok) {
    let code: string | undefined;
    let detail: string | undefined;
    try {
      const data = await response.json();
      code = data?.error;
      detail = data?.detail;
    } catch {
      // ignore
    }
    throw new UploadError(
      response.status,
      detail ?? `Upload failed (${response.status})`,
      code,
    );
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/** Déduit le MIME type de l'extension. */
function guessContentType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/jpeg'; // iOS HEIC souvent converti
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}

/** Déduit un nom de fichier simple depuis l'URI. */
function guessFileName(uri: string): string {
  const lastSlash = uri.lastIndexOf('/');
  const candidate = lastSlash >= 0 ? uri.substring(lastSlash + 1) : uri;
  // Strip query string si présente.
  const qmark = candidate.indexOf('?');
  return qmark >= 0 ? candidate.substring(0, qmark) : candidate;
}
