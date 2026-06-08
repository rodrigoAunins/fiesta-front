import { useEffect, useState, useContext, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import AppFooter from '../components/AppFooter';
import { openHelpModal, promptAppShare } from '../utils/ux';

const LANDING_PATH = import.meta.env.VITE_LANDING_PATH || '/';
const WORKSPACE_STORAGE_KEY = 'rt_event_workspace_v2';
const WORKSPACE_STORAGE_PREFIX = `${WORKSPACE_STORAGE_KEY}:`;

const REVIEWABLE_PURCHASE_STATUSES = [
  'under_review',
  'pending_cash_confirmation',
  'reserved',
];

type EventOperationSummary = {
  reviewable: number;
  readyForDoor: number;
  checkedIn: number;
};

function toMoney(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Fecha no disponible';
  return new Date(value).toLocaleString('es-AR');
}

function getPaymentMethodsLabel(event: any) {
  const methods = [
    event?.allowTransfer ? 'Transferencia' : null,
    event?.allowCash ? 'Efectivo' : null,
  ].filter(Boolean);

  return methods.length ? methods.join(' / ') : 'Sin configurar';
}

function getEventCounts(event: any) {
  if (event.isWorkspaceDraft && event._workspaceStats) {
    const { sold, pending, total } = event._workspaceStats;
    return {
      sold,
      pending,
      total,
      progress: total > 0 ? Math.round((sold / total) * 100) : 0,
    };
  }

  const tickets = Array.isArray(event?.tickets) ? event.tickets : [];

  const sold = tickets.filter((t: any) => t.status === 'sold').length;
  const pending = tickets.filter((t: any) => t.status === 'pending').length;
  const total =
    tickets.length ||
    Number(event?.totalNumbers || 0) ||
    Number(event?.maxCapacity || 0) ||
    Number(event?.capacity || 0);

  return {
    sold,
    pending,
    total,
    progress: total > 0 ? Math.round((sold / total) * 100) : 0,
  };
}

function getLocalWorkspaceEventsForUser(user: any) {
  if (typeof window === 'undefined' || !user?.id) return [];

  const userDraftPrefix = `${WORKSPACE_STORAGE_PREFIX}draft-${user.id}-`;
  const results: any[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(userDraftPrefix)) continue;

      const workspaceId = key.slice(WORKSPACE_STORAGE_PREFIX.length);
      const raw = window.localStorage.getItem(key);
      const state = raw ? JSON.parse(raw) : {};
      const eventInfo = state?.eventInfo || {};
      const guests = Array.isArray(state?.guests) ? state.guests : [];
      const layout = Array.isArray(state?.layout) ? state.layout : [];
      const capacity = guests.length || layout.length || 1;

      const confirmedGuests = guests.filter((g: any) => g.status === 'confirmed' || g.status === 'present').length;
      const pendingGuests = guests.filter((g: any) => g.status === 'pending').length;

      results.push({
        id: workspaceId,
        title: eventInfo.name || 'Mi evento',
        description: eventInfo.type || 'Evento asignado',
        status: 'active',
        drawDate: eventInfo.date || null,
        eventEndAt: eventInfo.date || null,
        venueName: eventInfo.venue || 'Lugar pendiente',
        venueAddress: eventInfo.venue || '',
        totalNumbers: capacity,
        maxCapacity: capacity,
        ticketPrice: 0,
        allowTransfer: false,
        allowCash: false,
        tickets: [],
        isWorkspaceDraft: true,
        _workspaceStats: {
          sold: confirmedGuests,
          pending: pendingGuests,
          total: capacity,
        },
      });
    }
  } catch (error) {
    console.error('Error leyendo eventos locales del workspace:', error);
  }

  return results;
}

