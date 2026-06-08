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
      className="app-sticky-header sticky top-0 z-40 mb-3 overflow-hidden rounded-b-[24px] border border-pink-400/14 bg-[#120512]/92 shadow-[0_14px_32px_rgba(10,3,17,.22)] backdrop-blur supports-[backdrop-filter]:bg-[#120512]/88"
    >
      <div className="px-4 pt-3 pb-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-pink-400 via-fuchsia-500 to-orange-300 text-white shadow-[0_10px_24px_rgba(236,72,153,0.32)]">
              <div className="absolute inset-[9px] rounded-full border border-white/80" />
              <div className="absolute left-[7px] right-[7px] top-[19px] h-[1.5px] rotate-[-18deg] bg-white/90" />
            </div>

            <div className="min-w-0 leading-tight">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-pink-200/72">
                Mi Fiesta
              </p>
              <p className="truncate text-[12px] font-semibold text-white/92">
                Organiza tu evento en un solo lugar
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-400/14 bg-white/6 text-pink-50 shadow-sm transition hover:bg-white/10"
              aria-label="Volver"
            >
              <i className="fas fa-arrow-left text-sm"></i>
            </button>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-pink-400/14 bg-white/6 text-pink-200 shadow-sm">
              <i className="fas fa-house text-sm"></i>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[21px] font-black leading-tight text-white">
              {title}
            </h1>

            {subtitle ? (
              <p className="truncate text-[13px] text-pink-100/66">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}