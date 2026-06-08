import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);

      const { data } = await api.post('/auth/login', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      login(data.user, data.access_token || data.token);
      navigate(data?.user?.role === 'master' ? '/master' : '/');
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'No se pudo iniciar sesión',
      );
    } finally {
      setLoading(false);
    }
  };

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
              <i className="fas fa-right-to-bracket text-xl"></i>
            </div>

            <h1 className="text-2xl font-black text-slate-900">
              Iniciar sesión
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Ingresá con tu correo electrónico y tu contraseña para entrar a tu panel.
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
                type="text"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#3483fa]"
                placeholder="master o rodrigo@email.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-700">Contraseña</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 outline-none focus:border-[#3483fa]"
                  placeholder="Tu contraseña"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[#3483fa] px-4 py-3 text-sm font-black text-white shadow-[0_10px_24px_rgba(52,131,250,0.22)] disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            <p className="text-slate-600">
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="font-black text-[#3483fa]">
                Crear una cuenta
              </Link>
            </p>

            <p className="text-slate-600">
              ¿Olvidaste tu contraseña?{' '}
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
