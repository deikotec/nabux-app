import type { User } from 'firebase/auth';
import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { refs } from './refs';

/**
 * Crea o completa el documento users/{uid}. Nunca toca `businessIds` (eso lo hacen createBusiness y
 * acceptInvite con arrayUnion) y si no puede leer el documento (sin conexión) no escribe nada.
 */
export async function ensureUserProfile(user: User, displayName?: string) {
  const ref = refs.user(user.uid);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch {
    return;
  }
  const name = (displayName || user.displayName || '').trim();

  if (snap.exists()) {
    const data = snap.data();
    const patch: Record<string, unknown> = {};
    if (name && data.displayName !== name && (displayName || !data.displayName)) patch.displayName = name;
    if (!data.photoURL && user.photoURL) patch.photoURL = user.photoURL;
    if (!data.email && user.email) patch.email = user.email.toLowerCase();
    if (Object.keys(patch).length) await setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  await setDoc(
    ref,
    {
      uid: user.uid,
      email: (user.email ?? '').toLowerCase(),
      ...(name ? { displayName: name } : {}),
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function setLastBusiness(uid: string, businessId: string) {
  await setDoc(refs.user(uid), { lastBusinessId: businessId, updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
}

export async function updateUserProfile(uid: string, data: { displayName?: string; photoURL?: string | null }) {
  await setDoc(refs.user(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
