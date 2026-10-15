import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout, Divider, GoogleIcon } from './AuthLayout';

export default function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setLoading('email');
    try {
      await signUp(name, email, password);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  };

  const google = async () => {
    setError('');
    setLoading('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(null);
    }
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="En 2 minutos tendrás tu negocio listo para vender."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <Button variant="secondary" size="lg" fullWidth onClick={google} loading={loading === 'google'} disabled={!!loading}>
        {loading !== 'google' && <GoogleIcon />}
        Registrarme con Google
      </Button>
      <Divider label="o con tu correo" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre completo" htmlFor="name">
          <Input id="name" icon={User} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María Gómez" />
        </Field>
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" type="email" icon={Mail} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contraseña" htmlFor="password">
            <Input id="password" type="password" icon={Lock} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 6 caracteres" />
          </Field>
          <Field label="Confirmar" htmlFor="confirm">
            <Input id="confirm" type="password" icon={Lock} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-body-md text-red-700">{error}</p>}
        <Button type="submit" size="lg" fullWidth loading={loading === 'email'} disabled={!!loading}>
          Crear cuenta
        </Button>
        <p className="text-center text-body-sm text-on-surface-variant">Te enviaremos un correo para verificar tu dirección.</p>
      </form>
    </AuthLayout>
  );
}
