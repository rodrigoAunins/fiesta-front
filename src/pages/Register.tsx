import { useContext, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import PasswordStrength from '../components/PasswordStrength';
import { getPasswordChecks } from '../utils/passwordRules';

type RegisterResponse = {
  token: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    role: 'creator' | 'seller';
  };
  recoveryCode: string;
  message: string;
};

export default function Register() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<RegisterResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const checks = useMemo(() => getPasswordChecks(form.password), [form.password]);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const copyRecoveryCode = async () => {
    if (!successData?.recoveryCode) return;

    try {
      await navigator.clipboard.writeText(successData.recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error(err);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Completá nombre y apellido');
      return;
    }

    if (!form.email.trim()) {
      setError('Completá el correo electrónico');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (!checks.isSafe) {
      setError(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número',
      );
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post<RegisterResponse>('/auth/register', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      login(data.user, data.token);
      setSuccessData(data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'No se pudo crear la cuenta. Probá nuevamente.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] px-4 py-6">
        <div className="mx-auto max-w-[520px]">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-emerald-200 bg-white p-6 shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600">
              <i className="fas fa-shield-check text-2xl"></i>
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              Cuenta creada correctamente
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Antes de seguir, guardá este código de recuperación. Te va a servir
              para cambiar la contraseña si algún día no podés entrar y no tenés
              envío por email.
            </p>

            <div className="mt-5 rounded-[24px] border border-[#ffe17d] bg-[#fff9db] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">
                Código de recuperación
              </p>
              <p className="mt-2 break-all text-2xl font-black tracking-[0.18em] text-slate-900">
                {successData.recoveryCode}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyRecoveryCode}
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
                  Ya lo guardé, continuar
                </button>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-amber-700">
              Importante: este código se muestra una sola vez. Guardalo en un lugar seguro.
            </p>
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
              <i className="fas fa-user-plus text-xl"></i>
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              Crear cuenta
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Registrate con tus datos reales para que el sistema te salude por tu
              nombre y el acceso quede asociado a tu correo electrónico.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">Nombre</span>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                  placeholder="Rodrigo"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700">Apellido</span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                  placeholder="Aunins"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Correo electrónico</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                placeholder="rodrigo@email.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Contraseña</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 outline-none focus:border-[#3483fa]"
                  placeholder="Elegí una contraseña segura"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </label>

            <PasswordStrength password={form.password} />

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Repetir contraseña</span>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 outline-none focus:border-[#3483fa]"
                  placeholder="Volvé a escribirla"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#3483fa] px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(52,131,250,0.22)] disabled:opacity-60"
            >
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            <p className="text-slate-600">
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="font-black text-[#3483fa]">
                Iniciar sesión
              </Link>
            </p>

            <p className="text-slate-600">
              ¿Perdiste tu clave?{' '}
              <Link to="/reset-password" className="font-black text-[#3483fa]">
                Recuperarla con código
              </Link>
            </p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}