import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { refs } from '@/services/refs';
import { ensureUserProfile } from '@/services/profile';
import type { UserProfile } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  /** true mientras se resuelve la sesión inicial o el perfil. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Recarga el usuario (p. ej. tras verificar el correo) y fuerza un token nuevo. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setProfile(null);
      setProfileReady(!u);
      setAuthReady(true);
      // Sin await: sin conexión la escritura queda en cola y el perfil llega por el listener.
      if (u) ensureUserProfile(u).catch((e) => console.error('No se pudo crear el perfil', e));
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      refs.user(user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          setProfile({
            ...data,
            uid: snap.id,
            email: data.email || (user.email ?? '').toLowerCase(),
            displayName: data.displayName || user.displayName || (user.email ?? '').split('@')[0],
            businessIds: data.businessIds ?? []
          } as UserProfile);
        } else setProfile(null);
        // Listo cuando hay documento, o cuando el servidor confirma que aún no existe (usuario nuevo).
        if (snap.exists() || !snap.metadata.fromCache) setProfileReady(true);
      },
      (err) => {
        console.error('Error leyendo perfil', err);
        setProfileReady(true);
      }
    );
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await ensureUserProfile(cred.user, name.trim());
    sendEmailVerification(cred.user).catch(() => undefined);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setTick((t) => t + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading: !authReady || (!!user && !profileReady),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resetPassword,
      resendVerification,
      refreshUser
    }),
    [user, profile, authReady, profileReady, signIn, signUp, signInWithGoogle, signOut, resetPassword, resendVerification, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
