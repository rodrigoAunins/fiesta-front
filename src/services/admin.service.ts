import api from '../api/axios';

export type AdminOverviewRange = '7d' | '30d' | '90d';

export type AdminSeriesPoint = {
  label: string;
  value: number;
};

export type AdminBreakdownItem = {
  label: string;
  value: number;
  color: string;
  helpText?: string;
};

export type AdminAlertTone = 'blue' | 'green' | 'amber' | 'rose';

export type AdminAlert = {
  id: string;
  title: string;
  description: string;
  tone: AdminAlertTone;
};

export type AdminTopRaffle = {
  id: string;
  title: string;
  creatorName: string;
  status: 'active' | 'finished' | 'paused';
  createdAt: string;
  confirmedEntries: number;
  grossRevenue: number;
  netRevenue: number;
  unlockPaid: boolean;
  unlockAmount: number;
};

export type AdminActivity = {
  id: string;
  type:
    | 'raffle_created'
    | 'unlock_paid'
    | 'purchase_confirmed'
    | 'purchase_pending'
    | 'raffle_finished';
  title: string;
  description: string;
  createdAt: string;
  tone: AdminAlertTone;
};

export type AdminOverviewResponse = {
  meta: {
    range: AdminOverviewRange;
    generatedAt: string;
    isMock: boolean;
  };
  summary: {
    registeredPeople: number;
    confirmedPeople: number;
    checkedInPeople: number;
    totalRaffles: number;
    activeRaffles: number;
    finishedRaffles: number;
    totalCreators: number;
    activeCreators: number;
    paidUnlocks: number;
    totalUnlockableRaffles: number;
    unlockRevenue: number;
    organizerGrossRevenue: number;
    organizerNetRevenue: number;
    platformRevenue: number;
    pendingProofs: number;
    todayRegistrations: number;
  };
  charts: {
    registrationsByDay: AdminSeriesPoint[];
    revenueByDay: AdminSeriesPoint[];
    unlocksByDay: AdminSeriesPoint[];
    raffleStatusBreakdown: AdminBreakdownItem[];
    paymentMethodBreakdown: AdminBreakdownItem[];
  };
  topRaffles: AdminTopRaffle[];
  recentActivity: AdminActivity[];
  alerts: AdminAlert[];
};

const ENABLE_ADMIN_MOCK =
  String(import.meta.env.VITE_ENABLE_ADMIN_MOCK || '').toLowerCase() === 'true';

