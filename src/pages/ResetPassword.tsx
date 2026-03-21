import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import PasswordStrength from '../components/PasswordStrength';
import { getPasswordChecks } from '../utils/passwordRules';

type ResetResponse = {
  message: string;
  newRecoveryCode: string;
};

export default function ResetPassword() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    recoveryCode: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<ResetResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const checks = useMemo(
    () => getPasswordChecks(form.newPassword),
    [form.newPassword],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (!checks.isSafe) {
      setError(
        'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número',
      );
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post<ResetResponse>(
        '/auth/password/reset-with-recovery',
        {
          email: form.email.trim().toLowerCase(),
          recoveryCode: form.recoveryCode.trim().toUpperCase(),
          newPassword: form.newPassword,
        },
      );

      setSuccess(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'No se pudo cambiar la contraseña',
      );
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!success?.newRecoveryCode) return;
    try {
      await navigator.clipboard.writeText(success.newRecoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error(err);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 py-6">
        <div className="mx-auto max-w-[520px]">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-emerald-200 bg-white p-6 shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
              <i className="fas fa-key text-2xl"></i>
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              Contraseña actualizada
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tu contraseña ya fue cambiada. Como medida de seguridad también se
              generó un nuevo código de recuperación.
            </p>

            <div className="mt-5 rounded-[24px] border border-[#ffe17d] bg-[#fff9db] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
                Nuevo código de recuperación
              </p>

              <p className="mt-2 break-all text-2xl font-black tracking-[0.18em] text-slate-900">
                {success.newRecoveryCode}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white"
                >
                  <i className="fas fa-copy mr-2"></i>
                  {copied ? 'Copiado' : 'Copiar código'}
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
                >
                  Ir al login
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6">
      <div className="mx-auto max-w-[520px]">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
        >
          <div className="mb-5">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-[#fff159] text-[#3483fa]">
              <i className="fas fa-unlock-keyhole text-xl"></i>
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              Recuperar contraseña
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Como este sistema no envía correos todavía, la recuperación se hace
              con el código que se muestra al momento de crear la cuenta.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Correo electrónico</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                placeholder="rodrigo@email.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Código de recuperación</span>
              <input
                type="text"
                value={form.recoveryCode}
                onChange={(e) => setForm((prev) => ({ ...prev, recoveryCode: e.target.value.toUpperCase() }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 uppercase tracking-[0.16em] text-slate-900 outline-none focus:border-[#3483fa]"
                placeholder="ABCD-EFGH-JK12"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Nueva contraseña</span>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                placeholder="Elegí una contraseña nueva"
              />
            </label>

            <PasswordStrength password={form.newPassword} />

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Repetir nueva contraseña</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                placeholder="Volvé a escribirla"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#3483fa] px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(52,131,250,0.22)] disabled:opacity-60"
            >
              {loading ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm">
            <Link to="/" className="font-black text-[#3483fa]">
              Volver al login
            </Link>
          </div>
        </motion.section>
      </div>
    </main>
  );
}