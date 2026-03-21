import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import SuperAdminGate from '../components/SuperAdminGate';
import { AuthContext } from '../context/AuthContext';
import {
  getAdminOverview,
  type AdminAlert,
  type AdminBreakdownItem,
  type AdminOverviewRange,
  type AdminOverviewResponse,
  type AdminSeriesPoint,
  type AdminTopRaffle,
  type AdminActivity,
} from '../services/admin.service';
import { clearSuperAdminSession } from '../utils/adminAccess';

const REFRESH_EVERY_MS = 15000;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function formatInt(value: number) {
  return Number(value || 0).toLocaleString('es-AR');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-AR');
}

function formatShortDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return `${date.toLocaleDateString('es-AR')} · ${date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function toneClasses(tone?: 'default' | 'blue' | 'green' | 'amber' | 'rose' | 'violet') {
  switch (tone) {
    case 'blue':
      return 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]';
    case 'green':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function buildLinePath(points: AdminSeriesPoint[], width: number, height: number, padding = 18) {
  if (!points.length) return '';
  if (points.length === 1) {
    const x = width / 2;
    const y = height / 2;
    return `M ${x} ${y}`;
  }

  const max = Math.max(...points.map((item) => item.value), 1);
  const min = Math.min(...points.map((item) => item.value), 0);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const range = Math.max(max - min, 1);

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * innerWidth;
      const y =
        padding + innerHeight - ((point.value - min) / range) * innerHeight;

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function sumPoints(points: AdminSeriesPoint[]) {
  return points.reduce((acc, item) => acc + item.value, 0);
}

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'rose' | 'violet';
}) {
  return (
    <div
      className={cx(
        'rounded-[22px] border p-4 shadow-sm lg:p-5',
        toneClasses(tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-80">
            {label}
          </p>
          <p className="mt-2 text-[28px] font-black leading-none text-slate-900 lg:text-[34px]">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white/80 text-[18px] shadow-sm">
          <i className={icon}></i>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-5 text-slate-600">{sublabel}</p>
    </div>
  );
}

function TrendChartCard({
  title,
  kicker,
  description,
  points,
  accentClass,
  accentLine,
  totalPrefix = '',
  valueFormatter,
}: {
  title: string;
  kicker: string;
  description: string;
  points: AdminSeriesPoint[];
  accentClass: string;
  accentLine: string;
  totalPrefix?: string;
  valueFormatter?: (value: number) => string;
}) {
  const width = 560;
  const height = 220;
  const path = buildLinePath(points, width, height);
  const total = sumPoints(points);
  const lastValue = points[points.length - 1]?.value || 0;
  const peak = Math.max(...points.map((item) => item.value), 0);

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {kicker}
          </p>
          <h3 className="mt-1 text-[22px] font-black leading-tight text-slate-900">
            {title}
          </h3>
          <p className="mt-1 text-[13px] leading-6 text-slate-500">{description}</p>
        </div>

        <div className={cx('rounded-[18px] border px-4 py-3 text-right shadow-sm', accentClass)}>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">
            acumulado
          </p>
          <p className="mt-1 text-[24px] font-black leading-none text-slate-900">
            {valueFormatter ? valueFormatter(total) : `${totalPrefix}${formatInt(total)}`}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] border border-slate-100 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full">
          <defs>
            <linearGradient id={`${title}-gradient`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" className={accentLine} stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={path}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray="4 6"
          />

          <path
            d={`${path} L ${width - 18} ${height - 18} L 18 ${height - 18} Z`}
            fill={`url(#${title}-gradient)`}
            opacity="1"
          />

          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className={accentLine}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {points.slice(Math.max(points.length - 8, 0)).map((point) => (
              <span
                key={`${title}-${point.label}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700"
              >
                {point.label}: {valueFormatter ? valueFormatter(point.value) : formatInt(point.value)}
              </span>
            ))}
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              último / pico
            </p>
            <p className="mt-1 text-[14px] font-black text-slate-900">
              {valueFormatter ? valueFormatter(lastValue) : formatInt(lastValue)} /{' '}
              {valueFormatter ? valueFormatter(peak) : formatInt(peak)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  kicker,
  description,
  items,
}: {
  title: string;
  kicker: string;
  description: string;
  items: AdminBreakdownItem[];
}) {
  const total = Math.max(
    items.reduce((acc, item) => acc + item.value, 0),
    1,
  );

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        {kicker}
      </p>
      <h3 className="mt-1 text-[22px] font-black leading-tight text-slate-900">
        {title}
      </h3>
      <p className="mt-1 text-[13px] leading-6 text-slate-500">{description}</p>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const percent = Math.round((item.value / total) * 100);

          return (
            <div
              key={item.label}
              className="rounded-[18px] border border-slate-200 bg-slate-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></span>
                    <p className="truncate text-[13px] font-black text-slate-900">
                      {item.label}
                    </p>
                  </div>
                  {item.helpText ? (
                    <p className="mt-1 text-[12px] text-slate-500">{item.helpText}</p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="text-[16px] font-black text-slate-900">
                    {formatInt(item.value)}
                  </p>
                  <p className="text-[11px] font-black text-slate-500">{percent}%</p>
                </div>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: item.color,
                  }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: AdminAlert[] }) {
  if (!alerts.length) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
          Alertas
        </p>
        <h3 className="mt-1 text-[22px] font-black text-slate-900">Todo estable</h3>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">
          No hay alertas para mostrar en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        Alertas
      </p>
      <h3 className="mt-1 text-[22px] font-black text-slate-900">
        Cosas para mirar de cerca
      </h3>

      <div className="mt-4 space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cx(
              'rounded-[20px] border p-4',
              alert.tone === 'amber'
                ? 'border-amber-200 bg-amber-50'
                : alert.tone === 'green'
                ? 'border-emerald-200 bg-emerald-50'
                : alert.tone === 'rose'
                ? 'border-rose-200 bg-rose-50'
                : 'border-[#bfdbfe] bg-[#eff6ff]',
            )}
          >
            <p className="text-[14px] font-black text-slate-900">{alert.title}</p>
            <p className="mt-1 text-[13px] leading-6 text-slate-700">
              {alert.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopRafflesTable({ raffles }: { raffles: AdminTopRaffle[] }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Ranking
          </p>
          <h3 className="mt-1 text-[22px] font-black text-slate-900">
            Eventos con más movimiento
          </h3>
          <p className="mt-1 text-[13px] leading-6 text-slate-500">
            Acá vas a ver rápido quién factura más, quién activó el panel y qué productores están empujando mejor.
          </p>
        </div>
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-[20px] border border-slate-200 lg:block">
        <div className="grid grid-cols-[1.5fr_1fr_.8fr_.9fr_.9fr_.8fr] bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
          <div>Evento</div>
          <div>Organizador</div>
          <div>Estado</div>
          <div>Confirmados</div>
          <div>Bruto / Neto</div>
          <div>Desbloqueo</div>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {raffles.map((raffle) => (
            <div
              key={raffle.id}
              className="grid grid-cols-[1.5fr_1fr_.8fr_.9fr_.9fr_.8fr] items-center px-4 py-3"
            >
              <div className="min-w-0 pr-3">
                <p className="truncate text-[14px] font-black text-slate-900">
                  {raffle.title}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Creado: {formatShortDateTime(raffle.createdAt)}
                </p>
              </div>

              <div className="pr-3">
                <p className="truncate text-[13px] font-bold text-slate-700">
                  {raffle.creatorName}
                </p>
              </div>

              <div className="pr-3">
                <span
                  className={cx(
                    'rounded-full px-2.5 py-1 text-[10px] font-black',
                    raffle.status === 'active'
                      ? 'border border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
                      : raffle.status === 'finished'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700',
                  )}
                >
                  {raffle.status === 'active'
                    ? 'Activa'
                    : raffle.status === 'finished'
                    ? 'Finalizada'
                    : 'Pausada'}
                </span>
              </div>

              <div className="pr-3 text-[13px] font-black text-slate-900">
                {formatInt(raffle.confirmedEntries)}
              </div>

              <div className="pr-3">
                <p className="text-[13px] font-black text-slate-900">
                  {formatMoney(raffle.grossRevenue)}
                </p>
                <p className="text-[12px] text-slate-500">
                  Neto {formatMoney(raffle.netRevenue)}
                </p>
              </div>

              <div className="pr-0">
                <span
                  className={cx(
                    'rounded-full px-2.5 py-1 text-[10px] font-black',
                    raffle.unlockPaid
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-slate-200 bg-slate-100 text-slate-600',
                  )}
                >
                  {raffle.unlockPaid
                    ? `Sí · ${formatMoney(raffle.unlockAmount)}`
                    : 'Pendiente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3 lg:hidden">
        {raffles.map((raffle) => (
          <div
            key={raffle.id}
            className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black text-slate-900">
                  {raffle.title}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">{raffle.creatorName}</p>
              </div>

              <span
                className={cx(
                  'rounded-full px-2.5 py-1 text-[10px] font-black',
                  raffle.status === 'active'
                    ? 'border border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]'
                    : raffle.status === 'finished'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700',
                )}
              >
                {raffle.status === 'active'
                  ? 'Activa'
                  : raffle.status === 'finished'
                  ? 'Finalizada'
                  : 'Pausada'}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                <p className="text-slate-500">Confirmados</p>
                <p className="mt-1 text-[16px] font-black text-slate-900">
                  {formatInt(raffle.confirmedEntries)}
                </p>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                <p className="text-slate-500">Bruto</p>
                <p className="mt-1 text-[16px] font-black text-slate-900">
                  {formatMoney(raffle.grossRevenue)}
                </p>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                <p className="text-slate-500">Neto</p>
                <p className="mt-1 text-[16px] font-black text-slate-900">
                  {formatMoney(raffle.netRevenue)}
                </p>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white p-3">
                <p className="text-slate-500">Desbloqueo</p>
                <p className="mt-1 text-[14px] font-black text-slate-900">
                  {raffle.unlockPaid ? formatMoney(raffle.unlockAmount) : 'Pendiente'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ items }: { items: AdminActivity[] }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        Actividad
      </p>
      <h3 className="mt-1 text-[22px] font-black text-slate-900">
        Movimiento reciente
      </h3>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[18px] border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-start gap-3">
              <div
                className={cx(
                  'mt-1 h-3 w-3 rounded-full',
                  item.tone === 'green'
                    ? 'bg-emerald-500'
                    : item.tone === 'amber'
                    ? 'bg-amber-500'
                    : item.tone === 'rose'
                    ? 'bg-rose-500'
                    : 'bg-[#3483fa]',
                )}
              ></div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-black text-slate-900">{item.title}</p>
                  <span className="text-[11px] font-black text-slate-500">
                    {formatShortDateTime(item.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-slate-600">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminDashboardContent() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) as any;

  const [range, setRange] = useState<AdminOverviewRange>('30d');
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage('');
        const response = await getAdminOverview(range);
        setData(response);
      } catch (error: any) {
        console.error('Error cargando admin overview', error);
        setErrorMessage(
          error?.response?.data?.message ||
            'No pudimos cargar el panel maestro.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range],
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => {
      loadData(true);
    }, REFRESH_EVERY_MS);

    return () => window.clearInterval(interval);
  }, [autoRefresh, loadData]);

  const unlockConversion = useMemo(() => {
    if (!data) return 0;
    const base = Math.max(data.summary.totalUnlockableRaffles, 1);
    return Math.round((data.summary.paidUnlocks / base) * 100);
  }, [data]);

  const checkinRate = useMemo(() => {
    if (!data) return 0;
    const base = Math.max(data.summary.confirmedPeople, 1);
    return Math.round((data.summary.checkedInPeople / base) * 100);
  }, [data]);

  const topRaffles = data?.topRaffles || [];
  const alerts = data?.alerts || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <>
      <main className="page-fade min-h-screen bg-slate-50 px-3 pb-24 pt-2 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <AppHeader
            title="Panel maestro"
            subtitle="Vista global de negocio, rendimiento y monetización"
            showBack
            onBack={() => navigate('/')}
            rightSlot={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoRefresh((prev) => !prev)}
                  className={cx(
                    'flex h-10 min-w-[42px] items-center justify-center rounded-[18px] border px-3 text-[12px] font-black shadow-sm transition',
                    autoRefresh
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                  title="Auto refresh"
                >
                  <i className={cx('fas', autoRefresh ? 'fa-bolt' : 'fa-pause')}></i>
                </button>

                <button
                  type="button"
                  onClick={() => loadData(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-slate-200 bg-white text-[#3483fa] shadow-sm transition hover:bg-slate-50"
                  title="Actualizar"
                >
                  <i
                    className={cx(
                      'fas fa-rotate-right text-[14px]',
                      refreshing && 'animate-spin',
                    )}
                  ></i>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearSuperAdminSession();
                    navigate('/');
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                  title="Cerrar panel"
                >
                  <i className="fas fa-lock text-[14px]"></i>
                </button>
              </div>
            }
          />

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_380px]">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
              <div className="bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_30%),linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] px-5 py-5 text-white lg:px-6 lg:py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                      Vista privada
                    </p>
                    <h2 className="mt-1 text-[24px] font-black leading-[1.02] lg:text-[34px]">
                      Todo el negocio
                      <br className="hidden lg:block" />
                      en un solo lugar
                    </h2>
                    <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-300 lg:text-[14px]">
                      Acá vas a poder mirar en tiempo real cuánta gente se registró, cuántos eventos se crearon, cuántos pagaron desbloqueo, cuánto facturan los organizadores y cuánto te queda a vos.
                    </p>
                  </div>

                  <div className="rounded-[18px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                      Sesión
                    </p>
                    <p className="mt-1 text-[14px] font-black text-white">
                      {user?.email || 'Superadmin'}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-300">
                      Refresco cada {REFRESH_EVERY_MS / 1000}s
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-4 lg:gap-4 lg:p-5">
                {loading && !data ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[148px] animate-pulse rounded-[22px] border border-slate-200 bg-slate-100"
                    ></div>
                  ))
                ) : (
                  <>
                    <KpiCard
                      label="Personas registradas"
                      value={formatInt(data?.summary.registeredPeople || 0)}
                      sublabel={`Hoy entraron ${formatInt(data?.summary.todayRegistrations || 0)} registros nuevos.`}
                      icon="fas fa-users"
                      tone="blue"
                    />
                    <KpiCard
                      label="Confirmadas"
                      value={formatInt(data?.summary.confirmedPeople || 0)}
                      sublabel={`${checkinRate}% de las confirmadas ya terminaron chequeadas en puerta.`}
                      icon="fas fa-check-circle"
                      tone="green"
                    />
                    <KpiCard
                      label="Rifas / eventos"
                      value={formatInt(data?.summary.totalRaffles || 0)}
                      sublabel={`${formatInt(data?.summary.activeRaffles || 0)} activas y ${formatInt(data?.summary.finishedRaffles || 0)} finalizadas.`}
                      icon="fas fa-ticket-alt"
                      tone="violet"
                    />
                    <KpiCard
                      label="Desbloqueos pagos"
                      value={formatInt(data?.summary.paidUnlocks || 0)}
                      sublabel={`${unlockConversion}% de conversión sobre eventos desbloqueables.`}
                      icon="fas fa-unlock"
                      tone="amber"
                    />
                    <KpiCard
                      label="Plata organizadores"
                      value={formatMoney(data?.summary.organizerGrossRevenue || 0)}
                      sublabel={`Estimado bruto global. Neto organizadores: ${formatMoney(data?.summary.organizerNetRevenue || 0)}.`}
                      icon="fas fa-sack-dollar"
                      tone="green"
                    />
                    <KpiCard
                      label="Ingresos plataforma"
                      value={formatMoney(data?.summary.platformRevenue || 0)}
                      sublabel={`Hoy tu monetización está viniendo del desbloqueo: ${formatMoney(data?.summary.unlockRevenue || 0)}.`}
                      icon="fas fa-wallet"
                      tone="blue"
                    />
                    <KpiCard
                      label="Organizadores activos"
                      value={formatInt(data?.summary.activeCreators || 0)}
                      sublabel={`${formatInt(data?.summary.totalCreators || 0)} organizadores tocaron la plataforma en el período.`}
                      icon="fas fa-user-tie"
                      tone="default"
                    />
                    <KpiCard
                      label="Comprobantes pendientes"
                      value={formatInt(data?.summary.pendingProofs || 0)}
                      sublabel="Te marca dónde puede haber fricción operativa o validación lenta."
                      icon="fas fa-hourglass-half"
                      tone="rose"
                    />
                  </>
                )}
              </div>
            </section>

            <div className="space-y-4">
              {data?.meta?.isMock ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
                    Modo preview
                  </p>
                  <p className="mt-1 text-[15px] font-black text-slate-900">
                    Estás viendo datos mock
                  </p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-700">
                    El front ya está listo. Cuando armemos el back, esta misma UI va a empezar a consumir datos reales.
                  </p>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 shadow-sm">
                  <p className="text-[14px] font-black text-rose-900">No pudimos actualizar</p>
                  <p className="mt-1 text-[13px] leading-6 text-rose-800">{errorMessage}</p>
                </div>
              ) : null}

              <AlertsPanel alerts={alerts} />

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Filtros
                </p>
                <h3 className="mt-1 text-[22px] font-black text-slate-900">
                  Ventana de análisis
                </h3>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(['7d', '30d', '90d'] as AdminOverviewRange[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setRange(item)}
                      className={cx(
                        'rounded-[16px] px-4 py-3 text-[13px] font-black transition',
                        range === item
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Última actualización
                  </p>
                  <p className="mt-1 text-[14px] font-black text-slate-900">
                    {formatDateTime(data?.meta?.generatedAt)}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Auto refresh: {autoRefresh ? 'activado' : 'pausado'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!loading || data ? (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <TrendChartCard
                kicker="Tendencia"
                title="Registros por día"
                description="Mide la atracción general de la plataforma y te deja detectar picos de adquisición."
                points={data?.charts.registrationsByDay || []}
                accentClass="border-[#bfdbfe] bg-[#eff6ff]"
                accentLine="text-[#2563eb]"
              />

              <TrendChartCard
                kicker="Caja"
                title="Facturación bruta por día"
                description="Movimiento económico estimado generado por los organizadores dentro del período."
                points={data?.charts.revenueByDay || []}
                accentClass="border-emerald-200 bg-emerald-50"
                accentLine="text-emerald-500"
                valueFormatter={formatMoney}
              />

              <BreakdownCard
                kicker="Distribución"
                title="Estados de eventos"
                description="Sirve para entender si predominan eventos activos, finalizados o monetizados."
                items={data?.charts.raffleStatusBreakdown || []}
              />

              <BreakdownCard
                kicker="Cobro"
                title="Métodos de pago"
                description="Después esto te sirve para decidir prioridades de UX, validación y automatizaciones."
                items={data?.charts.paymentMethodBreakdown || []}
              />
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_380px]">
            <TopRafflesTable raffles={topRaffles} />
            <ActivityFeed items={recentActivity} />
          </div>
        </div>
      </main>

      <div className="block lg:hidden">
        <BottomNav
          items={[
            {
              label: 'Inicio',
              icon: 'fa-home',
              to: '/',
            },
            {
              label: 'Refrescar',
              icon: 'fa-rotate-right',
              onClick: () => loadData(true),
            },
            {
              label: autoRefresh ? 'Auto on' : 'Auto off',
              icon: autoRefresh ? 'fa-bolt' : 'fa-pause',
              onClick: () => setAutoRefresh((prev) => !prev),
            },
            {
              label: 'Cerrar',
              icon: 'fa-lock',
              onClick: () => {
                clearSuperAdminSession();
                navigate('/');
              },
            },
          ]}
        />
      </div>

      <AppFooter />
    </>
  );
}

export default function AdminDashboard() {
  return (
    <SuperAdminGate>
      <AdminDashboardContent />
    </SuperAdminGate>
  );
}