import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

type NavItem = {
  label: string;
  icon: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
};

export default function BottomNav({ items }: { items: NavItem[] }) {
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: 18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed inset-x-0 bottom-0 z-50"
    >
      <div className="mx-auto w-full max-w-[560px] px-3">
        <div className="rounded-t-[24px] border border-b-0 border-pink-400/12 bg-[#140717]/94 px-2.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-12px_28px_rgba(10,3,17,0.22)] backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-current={item.active ? 'page' : undefined}
                onClick={() => {
                  if (item.onClick) return item.onClick();
                  if (item.to) return navigate(item.to);
                }}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 transition ${
                  item.active
                    ? 'bg-[linear-gradient(135deg,rgba(251,113,133,.18),rgba(139,92,246,.18))] text-pink-50 shadow-[0_8px_20px_rgba(236,72,153,0.16)]'
                    : 'text-pink-100/58 hover:bg-white/[0.05]'
                }`}
              >
                <i
                  className={`${
                    item.icon.includes('fab') ? item.icon : `fas ${item.icon}`
                  } text-[15px]`}
                ></i>

                <span className="text-[10px] font-bold leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}