import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, MailCheck, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recupera tu contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" /> Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-fixed/15 p-4">
          <MailCheck className="mt-0.5 size-5 text-primary" />
          <div className="flex flex-col gap-1">
            <span className="text-label-lg">Revisa tu bandeja de entrada</span>
            <span className="text-body-md text-on-surface-variant">
              Si existe una cuenta con <b>{email}</b>, recibirás un enlace para restablecer la contraseña. Revisa también la carpeta de spam.
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Correo electrónico" htmlFor="email">
            <Input id="email" type="email" icon={Mail} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" inputSize="lg" />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-body-md text-red-700">{error}</p>}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
