import { useContext, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const tools = [
  ['Lista de invitados', 'Carga manual, Excel o Word, RSVP y restricciones alimentarias.'],
  ['Sitio del evento', 'Pagina editable por secciones: portada, historia, fotos, mapa y confirmacion.'],
  ['Planos y mesas', 'Editor visual para mesas, sillas, entrada, pista, escenario y sectores.'],
  ['Control de ingreso', 'Buscador, QR, presentes, faltantes y conteo en vivo.'],
  ['Organizacion', 'Checklist, cronograma, notas, proveedores y tareas internas.'],
  ['Servicios adicionales', 'Accesos comerciales a WhatsApp para proveedores y extras.'],
];

function resolvePrivateEntryPath(rawUser: unknown, identifier: string) {
  const role = String((rawUser as { role?: unknown } | null)?.role || '').trim().toLowerCase();
  const loginName = identifier.trim().toLowerCase();
  const isMasterLogin = role === 'master' || role === 'superadmin' || loginName === 'master';

  return isMasterLogin ? '/master' : '/';
}

function Logo() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-14 w-14 rounded-[18px] bg-gradient-to-br from-pink-400 via-fuchsia-500 to-orange-300 shadow-[0_0_38px_rgba(236,72,153,.55)]">
        <div className="absolute inset-3 rounded-full border-2 border-white/80" />
        <div className="absolute left-2 right-2 top-7 h-0.5 rotate-[-18deg] bg-white/90" />
      </div>
      <div>
        <p className="text-3xl font-black tracking-[0.22em] text-transparent bg-gradient-to-r from-orange-300 via-pink-300 to-violet-300 bg-clip-text">
          MI FIESTA
        </p>
        <p className="text-sm font-bold text-pink-100/78">
          Organiza tu evento en un solo lugar
        </p>
      </div>
    </div>
  );
}

