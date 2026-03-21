type Size = 'sm' | 'md';

export function SecureLockBadge({ size = 'md' }: { size?: Size }) {
  const box =
    size === 'sm'
      ? 'h-10 w-10 rounded-2xl text-base'
      : 'h-12 w-12 rounded-2xl text-lg';

  return (
    <div
      className={`flex ${box} items-center justify-center bg-[#e8fff2] text-[#00a650] shadow-sm`}
    >
      <i className="fas fa-lock"></i>
    </div>
  );
}

export function MercadoPagoBadge({ size = 'md' }: { size?: Size }) {
  const circle = size === 'sm' ? 'h-10 w-10 text-[11px]' : 'h-12 w-12 text-xs';

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex ${circle} items-center justify-center rounded-full bg-[#009ee3] font-black text-white shadow-sm`}
      >
        MP
      </div>

      <div className="leading-tight">
        <p className="text-sm font-black text-slate-900">Mercado Pago</p>
        <p className="text-xs text-slate-500">Cobrá de forma segura</p>
      </div>
    </div>
  );
}

export function MercadoPagoMiniIcon() {
  return (
    <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-[#009ee3] px-2 text-[10px] font-black text-white">
      MP
    </span>
  );
}