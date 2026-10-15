import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout, Divider, GoogleIcon } from './AuthLayout';

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading('email');
    try {
      await signIn(email, password);
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
      title="Inicia sesión"
      subtitle="Bienvenido de vuelta. Entra para gestionar tu negocio."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold text-primary hover:underline">
            Crea una gratis
          </Link>
        </>
      }
    >
      <Button variant="secondary" size="lg" fullWidth onClick={google} loading={loading === 'google'} disabled={!!loading}>
        {loading !== 'google' && <GoogleIcon />}
        Continuar con Google
      </Button>
      <Divider label="o con tu correo" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" type="email" icon={Mail} autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" inputSize="lg" />
        </Field>
        <Field
          label="Contraseña"
          htmlFor="password"
          aside={
            <Link to="/recuperar" className="text-label-md text-primary hover:underline">
              ¿La olvidaste?
            </Link>
          }
        >
          <Input
            id="password"
            type={show ? 'text' : 'password'}
            icon={Lock}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            inputSize="lg"
            suffix={
              <button type="button" onClick={() => setShow((s) => !s)} className="p-1 text-slate-400 hover:text-slate-700" aria-label={show ? 'Ocultar' : 'Mostrar'}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-body-md text-red-700">{error}</p>}
        <Button type="submit" size="lg" fullWidth loading={loading === 'email'} disabled={!!loading}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
