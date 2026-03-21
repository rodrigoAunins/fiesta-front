import { getPasswordChecks } from '../utils/passwordRules';

type Props = {
  password: string;
};

export default function PasswordStrength({ password }: Props) {
  const checks = getPasswordChecks(password);

  const progress = Math.min((checks.score / 5) * 100, 100);

  const barClass =
    progress >= 80
      ? 'bg-emerald-500'
      : progress >= 60
      ? 'bg-lime-500'
      : progress >= 40
      ? 'bg-amber-400'
      : 'bg-red-400';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-800">Seguridad de la contraseña</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 border border-slate-200">
          {checks.label}
        </span>
      </div>

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-1.5 text-sm">
        <p className={checks.minLength ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
          {checks.minLength ? '✓' : '•'} Mínimo 8 caracteres
        </p>
        <p className={checks.uppercase ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
          {checks.uppercase ? '✓' : '•'} Al menos una mayúscula
        </p>
        <p className={checks.number ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
          {checks.number ? '✓' : '•'} Al menos un número
        </p>
        <p className={checks.lowercase ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
          {checks.lowercase ? '✓' : '•'} Recomendado: una minúscula
        </p>
        <p className={checks.special ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
          {checks.special ? '✓' : '•'} Recomendado: un símbolo
        </p>
      </div>

      <p className={`mt-3 text-xs font-semibold ${checks.isSafe ? 'text-emerald-700' : 'text-amber-700'}`}>
        {checks.isSafe
          ? 'La contraseña cumple con el mínimo de seguridad requerido.'
          : 'Todavía no cumple con el mínimo requerido para continuar.'}
      </p>
    </div>
  );
}