import { Link, useNavigate } from 'react-router-dom';

type AppUser = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  role?: 'creator' | 'seller' | 'door';
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
  if (role === 'seller') return 'Ventas';
  if (role === 'door') return 'Acceso';
  return 'Usuario';
}

function getBrandByRole(role?: AppUser['role']) {
  if (role === 'creator') {
    return {
      icon: 'fa-calendar-check',
      iconWrapClass: 'bg-[#fff159] text-[#3483fa]',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    };
  }

  if (role === 'seller') {
    return {
      icon: 'fa-bullhorn',
      iconWrapClass: 'bg-[#eaf2ff] text-[#3483fa]',
      badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200',
    };
  }

  if (role === 'door') {
    return {
      icon: 'fa-qrcode',
      iconWrapClass: 'bg-[#eef2ff] text-indigo-600',
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    };
  }

  return {
    icon: 'fa-ticket-alt',
    iconWrapClass: 'bg-[#fff159] text-[#3483fa]',
    badgeClass: 'bg-slate-50 text-slate-700 border border-slate-200',
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
    <div className="tour-hide-on-tour sticky top-0 z-30 border-b border-black/5 bg-white/92 backdrop-blur">
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
            <p className="truncate text-[13px] font-black text-slate-900">
              Pase Libre
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[11px] text-slate-500">Hola, {firstName}</p>

              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${brand.badgeClass}`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {showCreate && user?.role === 'creator' && (
            <Link
              to="/create"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#00a650] px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_22px_rgba(0,166,80,0.18)] transition hover:translate-y-[-1px]"
              aria-label="Crear evento"
              title="Crear evento"
            >
              <i className="fas fa-plus"></i>
              <span className="sm:hidden">Crear</span>
              <span className="hidden sm:inline">Crear evento</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
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