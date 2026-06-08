import { Link, useNavigate } from 'react-router-dom';

type AppUser = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  role?: 'master' | 'creator' | 'organizer' | 'guest' | 'seller' | 'door';
};

type Props = {
  user?: AppUser | null;
  showCreate?: boolean;
  onLogout?: () => void;
};

function getFirstName(user?: AppUser | null) {
  if (!user) return 'organizador';

  if (user.firstName?.trim()) {
    return user.firstName.trim();
  }

  if (user.fullName?.trim()) {
    return user.fullName.trim().split(' ')[0];
  }

  if (user.email?.trim()) {
    return user.email.trim().split('@')[0];
  }

  return 'organizador';
}

function getRoleLabel(role?: AppUser['role']) {
  if (role === 'creator') return 'Organizador';
  if (role === 'organizer') return 'Organizador';
  if (role === 'master') return 'Master';
  if (role === 'guest') return 'Usuario final';
  if (role === 'seller') return 'Ventas';
  if (role === 'door') return 'Acceso';
  return 'Usuario';
}

function getBrandByRole(role?: AppUser['role']) {
  if (role === 'creator' || role === 'organizer' || role === 'master') {
    return {
      icon: 'fa-calendar-check',
      iconWrapClass: 'bg-gradient-to-br from-pink-400 via-fuchsia-500 to-orange-300 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)]',
      badgeClass: 'bg-pink-500/10 text-pink-100 border border-pink-400/18',
    };
  }

  if (role === 'seller') {
    return {
      icon: 'fa-bullhorn',
      iconWrapClass: 'bg-gradient-to-br from-orange-300 to-pink-400 text-white shadow-[0_10px_24px_rgba(251,146,60,0.26)]',
      badgeClass: 'bg-orange-500/10 text-orange-100 border border-orange-300/20',
    };
  }

  if (role === 'door') {
    return {
      icon: 'fa-qrcode',
      iconWrapClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_10px_24px_rgba(139,92,246,0.26)]',
      badgeClass: 'bg-violet-500/10 text-violet-100 border border-violet-300/20',
    };
  }

  return {
    icon: 'fa-ticket-alt',
    iconWrapClass: 'bg-gradient-to-br from-pink-400 via-fuchsia-500 to-orange-300 text-white shadow-[0_10px_24px_rgba(236,72,153,0.28)]',
    badgeClass: 'bg-white/8 text-pink-50 border border-pink-300/16',
  };
}

export default function LoggedTopBar({
  user,
  showCreate = true,
  onLogout,
}: Props) {
  const navigate = useNavigate();
  const firstName = getFirstName(user);
  const roleLabel = getRoleLabel(user?.role);
  const brand = getBrandByRole(user?.role);

  return (
    <div className="tour-hide-on-tour sticky top-0 z-30 border-b border-pink-400/10 bg-[#120512]/88 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex min-w-0 items-center gap-3"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${brand.iconWrapClass}`}
          >
            <i className={`fas ${brand.icon}`}></i>
          </div>

          <div className="min-w-0 text-left leading-tight">
            <p className="truncate text-[13px] font-black tracking-[0.22em] text-pink-100">
              MI FIESTA
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[11px] text-pink-100/60">Hola, {firstName}</p>

              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${brand.badgeClass}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {showCreate ? (
            <Link
              to="/create"
              className="rounded-full bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-2 text-xs font-black text-white shadow-[0_10px_22px_rgba(236,72,153,0.22)] transition hover:brightness-110"
            >
              Crear evento
            </Link>
          ) : null}

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-pink-400/16 text-pink-100 transition hover:bg-white/6"
            aria-label="Salir"
            title="Cerrar sesión"
          >
            <i className="fas fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
