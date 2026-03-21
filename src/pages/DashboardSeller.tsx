import { useEffect, useState, useContext, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import AppFooter from '../components/AppFooter';
import GuidedTour from '../components/GuidedTour';
import {
  buildPublicRaffleLink,
  buildShareRaffleLink,
  copyText,
  openHelpModal,
  openWhatsAppShare,
  promptAppShare,
  promptShare,
  runAfterTourAndIdle,
} from '../utils/ux';
import type { Step } from 'react-joyride';

function toMoney(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Fecha no disponible';
  return new Date(value).toLocaleString('es-AR');
}

function getSaleStatusMeta(status?: string | null) {
  switch (String(status || '')) {
    case 'approved':
    case 'auto_approved':
      return {
        label: 'Confirmada',
        badgeClassName:
          'bg-emerald-100 text-emerald-700 border border-emerald-200',
        cardClassName: 'border-emerald-200 bg-emerald-50/70',
      };

    case 'under_review':
      return {
        label: 'En revisión',
        badgeClassName:
          'bg-amber-100 text-amber-700 border border-amber-200',
        cardClassName: 'border-amber-200 bg-amber-50/70',
      };

    case 'pending_cash_confirmation':
      return {
        label: 'Pendiente de cobro',
        badgeClassName:
          'bg-orange-100 text-orange-700 border border-orange-200',
        cardClassName: 'border-orange-200 bg-orange-50/70',
      };

    case 'reserved':
    case 'pending_proof':
      return {
        label: 'Reservada',
        badgeClassName:
          'bg-sky-100 text-sky-700 border border-sky-200',
        cardClassName: 'border-sky-200 bg-sky-50/70',
      };

    case 'checked_in':
      return {
        label: 'Ingresó',
        badgeClassName:
          'bg-indigo-100 text-indigo-700 border border-indigo-200',
        cardClassName: 'border-indigo-200 bg-indigo-50/70',
      };

    case 'rejected':
      return {
        label: 'Rechazada',
        badgeClassName:
          'bg-rose-100 text-rose-700 border border-rose-200',
        cardClassName: 'border-rose-200 bg-rose-50/70',
      };

    default:
      return {
        label: status || 'Sin estado',
        badgeClassName:
          'bg-slate-100 text-slate-700 border border-slate-200',
        cardClassName: 'border-slate-200 bg-slate-50/70',
      };
  }
}

function getPaymentMethodLabel(method?: string | null) {
  if (method === 'transfer') return 'Transferencia';
  if (method === 'cash') return 'Efectivo';
  if (method === 'link') return 'Link de pago';
  return 'A definir';
}

export default function DashboardSeller() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useContext(AuthContext);
  const [data, setData] = useState<any>(null);

  const eventTitle = useMemo(() => {
    return (
      data?.eventTitle ||
      data?.raffleTitle ||
      data?.title ||
      'Mi evento'
    );
  }, [data]);

  const sellerName = useMemo(() => {
    return (
      data?.sellerName ||
      data?.fullName ||
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
      user?.email ||
      'RRPP'
    );
  }, [data, user]);

  const sellerViewLink = useMemo(
    () => buildPublicRaffleLink(id, user?.id),
    [id, user?.id],
  );

  const sellerShareLink = useMemo(
    () => buildShareRaffleLink(id, user?.id),
    [id, user?.id],
  );

  const sellerCopyMessage = useMemo(() => {
    return [
      `🎟️ ${eventTitle}`,
      '',
      `Te comparto mi link directo para que reserves tu acceso:`,
      sellerShareLink,
      '',
      `Si querés sumarte, entrá desde ahí y la gestión queda asociada a mí.`,
    ].join('\n');
  }, [eventTitle, sellerShareLink]);

  const sellerWhatsAppMessage = useMemo(() => {
    return [
      `Hola 👋`,
      `Te paso mi link para ${eventTitle}:`,
      sellerShareLink,
      '',
      `Desde ahí podés reservar o comprar tu acceso de forma directa.`,
    ].join('\n');
  }, [eventTitle, sellerShareLink]);

  useEffect(() => {
    if (!ready) return;

    if (!user?.id) {
      navigate('/', { replace: true });
      return;
    }

    if (!id) return;

    api
      .get(`/sellers/dashboard/${id}`)
      .then((res) => setData(res.data))
      .catch((error) => {
        console.error('Error cargando panel RRPP:', error);
        Swal.fire('Error', 'No se pudo cargar tu panel de RRPP', 'error');
        navigate('/');
      });
  }, [id, navigate, ready, user?.id]);

  useEffect(() => {
    if (!data) return;

    const cleanup1 = runAfterTourAndIdle(
      () => {
        promptShare(`seller-link-${id}`, {
          title: `Mi link para ${eventTitle}`,
          text: sellerWhatsAppMessage,
          url: sellerShareLink,
        });
      },
      { minDelayMs: 30000, idleMs: 20000, timeoutMs: 240000 },
    );

    const cleanup2 = runAfterTourAndIdle(
      () => {
        promptAppShare(`seller-app-${id}`, window.location.origin);
      },
      { minDelayMs: 90000, idleMs: 25000, timeoutMs: 300000 },
    );

    return () => {
      cleanup1();
      cleanup2();
    };
  }, [data, id, eventTitle, sellerWhatsAppMessage, sellerShareLink]);

  const tourSteps = [
    {
      target: '[data-tour="seller-summary"]',
      title: 'Tu resumen de performance',
      content:
        'Acá ves cuántas operaciones cerraste, cuáles siguen pendientes y cuánto llevás generado de comisión.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="seller-link"]',
      title: 'Este es tu link personal',
      content:
        'Es el link que tenés que compartir. Cada compra o reserva que entre por ahí queda asociada a vos.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="seller-actions"]',
      title: 'Compartí más rápido',
      content:
        'Podés mandar WhatsApp con mensaje armado o copiar el texto completo para pegarlo donde quieras.',
      placement: 'top',
    },
    {
      target: '[data-tour="seller-preview"]',
      title: 'Revisá la vista pública',
      content:
        'Desde acá abrís exactamente lo que verá la persona cuando entre por tu link.',
      placement: 'top',
    },
  ] satisfies Step[];

  const shareWhatsApp = () => {
    openWhatsAppShare(sellerWhatsAppMessage);
  };

  const copyLink = async () => {
    await copyText(sellerCopyMessage, 'Mensaje completo copiado para compartir.');
  };

  const genericShare = () => {
    openWhatsAppShare(sellerWhatsAppMessage);
  };

  const viewPublicPage = () => {
    navigate(`/raffle/${id}?vendedor=${user?.id}`);
  };

  if (!data) {
    return (
      <>
        <main className="page-fade px-3 pt-1">
          <AppHeader
            title="Panel RRPP"
            subtitle="Cargando información"
            showBack
            onBack={() => navigate('/')}
            rightSlot={
              <button
                type="button"
                onClick={() =>
                  openHelpModal(
                    'Ayuda',
                    `
                      <p>Estamos cargando tu panel.</p>
                      <p>En un momento vas a ver tu link personal, tu rendimiento y cómo compartirlo mejor.</p>
                    `,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-white text-[#3483fa] shadow-sm border border-black/5"
              >
                <i className="fas fa-headset text-[14px]"></i>
              </button>
            }
          />

          <div className="mp-card p-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#3483fa]"></div>
            <p className="text-[14px] font-bold text-slate-700">Cargando tu panel...</p>
          </div>
        </main>

        <BottomNav
          items={[
            { label: 'Inicio', icon: 'fa-home', to: '/' },
            { label: 'Volver', icon: 'fa-arrow-left', onClick: () => navigate('/') },
            {
              label: 'Ayuda',
              icon: 'fa-headset',
              onClick: () =>
                openHelpModal(
                  'Ayuda',
                  '<p>Cuando cargue, vas a poder compartir tu link y revisar tus resultados.</p>',
                ),
            },
          ]}
        />
      </>
    );
  }

  const stats = data?.stats || {};

  const earned = toMoney(
    stats?.earned ??
      stats?.commissionEarned ??
      stats?.commissions ??
      0,
  );

  const grossRevenue = toMoney(
    stats?.grossRevenue ??
      stats?.totalRevenue ??
      stats?.revenue ??
      stats?.collected ??
      0,
  );

  const commissionPercent = Number(
    data?.commissionPercent ??
      data?.commission ??
      stats?.commissionPercent ??
      0,
  );

  const confirmedCount = toInt(
    stats?.confirmed ??
      stats?.confirmedSales ??
      stats?.approved ??
      stats?.approvedCount ??
      stats?.sold ??
      0,
    0,
  );

  const pendingCount = toInt(
    stats?.pending ??
      stats?.underReview ??
      stats?.pendingCount ??
      stats?.pendingSales ??
      0,
    0,
  );

  const rejectedCount = toInt(
    stats?.rejected ??
      stats?.rejectedCount ??
      stats?.rejectedSales ??
      0,
    0,
  );

  const checkedInCount = toInt(
    stats?.checkedIn ??
      stats?.checkedInCount ??
      0,
    0,
  );

  const totalManaged = toInt(
    stats?.totalManaged ??
      stats?.totalLeads ??
      stats?.totalOperations ??
      confirmedCount + pendingCount + rejectedCount,
    confirmedCount + pendingCount + rejectedCount,
  );

  const closeRate =
    totalManaged > 0
      ? Math.min(100, Math.round((confirmedCount / totalManaged) * 100))
      : 0;

  const recentSales = Array.isArray(
    data?.latestPurchases ??
      data?.latestSales ??
      data?.sales ??
      data?.purchases,
  )
    ? (data?.latestPurchases ??
        data?.latestSales ??
        data?.sales ??
        data?.purchases)
    : [];

  return (
    <>
      <GuidedTour storageKey={`tour_seller_${id}_v20`} steps={tourSteps} />

      <main className="page-fade px-3 pt-1">
        <AppHeader
          title={eventTitle}
          subtitle="Tu panel comercial de RRPP"
          showBack
          onBack={() => navigate('/')}
          rightSlot={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={genericShare}
                className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[#25D366] text-white shadow-sm border border-[#25D366]"
              >
                <i className="fab fa-whatsapp text-[14px]"></i>
              </button>

              <button
                type="button"
                onClick={() =>
                  openHelpModal(
                    'Cómo usar bien este panel',
                    `
                      <p>Tu objetivo principal acá es compartir tu link personal.</p>
                      <p>Las compras o reservas que entren por ese link quedan asociadas a vos y después se reflejan en tus métricas.</p>
                    `,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-white text-[#3483fa] shadow-sm border border-black/5"
              >
                <i className="fas fa-headset text-[14px]"></i>
              </button>
            </div>
          }
        />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 overflow-hidden rounded-[22px] border border-[#f1e38b] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
        >
          <div className="bg-[#fff159] px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">
              Panel RRPP
            </p>
            <h2 className="text-[24px] leading-[1.06] font-black text-slate-900">
              Mové tu link
              <br />
              y seguí tu performance
            </h2>
            <p className="mt-1.5 text-[13px] leading-6 text-slate-700">
              Todo está pensado para que compartas más fácil, cierres mejor y veas tus resultados en tiempo real.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 p-3">
            <div className="rounded-[16px] bg-[#f7f7f7] p-3 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#e8fff2] text-[#00a650]">
                <i className="fas fa-percent text-[14px]"></i>
              </div>
              <p className="text-[11px] font-bold text-slate-700">Comisión</p>
            </div>

            <div className="rounded-[16px] bg-[#f7f7f7] p-3 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#eaf2ff] text-[#3483fa]">
                <i className="fab fa-whatsapp text-[14px]"></i>
              </div>
              <p className="text-[11px] font-bold text-slate-700">Compartir</p>
            </div>

            <div className="rounded-[16px] bg-[#f7f7f7] p-3 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#fff5dc] text-[#f59e0b]">
                <i className="fas fa-eye text-[14px]"></i>
              </div>
              <p className="text-[11px] font-bold text-slate-700">Preview</p>
            </div>
          </div>
        </motion.section>

        <section data-tour="seller-summary" className="mb-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Seguimiento
              </p>
              <h2 className="text-[19px] font-black text-slate-900">Tus resultados</h2>
            </div>

            <button
              type="button"
              onClick={() =>
                openHelpModal(
                  'Tus resultados',
                  `
                    <p>Acá ves cuánto generaste, cuántas operaciones ya quedaron confirmadas y cuáles siguen esperando validación.</p>
                    <p>La comisión normalmente se consolida cuando la operación queda confirmada por el organizador.</p>
                  `,
                )
              }
              className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa]"
            >
              <i className="fas fa-chart-line text-[14px]"></i>
            </button>
          </div>

          <div className="mb-3 rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-700">Tasa de cierre</p>
              <p className="text-[13px] font-black text-[#3483fa]">{closeRate}%</p>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#3483fa] transition-all duration-500"
                style={{ width: `${closeRate}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Ganado</p>
              <p className="mt-1.5 text-[22px] font-black text-emerald-600">
                ${Math.floor(earned).toLocaleString('es-AR')}
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Comisión</p>
              <p className="mt-1.5 text-[24px] font-black text-[#3483fa]">
                {commissionPercent}%
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Confirmadas</p>
              <p className="mt-1.5 text-[24px] font-black text-slate-900">
                {confirmedCount}
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Pendientes</p>
              <p className="mt-1.5 text-[24px] font-black text-amber-600">
                {pendingCount}
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Rechazadas</p>
              <p className="mt-1.5 text-[22px] font-black text-rose-600">
                {rejectedCount}
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Ingresaron</p>
              <p className="mt-1.5 text-[22px] font-black text-indigo-600">
                {checkedInCount}
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Total gestionado</p>
              <p className="mt-1.5 text-[22px] font-black text-slate-900">
                {totalManaged}
              </p>
            </div>

            <div className="mp-card p-3">
              <p className="text-[11px] font-bold text-slate-500">Volumen generado</p>
              <p className="mt-1.5 text-[20px] font-black text-slate-900">
                ${Math.floor(grossRevenue).toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Importante
            </p>
            <p className="mt-1.5 text-[13px] leading-6 text-slate-700">
              Tu link personal asocia automáticamente la compra o reserva a tu usuario RRPP. Si una operación sigue pendiente, puede no impactar todavía en tu comisión final.
            </p>
          </div>
        </section>

        <section data-tour="seller-link" className="mp-card mb-3 overflow-hidden">
          <div className="bg-[#fff159] px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
              Tu herramienta principal
            </p>
            <h2 className="text-[20px] font-black text-slate-900">Tu link personal de RRPP</h2>
            <p className="mt-2 break-all text-[13px] leading-6 text-slate-700">
              {sellerShareLink}
            </p>
          </div>

          <div className="px-3 pt-3">
            <div className="rounded-[16px] border border-slate-200 bg-[#f8f8f8] p-3">
              <p className="text-[14px] font-black text-slate-900">Cómo usarlo bien</p>
              <p className="mt-1 text-[13px] leading-6 text-slate-700">
                Compartilo por WhatsApp, historias, grupos o de forma directa. Ese link ya deja asociada la operación a tu usuario para que después impacte en tu panel.
              </p>
            </div>
          </div>

          <div data-tour="seller-actions" className="space-y-2.5 p-3">
            <button
              type="button"
              onClick={shareWhatsApp}
              className="w-full rounded-[16px] bg-[#25D366] py-3 text-[14px] font-black text-white shadow-[0_8px_18px_rgba(37,211,102,0.22)]"
            >
              <i className="fab fa-whatsapp mr-2"></i>
              Enviar por WhatsApp
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={copyLink}
                className="mp-btn-primary w-full !py-3 !text-[14px]"
              >
                <i className="fas fa-copy"></i>
                Copiar mensaje
              </button>

              <button
                type="button"
                onClick={genericShare}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#25D366] px-4 py-3 text-[14px] font-black text-white shadow-[0_8px_18px_rgba(37,211,102,0.22)]"
              >
                <i className="fab fa-whatsapp"></i>
                Compartir
              </button>
            </div>
          </div>
        </section>

        <section data-tour="seller-preview" className="mp-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Vista pública
              </p>
              <h2 className="text-[19px] font-black text-slate-900">
                Revisá lo que verá tu comprador
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                openHelpModal(
                  'Vista pública',
                  `
                    <p>Acá abrís exactamente la pantalla que verá la persona cuando entre por tu link.</p>
                    <p>Es útil para revisar que todo esté prolijo antes de compartir.</p>
                  `,
                )
              }
              className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa]"
            >
              <i className="fas fa-question-circle text-[14px]"></i>
            </button>
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-[#f8f8f8] p-3 mb-3">
            <p className="text-[13px] text-slate-700 leading-6">
              Antes de compartir, abrí la vista pública y comprobá que el evento, el precio y el flujo de compra estén claros. Tu link de preview es:
            </p>
            <p className="mt-2 break-all text-[12px] font-bold text-[#3483fa]">
              {sellerViewLink}
            </p>
          </div>

          <button
            type="button"
            onClick={viewPublicPage}
            className="mp-btn-primary w-full !py-3 !text-[14px]"
          >
            <i className="fas fa-eye"></i>
            Ver vista pública de mi link
          </button>
        </section>

        {recentSales.length > 0 && (
          <section className="mp-card mt-3 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Actividad reciente
                </p>
                <h2 className="text-[19px] font-black text-slate-900">
                  Últimas operaciones asociadas a vos
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  openHelpModal(
                    'Actividad reciente',
                    `
                      <p>Acá ves las últimas reservas o compras que entraron por tu link.</p>
                      <p>Te sirve para saber rápido qué está confirmado, qué sigue pendiente y qué fue rechazado.</p>
                    `,
                  )
                }
                className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa]"
              >
                <i className="fas fa-clock-rotate-left text-[14px]"></i>
              </button>
            </div>

            <div className="space-y-2.5">
              {recentSales.map((item: any, index: number) => {
                const statusMeta = getSaleStatusMeta(item?.status);

                return (
                  <motion.div
                    key={item?.id || `${index}-${item?.buyerName || 'sale'}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`rounded-[16px] border p-3 ${statusMeta.cardClassName}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-black text-slate-900">
                          {item?.buyerName || 'Sin nombre'}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {item?.buyerPhone || item?.buyerEmail || 'Sin contacto'}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusMeta.badgeClassName}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                      <div className="rounded-[12px] bg-white/80 p-2.5">
                        <p className="text-slate-500">Monto</p>
                        <p className="mt-1 font-black text-slate-900">
                          ${toMoney(item?.totalAmount ?? item?.amount).toLocaleString('es-AR')}
                        </p>
                      </div>

                      <div className="rounded-[12px] bg-white/80 p-2.5">
                        <p className="text-slate-500">Método</p>
                        <p className="mt-1 font-black text-slate-900">
                          {getPaymentMethodLabel(item?.paymentMethod)}
                        </p>
                      </div>

                      <div className="rounded-[12px] bg-white/80 p-2.5 col-span-2">
                        <p className="text-slate-500">Fecha</p>
                        <p className="mt-1 font-black text-slate-900">
                          {formatDateTime(
                            item?.submittedAt ||
                              item?.createdAt ||
                              item?.reservedAt ||
                              item?.updatedAt,
                          )}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-3 rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Consejo comercial
          </p>
          <p className="mt-2 text-[13px] leading-6 text-slate-700">
            Suele convertir mejor compartir el link con un texto corto, claro y directo: qué evento es, cuándo es y que desde ese link pueden reservar o comprar en dos toques.
          </p>
        </section>

        <AppFooter />
      </main>

      <BottomNav
        items={[
          {
            label: 'Inicio',
            icon: 'fa-home',
            to: '/',
          },
          {
            label: 'WhatsApp',
            icon: 'fab fa-whatsapp',
            onClick: genericShare,
          },
          {
            label: 'Ayuda',
            icon: 'fa-headset',
            onClick: () =>
              openHelpModal(
                'Ayuda',
                `
                  <p>Tu objetivo acá es mover tu link personal de RRPP.</p>
                  <p>Después revisás confirmadas, pendientes y comisión para saber cómo venís.</p>
                `,
              ),
          },
        ]}
      />
    </>
  );
}