function HeroDrawing() {
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-[560px]">
      <div className="absolute inset-0 rounded-full border border-pink-400/15 bg-[radial-gradient(circle_at_45%_42%,rgba(255,96,178,.22),transparent_32%),radial-gradient(circle_at_65%_67%,rgba(255,139,95,.22),transparent_28%)]" />
      <div className="absolute left-[28%] top-[28%] h-40 w-52 rotate-[-7deg] rounded-[28px] border-4 border-pink-400/80 bg-[#170817] shadow-[0_0_60px_rgba(236,72,153,.18)]">
        <div className="absolute left-8 right-8 top-9 h-1 rounded-full bg-gradient-to-r from-pink-400 to-violet-500" />
        <div className="absolute left-10 right-10 top-20 h-1 rounded-full bg-gradient-to-r from-violet-500 to-orange-300" />
        <div className="absolute left-[42%] top-[52%] text-5xl text-violet-400">*</div>
      </div>
      <div className="absolute bottom-[20%] right-[16%] h-28 w-28 rounded-[30px] bg-gradient-to-br from-pink-400 to-orange-300 p-4 shadow-[0_20px_60px_rgba(255,139,95,.38)]">
        <div className="h-full w-full rounded-[20px] border-4 border-white/80" />
      </div>
      <div className="absolute left-[18%] top-[20%] h-16 w-16 rounded-full border border-pink-400/30" />
      <div className="absolute right-[18%] top-[12%] text-3xl text-pink-300">*</div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { login, user } = useContext(AuthContext);
  const [showLogin, setShowLogin] = useState(false);
  const [identifier, setIdentifier] = useState('master');
  const [password, setPassword] = useState('Master123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: identifier,
        password,
      });

      login(data.user, data.access_token || data.token);
      setShowLogin(false);
      navigate(resolvePrivateEntryPath(data?.user, identifier), { replace: true });
    } catch (err: unknown) {
      const responseMessage =
        err && typeof err === 'object' && 'response' in err
          ? String(((err as { response?: { data?: { message?: unknown } } }).response?.data?.message || '')).trim()
          : '';
      setError(responseMessage || 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  const openPrivateArea = () => {
    if (!user) {
      setShowLogin(true);
      return;
    }

    navigate(user.role === 'master' ? '/master' : '/');
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#100311] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,139,95,.13),transparent_28%),radial-gradient(circle_at_90%_4%,rgba(168,85,247,.18),transparent_30%),linear-gradient(100deg,rgba(255,84,163,.08),transparent_34%)]" />

      <header className="sticky top-0 z-30 border-b border-pink-400/12 bg-[#100311]/86 backdrop-blur">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Logo />
          {user ? (
            <nav className="hidden items-center gap-10 text-[14px] font-black text-pink-100/84 lg:flex">
              <button type="button" onClick={openPrivateArea} className="hover:text-pink-300">
                Ir a mi panel
              </button>
            </nav>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (user) {
                  openPrivateArea();
                  return;
                }

                setShowLogin((value) => !value);
              }}
              className="rounded-[18px] border border-pink-400/25 px-5 py-3 text-sm font-black text-pink-50 hover:bg-pink-400/10"
            >
              {user ? 'Ir a mi panel' : 'Iniciar sesion'}
            </button>
          </div>
        </div>
      </header>

      {showLogin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
          <form
            onSubmit={submitLogin}
            className="w-full max-w-[420px] rounded-[28px] border border-pink-400/24 bg-[#1b091c] p-6 shadow-[0_24px_90px_rgba(0,0,0,.55)]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-300">
                  Acceso privado
                </p>
                <h2 className="mt-1 text-2xl font-black">Iniciar sesion</h2>
                <p className="mt-2 text-sm leading-6 text-pink-100/62">
                  Ingresan usuarios creados por el master o por un organizador.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-pink-400/22 text-pink-100"
                aria-label="Cerrar login"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {error ? (
              <p className="mb-3 rounded-[16px] border border-rose-400/24 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-100">
                {error}
              </p>
            ) : null}

            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-pink-100/54">
                Usuario o email
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-[16px] border border-pink-400/22 bg-black/25 px-4 py-3 text-white outline-none focus:border-pink-300"
                placeholder="master o email@dominio.com"
                autoFocus
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.14em] text-pink-100/54">
                Contrasena
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[16px] border border-pink-400/22 bg-black/25 px-4 py-3 text-white outline-none focus:border-pink-300"
                placeholder="Tu contrasena"
              />
            </label>

            <button
              disabled={loading}
              className="w-full rounded-[16px] bg-white px-4 py-3 text-sm font-black text-[#1b091c] disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      ) : null}

      <section className="relative">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-pink-400/22 bg-pink-400/8 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-300">
              Invitacion, gestion y acceso
            </div>
            <h1 className="text-[48px] font-black leading-[0.96] tracking-normal lg:text-[76px]">
              Organiza tu fiesta
              <span className="block text-transparent bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400 bg-clip-text">
                en un solo lugar
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-[17px] leading-8 text-pink-100/74">
              Invitaciones digitales, control de invitados, planos de mesa,
              organizacion y servicios extra. Simple, moderno y completo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openPrivateArea}
                className="rounded-[18px] bg-white px-5 py-3 text-sm font-black text-[#160916]"
              >
                {user ? 'Entrar a mi panel' : 'Entrar y organizar'}
              </button>
              <a
                href="#herramientas"
                className="rounded-[18px] border border-pink-400/24 px-5 py-3 text-sm font-black text-pink-50 hover:bg-pink-400/10"
              >
                Ver herramientas
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.16em] text-pink-100/66">
              <span className="rounded-full border border-pink-400/20 bg-white/[0.03] px-4 py-2">Invitacion editable</span>
              <span className="rounded-full border border-pink-400/20 bg-white/[0.03] px-4 py-2">Lista y RSVP</span>
              <span className="rounded-full border border-pink-400/20 bg-white/[0.03] px-4 py-2">Plano y check-in</span>
            </div>
          </div>
          <HeroDrawing />
        </div>
      </section>

      <section className="relative rotate-[-1.5deg] bg-[#1b091c] py-16">
        <div className="mx-auto max-w-[1500px] px-5">
          <p className="rotate-[1.5deg] text-center text-[42px] font-black leading-tight tracking-normal text-white lg:text-[72px]">
            Una web editable, una lista clara y un plano visual para que tu evento
            fluya antes y durante la fiesta.
          </p>
        </div>
      </section>

      <section id="herramientas" className="relative px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-300">
                Plataforma todo en uno
              </p>
              <h2 className="mt-3 max-w-2xl text-4xl font-black leading-tight">
                Flujos conectados para organizar sin perder informacion.
              </h2>
            </div>
            <div className="grid gap-3 rounded-full border border-pink-400/18 p-2 sm:grid-cols-4">
              {['Todo en un solo lugar', 'Organiza sin estres', 'Invita y controla', 'Vivi el evento'].map((item) => (
                <div key={item} className="px-5 py-4 text-center text-xs font-black text-pink-100/72">
                  <i className="fas fa-star mb-2 block text-pink-300"></i>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tools.map(([title, text]) => (
              <article key={title} className="rounded-[24px] border border-pink-400/22 bg-[#1b091c] p-5">
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-pink-100/68">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#170817] px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black">Constructor editable para invitados</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-pink-100/68">
            La pagina publica del evento se edita por bloques: portada, fecha,
            ubicacion, historia, fotos, dress code, RSVP, mapa y mensajes.
          </p>
          <div className="mt-8 overflow-hidden rounded-[28px] border border-pink-400/18 bg-[#100311]">
            <div className="flex items-center justify-between border-b border-pink-400/12 px-5 py-3 text-xs text-pink-100/58">
              <span>https://mifiesta.com/invitacion/camila</span>
              <span>Copiar - Abrir - Ajustes</span>
            </div>
            <div className="grid min-h-[420px] gap-0 lg:grid-cols-[280px_1fr]">
              <aside className="border-r border-pink-400/12 p-5">
                {['Portada', 'Fecha y lugar', 'Historia', 'Dress code', 'RSVP', 'Galeria', 'Mapa'].map((item, index) => (
                  <button
                    key={item}
                    className={`mb-2 block w-full rounded-[16px] px-4 py-3 text-left text-sm font-black ${
                      index === 0 ? 'bg-gradient-to-r from-pink-500 to-violet-500' : 'bg-white/[0.035] text-pink-100/70'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </aside>
              <div className="bg-[linear-gradient(rgba(16,3,17,.1),rgba(16,3,17,.62)),url('https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center p-10 text-center">
                <p className="mx-auto mt-16 w-fit border border-dashed border-white/55 bg-black/20 px-4 py-2 text-xl">
                  24 de julio de 2026
                </p>
                <h3 className="mx-auto mt-6 w-fit border border-dashed border-white/55 bg-black/20 px-5 py-3 text-5xl font-black">
                  15 Anos de Camila
                </h3>
                <button className="mt-8 rounded-[18px] bg-white px-6 py-3 text-sm font-black text-[#100311]">
                  Confirmar asistencia
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