function mergeEvents(remoteEvents: any[], localEvents: any[]) {
  const seen = new Set<string>();

  return [...remoteEvents, ...localEvents].filter((event) => {
    const id = String(event?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getReviewableOperationsCount(purchases: any[] = []) {
  return purchases.filter((purchase: any) =>
    REVIEWABLE_PURCHASE_STATUSES.includes(String(purchase?.status || '')),
  ).length;
}

function getReadyForDoorCount(purchases: any[] = []) {
  return purchases.filter((purchase: any) =>
    ['approved', 'auto_approved'].includes(String(purchase?.status || '')),
  ).length;
}

function getCheckedInCount(purchases: any[] = []) {
  return purchases.filter(
    (purchase: any) => String(purchase?.status || '') === 'checked_in',
  ).length;
}

function getDashboardPath(role: string, eventId: string | number) {
  const normalizedRole = String(role || '').toLowerCase();

  if (normalizedRole === 'creator' || normalizedRole === 'organizer') {
    return `/dashboard/${eventId}`;
  }

  if (normalizedRole === 'guest') {
    return `/workspace/${eventId}`;
  }

  if (
    normalizedRole === 'door' ||
    normalizedRole === 'door_staff' ||
    normalizedRole === 'access' ||
    normalizedRole === 'access_staff'
  ) {
    return `/dashboard/${eventId}/door`;
  }

  return `/seller-dashboard/${eventId}`;
}

// Nueva función que reemplaza a isEventOperationBlocked
function getUnlockState(event: any) {
  if (event?.status === 'finished') return 'ok';
  if (event?.unlock?.unlocked) return 'ok';

  const tickets = Array.isArray(event?.tickets) ? event.tickets : [];
  const occupiedTickets = tickets.filter(
    (t: any) => t.status === 'sold' || t.status === 'pending'
  ).length;

  return occupiedTickets >= 20 ? 'blocked' : 'warning';
}

function getEventUrgencyScore(
  event: any,
  role: string,
  summary: EventOperationSummary,
) {
  const normalizedRole = String(role || '').toLowerCase();
  const { pending, sold } = getEventCounts(event);
  const unlockState = getUnlockState(event);
  const active = event?.status !== 'finished';

  let score = 0;

  if (active) score += 10;

  if (normalizedRole === 'creator') {
    if (unlockState === 'blocked') score += 30;
    if (summary.reviewable > 0) score += 50;
    if (unlockState === 'warning') score += 5; // Prioridad leve para el aviso preventivo
    if (sold > 0) score += 8;
  } else if (
    normalizedRole === 'door' ||
    normalizedRole === 'door_staff' ||
    normalizedRole === 'access' ||
    normalizedRole === 'access_staff'
  ) {
    if (summary.readyForDoor > 0) score += 60;
    if (summary.checkedIn > 0) score += 15;
  } else {
    if (pending > 0) score += 35;
    if (sold > 0) score += 10;
  }

  return score;
}

function isAbortLikeError(error: any) {
  const message = String(
    error?.message || error?.response?.data?.message || '',
  ).toLowerCase();

  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    message.includes('aborted') ||
    message.includes('canceled') ||
    message.includes('cancelled')
  );
}

function SummaryCard({
  label,
  value,
  hint,
  valueClassName = 'text-white',
}: {
  label: string;
  value: string | number;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[22px] border border-pink-300/12 bg-white/[0.045] p-4 shadow-[0_18px_34px_rgba(10,3,17,.18)] backdrop-blur">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-pink-100/50">
        {label}
      </p>
      <p className={`mt-2 text-[28px] font-black leading-none ${valueClassName}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[13px] leading-relaxed text-pink-100/58">{hint}</p>
      ) : null}
    </div>
  );
}

function getPriorityToneClasses(tone: 'blue' | 'amber' | 'emerald' | 'rose') {
  if (tone === 'amber') {
    return {
      wrapper: 'border-amber-300/24 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,.22),transparent_34%),rgba(255,255,255,.055)]',
      icon: 'bg-amber-300/16 text-amber-200',
      button: 'bg-amber-500 hover:bg-amber-400',
      eyebrow: 'text-amber-200',
    };
  }

  if (tone === 'emerald') {
    return {
      wrapper: 'border-emerald-300/24 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.20),transparent_34%),rgba(255,255,255,.055)]',
      icon: 'bg-emerald-300/16 text-emerald-200',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      eyebrow: 'text-emerald-200',
    };
  }

  if (tone === 'rose') {
    return {
      wrapper: 'border-rose-300/24 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,.22),transparent_34%),rgba(255,255,255,.055)]',
      icon: 'bg-rose-300/16 text-rose-200',
      button: 'bg-rose-500 hover:bg-rose-400',
      eyebrow: 'text-rose-200',
    };
  }

  return {
    wrapper: 'border-pink-300/16 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,.18),transparent_38%),rgba(255,255,255,.055)]',
    icon: 'bg-pink-300/14 text-pink-100',
    button: 'bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] hover:brightness-110',
    eyebrow: 'text-pink-200',
  };
}

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [operationSummaryByEvent, setOperationSummaryByEvent] = useState<
    Record<string, EventOperationSummary>
  >({});
  const [loadingOperationSummaries, setLoadingOperationSummaries] =
    useState(false);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const role = String(user?.role || '').toLowerCase();
  const isCreator = role === 'creator' || role === 'organizer';
  const isGuestOwner = role === 'guest';
  const isDoorRole =
    role === 'door' ||
    role === 'door_staff' ||
    role === 'access' ||
    role === 'access_staff';
  const isSeller = role === 'seller';

  const firstName = useMemo(() => {
    const source =
      user?.firstName ||
      user?.fullName?.split(' ')?.[0] ||
      user?.email?.split('@')?.[0] ||
      'Usuario';

    return source.trim().split(' ')[0];
  }, [user]);

  const loadedOperationSummaryIds = useMemo(
    () => new Set(Object.keys(operationSummaryByEvent)),
    [operationSummaryByEvent],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }, 60);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) return;

    setEvents([]);
    setOperationSummaryByEvent({});
    setLoadingOperationSummaries(false);
    navigate(LANDING_PATH, { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    api
      .get('/raffles/my-raffles', {
        signal: controller.signal,
      })
      .then((res) => {
        if (cancelled) return;
        const remoteEvents = Array.isArray(res.data) ? res.data : [];
        const localEvents = (role === 'creator' || role === 'master') ? getLocalWorkspaceEventsForUser(user) : [];
        setEvents(mergeEvents(remoteEvents, localEvents));
      })
      .catch((err) => {
        if (cancelled || isAbortLikeError(err)) return;
        console.error('Error cargando eventos:', err);
        setEvents((role === 'creator' || role === 'master') ? getLocalWorkspaceEventsForUser(user) : []);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user, role]);

  useEffect(() => {
    if (!user || (!isCreator && !isDoorRole) || events.length === 0) {
      setOperationSummaryByEvent({});
      setLoadingOperationSummaries(false);
      return;
    }

    let cancelled = false;
    const controllers: AbortController[] = [];

    setLoadingOperationSummaries(true);
    setOperationSummaryByEvent({});

    const loadOperationSummaries = async () => {
      await Promise.allSettled(
        events.map(async (event) => {
          const eventId = String(event.id);
          const controller = new AbortController();
          controllers.push(controller);

          try {
            const res = await api.get(`/raffle-purchases/raffle/${event.id}`, {
              signal: controller.signal,
              timeout: 15000,
            });

            const purchases = Array.isArray(res.data) ? res.data : [];
            const summary: EventOperationSummary = {
              reviewable: getReviewableOperationsCount(purchases),
              readyForDoor: getReadyForDoorCount(purchases),
              checkedIn: getCheckedInCount(purchases),
            };

            if (cancelled) return;

            setOperationSummaryByEvent((prev) => ({
              ...prev,
              [eventId]: summary,
            }));
          } catch (error: any) {
            if (cancelled || isAbortLikeError(error)) return;

            console.error(
              `Error cargando operaciones del evento ${event.id}:`,
              error,
            );

            setOperationSummaryByEvent((prev) => ({
              ...prev,
              [eventId]: {
                reviewable: 0,
                readyForDoor: 0,
                checkedIn: 0,
              },
            }));
          }
        }),
      );

      if (!cancelled) {
        setLoadingOperationSummaries(false);
      }
    };

    loadOperationSummaries();

    return () => {
      cancelled = true;
      controllers.forEach((controller) => controller.abort());
    };
  }, [user, isCreator, isDoorRole, events]);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      promptAppShare('home', window.location.origin);
    }, 22000);

    return () => clearTimeout(timer);
  }, [user]);

  const eventsSorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const aSummary =
        operationSummaryByEvent[String(a.id)] || {
          reviewable: 0,
          readyForDoor: 0,
          checkedIn: 0,
        };

      const bSummary =
        operationSummaryByEvent[String(b.id)] || {
          reviewable: 0,
          readyForDoor: 0,
          checkedIn: 0,
        };

      const aScore = getEventUrgencyScore(a, role, aSummary);
      const bScore = getEventUrgencyScore(b, role, bSummary);

      const diff = bScore - aScore;
      if (diff !== 0) return diff;

      const aDate = new Date(a?.drawDate || a?.eventDate || 0).getTime();
      const bDate = new Date(b?.drawDate || b?.eventDate || 0).getTime();
      return aDate - bDate;
    });
  }, [events, operationSummaryByEvent, role]);

  const activeCount = events.filter((event) => event.status !== 'finished').length;

  const totalConfirmedCount = events.reduce((acc, event) => {
    return acc + getEventCounts(event).sold;
  }, 0);

  const totalReviewableCount = useMemo(() => {
    if (!isCreator) return 0;

    return events.reduce((acc, event) => {
      return acc + (operationSummaryByEvent[String(event.id)]?.reviewable || 0);
    }, 0);
  }, [isCreator, events, operationSummaryByEvent]);

  const totalDoorReadyCount = useMemo(() => {
    if (!isDoorRole) return 0;

    return events.reduce((acc, event) => {
      return acc + (operationSummaryByEvent[String(event.id)]?.readyForDoor || 0);
    }, 0);
  }, [isDoorRole, events, operationSummaryByEvent]);

  const totalDoorCheckedInCount = useMemo(() => {
    if (!isDoorRole) return 0;

    return events.reduce((acc, event) => {
      return acc + (operationSummaryByEvent[String(event.id)]?.checkedIn || 0);
    }, 0);
  }, [isDoorRole, events, operationSummaryByEvent]);

  const totalSellerPendingCount = useMemo(() => {
    if (!isSeller) return 0;
    return events.reduce((acc, event) => acc + getEventCounts(event).pending, 0);
  }, [isSeller, events]);

  const totalPendingCount = useMemo(() => {
    return events.reduce((acc, event) => acc + getEventCounts(event).pending, 0);
  }, [events]);

  const blockedEvents = eventsSorted.filter((e) => getUnlockState(e) === 'blocked');
  const warningEvents = eventsSorted.filter((e) => getUnlockState(e) === 'warning');
  const firstBlockedEvent = blockedEvents[0];
  const firstWarningEvent = warningEvents[0];

  const firstEventWithReviewable = eventsSorted.find((event) => {
    return (
      event.status !== 'finished' &&
      (operationSummaryByEvent[String(event.id)]?.reviewable || 0) > 0
    );
  });

  const firstEventWithDoorReady = eventsSorted.find((event) => {
    return (
      event.status !== 'finished' &&
      (operationSummaryByEvent[String(event.id)]?.readyForDoor || 0) > 0
    );
  });

  const firstActiveEvent = eventsSorted.find((event) => event.status !== 'finished');
  const firstEvent = eventsSorted[0];

  const allOperationSummariesLoaded = useMemo(() => {
    if (!isCreator && !isDoorRole) return true;
    if (events.length === 0) return true;

    return events.every((event) =>
      loadedOperationSummaryIds.has(String(event.id)),
    );
  }, [isCreator, isDoorRole, events, loadedOperationSummaryIds]);

  const priorityCard = useMemo(() => {
    if (isCreator) {
      if (totalReviewableCount > 0 && firstEventWithReviewable) {
        return {
          tone: 'amber' as const,
          eyebrow: 'Pagos por revisar',
          title: `${totalReviewableCount} operación${
            totalReviewableCount !== 1 ? 'es' : ''
          } esperando tu OK`,
          text: 'Tenés transferencias o pagos esperando confirmación. Aprobálos para liberar esas entradas.',
          cta: 'Ir a revisar pagos',
          to: getDashboardPath(role, firstEventWithReviewable.id),
          icon: 'fa-clock',
        };
      }

      if (blockedEvents.length > 0 && firstBlockedEvent) {
        return {
          tone: 'rose' as const,
          eyebrow: 'Operación pausada',
          title: `${blockedEvents.length} evento${
            blockedEvents.length !== 1 ? 's' : ''
          } al límite`,
          text: 'Alcanzaste el límite de 20 lugares gratis. Habilitá el evento ahora para seguir recibiendo confirmaciones y pagos sin interrupciones.',
          cta: 'Habilitar evento',
          to: getDashboardPath(role, firstBlockedEvent.id),
          icon: 'fa-lock',
        };
      }

      if (warningEvents.length > 0 && firstWarningEvent) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Asegurá tus ventas',
          title: 'Habilitá tu evento',
          text: 'Aún no alcanzaste el límite gratis de 20 lugares, pero podés habilitarlo ahora para ahorrar tiempo y no pausar las ventas luego.',
          cta: 'Habilitar ahora',
          to: getDashboardPath(role, firstWarningEvent.id),
          icon: 'fa-unlock-keyhole',
        };
      }

      if (events.length === 0) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Tu negocio empieza acá',
          title: 'Creá tu primer evento',
          text: 'Configurá tu primer evento en menos de 2 minutos y empezá a vender entradas hoy mismo.',
          cta: 'Crear nuevo evento',
          to: '/create',
          icon: 'fa-calendar-plus',
        };
      }

      if (firstActiveEvent) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Todo bajo control',
          title: 'Tu evento está en marcha',
          text: 'Entrá a tu panel para ver la recaudación en vivo, ventas y controlar a tu equipo.',
          cta: 'Ir a mi panel',
          to: getDashboardPath(role, firstActiveEvent.id),
          icon: 'fa-arrow-right',
        };
      }
    }

    if (isDoorRole) {
      if (totalDoorReadyCount > 0 && firstEventWithDoorReady) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Gente lista para entrar',
          title: `${totalDoorReadyCount} acceso${
            totalDoorReadyCount !== 1 ? 's' : ''
          } confirmado${totalDoorReadyCount !== 1 ? 's' : ''}`,
          text: 'Ya hay entradas confirmadas. Abrí tu panel y empezá a escanear los códigos QR.',
          cta: 'Controlar puerta',
          to: getDashboardPath(role, firstEventWithDoorReady.id),
          icon: 'fa-door-open',
        };
      }

      if (events.length === 0) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Todo tranquilo por ahora',
          title: 'No tenés eventos',
          text: 'Avisale al organizador que te asigne a un evento para empezar a controlar la puerta.',
          cta: 'Entendido',
          to: '',
          icon: 'fa-user-check',
        };
      }

      if (firstActiveEvent) {
        return {
          tone: 'emerald' as const,
          eyebrow: 'Preparate para la puerta',
          title: 'Entrá a tu próximo evento',
          text: 'Entrá a tu panel para tener el lector de QR y el buscador de nombres a mano.',
          cta: 'Abrir control de accesos',
          to: getDashboardPath(role, firstActiveEvent.id),
          icon: 'fa-qrcode',
        };
      }
    }

    if (isGuestOwner) {
      if (events.length === 0) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Esperando asignacion',
          title: 'Todavia no tenes un evento cargado',
          text: 'Cuando el master o tu organizador te asigne el evento, lo vas a ver aca con acceso al panel principal.',
          cta: 'Entendido',
          to: '',
          icon: 'fa-calendar-day',
        };
      }

      if (firstActiveEvent) {
        return {
          tone: 'emerald' as const,
          eyebrow: 'Tu evento ya esta activo',
          title: 'Segui todo desde un solo panel',
          text: 'Entrá para ver el estado general del evento, ventas, fecha, capacidad y avances operativos.',
          cta: 'Abrir mi evento',
          to: getDashboardPath(role, firstActiveEvent.id),
          icon: 'fa-stars',
        };
      }
    }

    if (isSeller) {
      if (totalSellerPendingCount > 0 && firstActiveEvent) {
        return {
          tone: 'amber' as const,
          eyebrow: 'Cerrá tus ventas',
          title: `${totalSellerPendingCount} reserva${
            totalSellerPendingCount !== 1 ? 's' : ''
          } sin pagar`,
          text: 'Tenés reservas en proceso. Hablá con tus invitados para que confirmen y sumes tu venta.',
          cta: 'Ver mis ventas',
          to: getDashboardPath(role, firstActiveEvent.id),
          icon: 'fa-share-nodes',
        };
      }

      if (events.length === 0) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Sin eventos asignados',
          title: 'Todavía no tenés eventos',
          text: 'Avisale al organizador que te pase acceso para empezar a vender con tu propio link.',
          cta: 'Entendido',
          to: '',
          icon: 'fa-user-group',
        };
      }

      if (firstActiveEvent) {
        return {
          tone: 'blue' as const,
          eyebrow: 'Multiplicá tus ingresos',
          title: 'Seguí compartiendo tu link',
          text: 'Entrá a tu panel, copiá tu enlace personal y mandáselo por WhatsApp a tus invitados.',
          cta: 'Ir a mis eventos',
          to: getDashboardPath(role, firstActiveEvent.id),
          icon: 'fa-arrow-right',
        };
      }
    }

    return {
      tone: 'blue' as const,
      eyebrow: 'Bienvenido',
      title: 'Tu panel principal',
      text: 'Acá vas a encontrar el resumen de tus eventos para gestionar todo súper rápido.',
      cta: 'Ver mis eventos',
      to: firstEvent ? getDashboardPath(role, firstEvent.id) : '',
      icon: 'fa-house',
    };
  }, [
    isCreator,
    isGuestOwner,
    isDoorRole,
    isSeller,
    totalReviewableCount,
    firstEventWithReviewable,
    blockedEvents.length,
    firstBlockedEvent,
    warningEvents.length,
    firstWarningEvent,
    events.length,
    firstActiveEvent,
    totalDoorReadyCount,
    firstEventWithDoorReady,
    totalSellerPendingCount,
    firstEvent,
    role,
  ]);

  const priorityStyles = getPriorityToneClasses(priorityCard.tone);

  if (!user) return null;

  return (
    <>
      <main className="page-fade relative min-h-screen overflow-hidden bg-[#100311] px-3 pb-24 pt-2 text-white md:px-6 lg:px-8">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.18),transparent_24%),radial-gradient(circle_at_top_left,rgba(251,113,133,.12),transparent_20%),linear-gradient(180deg,#100311,#170817_52%,#0b0211)]" />
        <div className="relative mx-auto w-full max-w-7xl">
          <AppHeader
            title={`Hola, ${firstName}`}
            subtitle={
              isCreator
                ? 'Resolvé lo urgente y mantené tus ventas en movimiento.'
                : isDoorRole
                ? 'Seleccioná tu evento y empezá a escanear entradas al toque.'
                : isGuestOwner
                ? 'Entrá a tu evento y seguí el trabajo del organizador desde un panel claro.'
                : 'Buscá tu evento, compartí tu link y seguí sumando ventas.'
            }
            showBack={false}
            rightSlot={
              <button
                type="button"
                onClick={() =>
                  openHelpModal(
                    'Tu panel inteligente',
                    `
                      <p>Este inicio te avisa automáticamente qué es lo más importante que tenés que hacer hoy.</p>
                      <p>Si hay pagos por aprobar o gente esperando en puerta, lo vas a ver destacado arriba de todo.</p>
                    `,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-pink-300/14 bg-white/[0.06] text-pink-100 shadow-sm transition hover:bg-white/[0.1]"
              >
                <i className="fas fa-headset text-[14px]"></i>
              </button>
            }
          />

          <section className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className={`overflow-hidden rounded-[28px] border p-5 shadow-[0_22px_50px_rgba(10,3,17,.24)] backdrop-blur lg:p-6 ${priorityStyles.wrapper}`}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ${priorityStyles.icon}`}
                  >
                    <i className={`fas ${priorityCard.icon} text-[18px]`}></i>
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-[11px] font-black uppercase tracking-[0.16em] ${priorityStyles.eyebrow}`}
                    >
                      {priorityCard.eyebrow}
                    </p>
                    <h2 className="mt-1 text-[24px] font-black leading-[1.05] text-white lg:text-[28px]">
                      {priorityCard.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-pink-100/68">
                      {priorityCard.text}
                    </p>

                    {(isCreator || isDoorRole) &&
                      loadingOperationSummaries &&
                      !allOperationSummariesLoaded && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-pink-300/12 bg-black/18 px-3 py-1 text-[11px] font-bold text-pink-50">
                          <i className="fas fa-circle-notch fa-spin"></i>
                          Actualizando métricas...
                        </div>
                      )}
                  </div>
                </div>

                {priorityCard.to ? (
                  priorityCard.to === '/create' ? (
                    <Link
                      to={priorityCard.to}
                      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-[14px] font-black text-white shadow-sm transition ${priorityStyles.button}`}
                    >
                      {priorityCard.cta}
                      <i className="fas fa-arrow-right text-[12px]"></i>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(priorityCard.to)}
                      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-[14px] font-black text-white shadow-sm transition ${priorityStyles.button}`}
                    >
                      {priorityCard.cta}
                      <i className="fas fa-arrow-right text-[12px]"></i>
                    </button>
                  )
                ) : null}
              </div>
            </motion.div>
          </section>

          <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label={isCreator ? 'Eventos' : 'Asignados'}
              value={events.length}
              hint={isCreator ? 'Total creados por vos' : 'Eventos donde trabajás'}
            />

            <SummaryCard
              label="Activos"
              value={activeCount}
              hint="Están vendiendo ahora"
              valueClassName="text-sky-300"
            />

            <SummaryCard
              label={
                isCreator
                  ? 'Confirmados'
                  : isDoorRole
                  ? 'Listos para entrar'
                  : isGuestOwner
                  ? 'Confirmados'
                  : 'Ventas confirmadas'
              }
              value={isDoorRole ? totalDoorReadyCount : totalConfirmedCount}
              hint={
                isDoorRole
                  ? 'Entradas válidas'
                  : isGuestOwner
                  ? 'Accesos emitidos'
                  : isSeller
                  ? 'Tu plata asegurada'
                  : 'Entradas ya pagadas'
              }
              valueClassName={isDoorRole ? 'text-sky-300' : 'text-emerald-300'}
            />

            <SummaryCard
              label={
                isCreator
                  ? 'Por revisar'
                  : isDoorRole
                  ? 'Ya adentro'
                  : isGuestOwner
                  ? 'Pendientes'
                  : 'Pendientes'
              }
              value={
                isCreator
                  ? totalReviewableCount
                  : isDoorRole
                  ? totalDoorCheckedInCount
                  : isGuestOwner
                  ? totalPendingCount
                  : totalSellerPendingCount
              }
              hint={
                isCreator
                  ? 'Pagos a confirmar'
                  : isDoorRole
                  ? 'Gente en el lugar'
                  : isGuestOwner
                  ? 'Reservas sin cerrar'
                  : 'Falta que paguen'
              }
              valueClassName={
                isCreator || isSeller ? 'text-amber-300' : 'text-violet-300'
              }
            />
          </section>

          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[22px] font-black text-white">
                  {isCreator ? 'Tus eventos' : isGuestOwner ? 'Tus celebraciones' : 'Eventos asignados'}
                </h2>
                <p className="mt-1 text-[14px] text-pink-100/58">
                  Elegí uno para ir directo a su panel.
                </p>
              </div>

              {isCreator && (
                <Link
                  to="/create"
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-3 text-[14px] font-black text-white shadow-[0_18px_32px_rgba(236,72,153,.2)] transition hover:brightness-110"
                >
                  <i className="fas fa-plus"></i>
                  Crear nuevo evento
                </Link>
              )}
            </div>

            {events.length === 0 ? (
              <div className="rounded-[28px] border border-pink-300/12 bg-white/[0.045] p-8 text-center shadow-[0_22px_50px_rgba(10,3,17,.24)] backdrop-blur lg:p-12">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-300/14 lg:h-20 lg:w-20">
                  <i
                    className={`fas ${
                      isCreator
                        ? 'fa-calendar-plus'
                        : isDoorRole
                        ? 'fa-door-open'
                        : 'fa-user-group'
                    } text-2xl text-pink-200 lg:text-3xl`}
                  ></i>
                </div>

                <h3 className="mb-2 text-[22px] font-black text-white lg:text-[26px]">
                  {isCreator
                    ? 'Tu panel está esperando tu primer evento'
                    : isGuestOwner
                    ? 'Todavía no tenés un evento asignado'
                    : 'Todavía no te asignaron a ningún evento'}
                </h3>

                <p className="mx-auto max-w-md text-[15px] leading-relaxed text-pink-100/64">
                  {isCreator
                    ? 'Crear un evento lleva menos de 2 minutos. Hacelo ahora y compartí tu link de ventas al instante.'
                    : isGuestOwner
                    ? 'Pedile al organizador o al master que te asigne el evento. Apenas lo hagan, te va a aparecer acá automáticamente.'
                    : 'Pedile al organizador del evento que te agregue. Apenas lo haga, te va a aparecer acá de forma automática.'}
                </p>

                {isCreator && (
                  <Link
                    to="/create"
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-5 py-3 text-[14px] font-black text-white shadow-[0_18px_32px_rgba(236,72,153,.2)] transition hover:brightness-110"
                  >
                    Crear mi primer evento
                    <i className="fas fa-arrow-right text-[12px]"></i>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {eventsSorted.map((event, idx) => {
                  const { sold, pending, total, progress } = getEventCounts(event);
                  const active = event.status !== 'finished';
                  const unlockState = getUnlockState(event);
                  const eventPath = getDashboardPath(role, event.id);

                  const eventIdKey = String(event.id);
                  const hasLoadedSummary = loadedOperationSummaryIds.has(eventIdKey);
                  const summary = operationSummaryByEvent[eventIdKey] || {
                    reviewable: 0,
                    readyForDoor: 0,
                    checkedIn: 0,
                  };

                  const secondMetricValue =
                    (isCreator || isDoorRole) && !hasLoadedSummary
                      ? '...'
                      : isCreator
                      ? summary.reviewable
                      : isDoorRole
                      ? summary.readyForDoor
                      : pending;

                  const secondMetricLabel = isCreator
                    ? 'Por revisar'
                    : isDoorRole
                    ? 'Listos'
                    : 'Pendientes';

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`rounded-[28px] border p-5 shadow-[0_22px_48px_rgba(10,3,17,.22)] backdrop-blur transition-all hover:-translate-y-1 hover:border-pink-300/24 lg:p-6 ${
                        active
                          ? 'border-pink-300/12 bg-white/[0.045]'
                          : 'border-pink-300/10 bg-white/[0.025] opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="truncate text-[20px] font-black leading-tight text-white">
                            {event.title}
                          </h3>

                          <p className="mt-1.5 text-[13px] font-medium text-pink-100/58">
                            <i className="far fa-calendar-alt mr-1.5 text-pink-300"></i>
                            {formatDateTime(event.drawDate || event.eventDate)}
                          </p>
                        </div>

                        <div className="shrink-0">
                          <span
                            className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${
                              event.status === 'finished'
                                ? 'bg-white/10 text-pink-100/58'
                                : 'bg-pink-400/14 text-pink-100'
                            }`}
                          >
                            {event.status === 'finished' ? 'Finalizado' : 'Activo'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {isCreator && summary.reviewable > 0 && (
                          <span className="rounded-full border border-amber-300/22 bg-amber-300/12 px-3 py-1.5 text-[11px] font-black text-amber-200">
                            {summary.reviewable} pagos por revisar
                          </span>
                        )}

                        {isDoorRole && summary.readyForDoor > 0 && (
                          <span className="rounded-full border border-sky-300/22 bg-sky-300/12 px-3 py-1.5 text-[11px] font-black text-sky-200">
                            {summary.readyForDoor} accesos listos
                          </span>
                        )}

                        {isSeller && pending > 0 && (
                          <span className="rounded-full border border-amber-300/22 bg-amber-300/12 px-3 py-1.5 text-[11px] font-black text-amber-200">
                            {pending} reservas en proceso
                          </span>
                        )}

                        {unlockState === 'blocked' && isCreator && active && (
                          <span className="rounded-full border border-rose-300/22 bg-rose-300/12 px-3 py-1.5 text-[11px] font-black text-rose-200">
                            <i className="fas fa-lock mr-1"></i>
                            Pausado (Límite alcanzado)
                          </span>
                        )}
                        
                        {unlockState === 'warning' && isCreator && active && (
                          <span className="rounded-full border border-sky-300/22 bg-sky-300/12 px-3 py-1.5 text-[11px] font-black text-sky-200">
                            <i className="fas fa-unlock mr-1"></i>
                            Versión Gratis
                          </span>
                        )}
                      </div>

                      <div className="mt-4 rounded-[20px] border border-pink-300/10 bg-black/18 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[13px] font-bold text-pink-100/62">
                            Ocupación
                          </p>
                          <p className="text-[13px] font-black text-pink-200">
                            {progress}%
                          </p>
                        </div>

                        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#fb7185,#8b5cf6)] transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-100/46">
                              Confirmados
                            </p>
                            <p className="mt-1 text-[19px] font-black text-white">
                              {sold}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-100/46">
                              {secondMetricLabel}
                            </p>
                            <p
                              className={`mt-1 text-[19px] font-black ${
                                isDoorRole ? 'text-sky-300' : 'text-amber-300'
                              }`}
                            >
                              {secondMetricValue}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-pink-100/46">
                              Total
                            </p>
                            <p className="mt-1 text-[19px] font-black text-white">
                              {total || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(eventPath)}
                        className="mt-4 flex w-full items-center justify-between rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-3.5 text-left text-white shadow-[0_18px_32px_rgba(236,72,153,.18)] transition hover:brightness-110"
                      >
                        <span className="text-[14px] font-black">
                          {isCreator
                            ? 'Ir a mi panel'
                            : isDoorRole
                            ? 'Controlar puerta'
                            : isGuestOwner
                            ? 'Configurar mi evento'
                            : 'Ver mis ventas'}
                        </span>
                        <i className="fas fa-arrow-right text-[12px]"></i>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <div className="block lg:hidden">
        <BottomNav
          items={[
            {
              label: 'Inicio',
              icon: 'fa-house',
              active: true,
              to: '/',
            },
            ...(isCreator
              ? [
                  {
                    label: 'Crear',
                    icon: 'fa-plus',
                    to: '/create',
                  },
                ]
              : isDoorRole
              ? [
                  {
                    label: 'Ayuda',
                    icon: 'fa-headset',
                    onClick: () =>
                      openHelpModal(
                        'Control de accesos',
                        `
                          <p>Entrá al evento para escanear los QR de las entradas o buscar nombres manualmente.</p>
                          <p>Acordate que desde tu usuario no hace falta revisar pagos ni meterte en la configuración.</p>
                        `,
                      ),
                  },
                ]
              : [
                  {
                    label: 'Ayuda',
                    icon: 'fa-headset',
                    onClick: () =>
                      openHelpModal(
                        'Aumentá tus ventas',
                        `
                          <p>Entrá a cualquiera de tus eventos para ver tu avance y compartir tu propio link.</p>
                          <p>Tus ventas y reservas las vas a ver en detalle adentro del panel del evento.</p>
                        `,
                      ),
                  },
                ]),
            {
              label: 'Soporte',
              icon: 'fa-circle-question',
              onClick: () =>
                openHelpModal(
                  '¿Necesitás ayuda?',
                  `
                    <p>Esta pantalla siempre te va a llevar a la acción más importante del momento.</p>
                    <p>Fijate siempre en el bloque destacado arriba de todo, ahí te marcamos si hay algo urgente que hacer.</p>
                  `,
                ),
            },
          ]}
        />
      </div>

      <div className="bg-[#0b0211] px-3 md:px-6 lg:px-8">
        <AppFooter />
      </div>
    </>
  );
}
