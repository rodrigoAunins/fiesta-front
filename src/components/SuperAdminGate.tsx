import { useContext, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  clearSuperAdminSession,
  getMaskedAdminEmails,
  getSuperAdminPin,
  grantSuperAdminSession,
  hasSuperAdminSession,
  isSuperAdminUser,
  requiresSuperAdminPin,
} from '../utils/adminAccess';

type SuperAdminGateProps = {
  children: ReactNode;
};

function GateShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] px-6 py-6 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
              Panel privado
            </p>
            <h1 className="mt-2 text-[30px] font-black leading-none">{title}</h1>
            <p className="mt-3 text-[14px] leading-6 text-slate-300">{description}</p>
          </div>

          <div className="p-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export default function SuperAdminGate({ children }: SuperAdminGateProps) {
  const { user, ready } = useContext(AuthContext) as any;
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const isAllowed = useMemo(() => isSuperAdminUser(user), [user]);
  const needsPin = requiresSuperAdminPin();
  const expectedPin = getSuperAdminPin();
  const sessionOk = hasSuperAdminSession();

  if (!ready) {
    return (
      <GateShell
        title="Verificando acceso"
        description="Estamos validando tu sesión para abrir el panel maestro."
      >
        <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#fb7185]"></div>
          <div>
            <p className="text-[15px] font-black text-slate-900">Cargando permisos</p>
            <p className="text-[13px] text-slate-500">Un segundo y te dejamos pasar.</p>
          </div>
        </div>
      </GateShell>
    );
  }

  if (!user?.id) {
    clearSuperAdminSession();

    return (
      <GateShell
        title="Necesitás iniciar sesión"
        description="Este panel no está expuesto al público. Primero tenés que entrar con tu cuenta."
      >
        <div className="space-y-4">
          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-[14px] font-black text-amber-900">Sesión requerida</p>
            <p className="mt-1 text-[13px] leading-6 text-amber-800">
              Iniciá sesión con la cuenta administradora y después volvé a abrir esta ruta.
            </p>
          </div>

          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-3 text-[14px] font-black text-white shadow-[0_10px_20px_rgba(236,72,153,0.22)]"
          >
            Ir a login
          </Link>
        </div>
      </GateShell>
    );
  }

  if (!isAllowed) {
    clearSuperAdminSession();

    return (
      <GateShell
        title="Acceso restringido"
        description="Tu cuenta no figura dentro de la lista permitida para el panel maestro."
      >
        <div className="space-y-4">
          <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4">
            <p className="text-[14px] font-black text-rose-900">Cuenta actual</p>
            <p className="mt-1 break-all text-[13px] text-rose-800">
              {user?.email || 'Sin email'}
            </p>
          </div>

          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
              Emails habilitados en front
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {getMaskedAdminEmails().length > 0 ? (
                getMaskedAdminEmails().map((email) => (
                  <span
                    key={email}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700"
                  >
                    {email}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-slate-500">
                  No configuraste VITE_SUPERADMIN_EMAILS todavía.
                </span>
              )}
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex w-full items-center justify-center rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-black text-slate-700"
          >
            Volver al inicio
          </Link>
        </div>
      </GateShell>
    );
  }

  if (needsPin && !sessionOk) {
    return (
      <GateShell
        title="Confirmación adicional"
        description="Tu email está permitido, pero para abrir el panel también tenés que ingresar el PIN privado."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();

            if (pin.trim() !== expectedPin) {
              setPinError('El PIN no coincide.');
              return;
            }

            setPinError('');
            grantSuperAdminSession();
            setPin('');
          }}
        >
          <div className="rounded-[20px] border border-[#bfdbfe] bg-[#eff6ff] p-4">
            <p className="text-[13px] font-black text-[#be185d]">Cuenta habilitada</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              Entraste con <b>{user?.email}</b>. Solo falta validar el PIN.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
              PIN superadmin
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Ingresá tu PIN privado"
              className="w-full rounded-[18px] border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none focus:border-[#fb7185]"
              autoFocus
            />
            {pinError ? (
              <p className="mt-2 text-[12px] font-bold text-rose-600">{pinError}</p>
            ) : null}
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-3 text-[14px] font-black text-white shadow-[0_10px_20px_rgba(236,72,153,0.22)]"
          >
            Entrar al panel
          </button>
        </form>
      </GateShell>
    );
  }

  return <>{children}</>;
}