import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type Props = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: ReactNode;
};

export default function AppHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  rightSlot,
}: Props) {
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="app-sticky-header sticky top-0 z-40 mb-3 overflow-hidden rounded-b-[20px] border border-black/5 bg-[#fff159]/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[#fff159]/88"
    >
      <div className="px-4 pt-3 pb-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3483fa] text-white shadow-[0_6px_14px_rgba(52,131,250,0.24)]">
              <i className="fas fa-calendar-check text-xs"></i>
            </div>

            <div className="min-w-0 leading-tight">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-700">
                Pase Libre
              </p>
              <p className="truncate text-[12px] font-semibold text-slate-800">
                Creá, compartí y organizá tu evento
              </p>
            </div>
          </div>

          {rightSlot}
        </div>

        <div className="mt-2 flex items-center gap-2.5">
          {showBack ? (
            <button
              type="button"
              onClick={() => (onBack ? onBack() : navigate(-1))}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-label="Volver"
            >
              <i className="fas fa-arrow-left text-sm"></i>
            </button>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-white text-[#3483fa] shadow-sm">
              <i className="fas fa-house text-sm"></i>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[21px] font-black leading-tight text-slate-900">
              {title}
            </h1>

            {subtitle ? (
              <p className="truncate text-[13px] text-slate-700">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}