const RANGE_TO_DAYS: Record<AdminOverviewRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatShortDate(date: Date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function createSeries(days: number, min: number, max: number, trend = 0) {
  const points: AdminSeriesPoint[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const random = Math.random();
    const wave = Math.sin(i / 3.2) * 0.35;
    const drift = trend * ((days - i) / Math.max(days, 1));
    const normalized = Math.max(
      0,
      Math.min(1, random * 0.55 + 0.45 + wave + drift),
    );
    const value = Math.round(min + (max - min) * normalized);

    points.push({
      label: formatShortDate(date),
      value,
    });
  }

  return points;
}

function sumSeries(points: AdminSeriesPoint[]) {
  return points.reduce((acc, item) => acc + item.value, 0);
}

function buildMockOverview(range: AdminOverviewRange): AdminOverviewResponse {
  const days = RANGE_TO_DAYS[range];
  const registrationsByDay = createSeries(days, 6, 58, 0.18);
  const unlocksByDay = createSeries(days, 0, 5, 0.08);
  const revenueByDay = registrationsByDay.map((item, index) => ({
    label: item.label,
    value: item.value * 4200 + unlocksByDay[index].value * 12500,
  }));

  const registeredPeople = sumSeries(registrationsByDay);
  const confirmedPeople = Math.round(registeredPeople * 0.71);
  const checkedInPeople = Math.round(confirmedPeople * 0.62);

  const totalRaffles = Math.max(18, Math.round(days * 1.8));
  const activeRaffles = Math.round(totalRaffles * 0.68);
  const finishedRaffles = totalRaffles - activeRaffles;
  const totalCreators = Math.max(10, Math.round(totalRaffles * 0.45));
  const activeCreators = Math.max(7, Math.round(totalCreators * 0.78));
  const paidUnlocks = sumSeries(unlocksByDay);
  const totalUnlockableRaffles = Math.max(
    paidUnlocks + 6,
    Math.round(totalRaffles * 0.75),
  );
  const unlockRevenue = paidUnlocks * 12500;
  const organizerGrossRevenue = sumSeries(revenueByDay) + registeredPeople * 2800;
  const organizerNetRevenue = Math.round(organizerGrossRevenue * 0.92);
  const platformRevenue = unlockRevenue;
  const pendingProofs = Math.round(registeredPeople * 0.11);
  const todayRegistrations =
    registrationsByDay[registrationsByDay.length - 1]?.value || 0;

  const topRaffles: AdminTopRaffle[] = Array.from({ length: 8 }).map(
    (_, index) => {
      const grossRevenue =
        80000 + index * 74000 + Math.round(Math.random() * 120000);
      const netRevenue = Math.round(grossRevenue * 0.93);

      return {
        id: `mock-raffle-${index + 1}`,
        title: [
          'Fiesta Neon',
          'After Retro',
          'Rifa Solidaria Norte',
          'Sunset Garden',
          'Electro Club Night',
          'Cena Show Beneficio',
          'Pool Party Premium',
          'Noche Universitaria',
        ][index],
        creatorName: [
          'Martina Ruiz',
          'Franco Gómez',
          'Club Tuc',
          'Eventos Norte',
          'High Vibes',
          'Fundación Sur',
          'Mi Fiesta Studio',
          'Río Producciones',
        ][index],
        status: index % 3 === 0 ? 'finished' : 'active',
        createdAt: new Date(
          Date.now() - (index + 1) * 86400000 * 2,
        ).toISOString(),
        confirmedEntries: 90 + index * 23 + Math.round(Math.random() * 40),
        grossRevenue,
        netRevenue,
        unlockPaid: index < paidUnlocks,
        unlockAmount: index < paidUnlocks ? 12500 : 0,
      };
    },
  );

  const recentActivity: AdminActivity[] = [
    {
      id: 'a1',
      type: 'unlock_paid',
      title: 'Desbloqueo abonado',
      description: 'Fiesta Neon pagó su activación y quedó operando sin límites.',
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      tone: 'green',
    },
    {
      id: 'a2',
      type: 'purchase_confirmed',
      title: 'Nuevo pico de confirmaciones',
      description: 'Se aprobaron 14 comprobantes en los últimos 20 minutos.',
      createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
      tone: 'blue',
    },
    {
      id: 'a3',
      type: 'purchase_pending',
      title: 'Pagos pendientes creciendo',
      description:
        'Hay 9 comprobantes esperando revisión en eventos activos.',
      createdAt: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
      tone: 'amber',
    },
    {
      id: 'a4',
      type: 'raffle_created',
      title: 'Nuevo evento publicado',
      description: '“Sunset Garden” se creó hace pocos minutos.',
      createdAt: new Date(Date.now() - 1000 * 60 * 57).toISOString(),
      tone: 'blue',
    },
    {
      id: 'a5',
      type: 'raffle_finished',
      title: 'Evento cerrado',
      description: '“Rifa Solidaria Norte” ya finalizó y quedó en histórico.',
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      tone: 'rose',
    },
  ];

  const alerts: AdminAlert[] = [
    {
      id: 'alert-1',
      title: 'Hay eventos con comprobantes acumulados',
      description: `${pendingProofs} comprobantes siguen pendientes. Eso te sirve para detectar organizadores que están vendiendo pero todavía no procesan a tiempo.`,
      tone: 'amber',
    },
    {
      id: 'alert-2',
      title: 'Buen ritmo de activaciones',
      description: `${paidUnlocks} desbloqueos pagos en el período. La conversión sobre eventos desbloqueables va en buen nivel.`,
      tone: 'green',
    },
    {
      id: 'alert-3',
      title: 'Ingresos de plataforma concentrados',
      description:
        'Tus ingresos dependen casi por completo de activaciones. Después podemos sumar comisiones, suscripciones o upsells.',
      tone: 'blue',
    },
  ];

  return {
    meta: {
      range,
      generatedAt: new Date().toISOString(),
      isMock: true,
    },
    summary: {
      registeredPeople,
      confirmedPeople,
      checkedInPeople,
      totalRaffles,
      activeRaffles,
      finishedRaffles,
      totalCreators,
      activeCreators,
      paidUnlocks,
      totalUnlockableRaffles,
      unlockRevenue,
      organizerGrossRevenue,
      organizerNetRevenue,
      platformRevenue,
      pendingProofs,
      todayRegistrations,
    },
    charts: {
      registrationsByDay,
      revenueByDay,
      unlocksByDay,
      raffleStatusBreakdown: [
        {
          label: 'Activas',
          value: activeRaffles,
          color: '#2563eb',
          helpText: 'Siguen vendiendo',
        },
        {
          label: 'Finalizadas',
          value: finishedRaffles,
          color: '#16a34a',
          helpText: 'Ya cerradas',
        },
        {
          label: 'Con desbloqueo pago',
          value: paidUnlocks,
          color: '#7c3aed',
          helpText: 'Ya monetizaron',
        },
      ],
      paymentMethodBreakdown: [
        {
          label: 'Transferencia',
          value: Math.round(confirmedPeople * 0.58),
          color: '#2563eb',
        },
        {
          label: 'Efectivo',
          value: Math.round(confirmedPeople * 0.27),
          color: '#f59e0b',
        },
        {
          label: 'Gratis',
          value: Math.round(confirmedPeople * 0.15),
          color: '#16a34a',
        },
      ],
    },
    topRaffles,
    recentActivity,
    alerts,
  };
}

function shouldFallbackToMock() {
  return ENABLE_ADMIN_MOCK;
}

export async function getAdminOverview(
  range: AdminOverviewRange,
): Promise<AdminOverviewResponse> {
  try {
    const response = await api.get('/admin/overview', {
      params: { range },
    });

    const payload = response.data || {};

    return {
      ...payload,
      meta: {
        range:
          payload?.meta?.range && ['7d', '30d', '90d'].includes(payload.meta.range)
            ? payload.meta.range
            : range,
        generatedAt:
          payload?.meta?.generatedAt || new Date().toISOString(),
        isMock: Boolean(payload?.meta?.isMock),
      },
    };
  } catch (error) {
    if (!shouldFallbackToMock()) {
      throw error;
    }

    await sleep(250);
    return buildMockOverview(range);
  }
}