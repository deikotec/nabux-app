import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

/** Redimensiona y comprime una imagen en el navegador antes de subirla. */
export async function compressImage(file: File, maxSize = 800, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (blob) return blob;
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/jpeg', quality)
  );
}

export interface UploadedImage {
  url: string;
  path: string;
}

/**
 * Sube una imagen comprimida a Storage.
 * @param folder ej. `businesses/{bid}/products` o `users/{uid}`
 */
export async function uploadImage(file: File, folder: string, maxSize = 800): Promise<UploadedImage> {
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máx. 15 MB).');
  const blob = await compressImage(file, maxSize);
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const objectRef = ref(storage, path);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'image/jpeg', cacheControl: 'public,max-age=31536000' });
  const url = await getDownloadURL(objectRef);
  return { url, path };
}

export async function deleteImage(path?: string | null) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* ya no existe o sin permiso: no bloquea la operación principal */
  }
}
