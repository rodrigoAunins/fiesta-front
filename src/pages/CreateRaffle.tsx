import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../api/axios';
import AppHeader from '../components/AppHeader';
import GuidedTour from '../components/GuidedTour';
import { openHelpModal, promptAppShare, runAfterTourAndIdle } from '../utils/ux';
import type { Step } from 'react-joyride';
import { RAFFLE_THEME_PRESETS, getThemeByName } from '../utils/raffleTheme';

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getEventTierLabel(totalNumbers: number) {
  if (totalNumbers <= 100) return 'Evento íntimo';
  if (totalNumbers <= 500) return 'Evento mediano';
  return 'Evento masivo';
}

function getEventTierDescription(totalNumbers: number) {
  if (totalNumbers <= 100) {
    return 'Ideal para cumpleaños, eventos privados, talleres o listas exclusivas.';
  }
  if (totalNumbers <= 500) {
    return 'Muy buena escala para fiestas medianas, peñas, presentaciones y salones.';
  }
  return 'Pensado para eventos con mucha circulación, equipos más grandes y alta demanda.';
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatEventDate(date: string, time: string) {
  if (!date || !time) return '-';
  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dt);
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar el blob de imagen.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressImageToTarget(
  file: File,
  options?: {
    maxKB?: number;
    maxWidth?: number;
    maxHeight?: number;
  },
): Promise<string> {
  const maxKB = options?.maxKB ?? 100;
  const maxWidth = options?.maxWidth ?? 1440;
  const maxHeight = options?.maxHeight ?? 1440;
  const targetBytes = maxKB * 1024;

  const originalDataUrl = await fileToDataUrl(file);
  const img = await loadImageElement(originalDataUrl);

  let width = img.width;
  let height = img.height;

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return originalDataUrl;

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  if (file.type === 'image/png') {
    const pngBlob = await canvasToBlob(canvas, 'image/png');
    if (pngBlob.size <= targetBytes) {
      return blobToDataUrl(pngBlob);
    }
  }

  let bestBlob: Blob | null = null;
  let quality = 0.9;

  for (let i = 0; i < 8; i += 1) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    bestBlob = blob;

    if (blob.size <= targetBytes) {
      return blobToDataUrl(blob);
    }

    quality -= 0.1;
    if (quality < 0.2) break;
  }

  if (bestBlob) {
    if (bestBlob.size <= targetBytes) {
      return blobToDataUrl(bestBlob);
    }
  }

  let currentCanvas = canvas;
  let currentWidth = width;
  let currentHeight = height;
  let finalBlob: Blob | null = bestBlob;

  for (let i = 0; i < 4; i += 1) {
    currentWidth = Math.max(320, Math.round(currentWidth * 0.85));
    currentHeight = Math.max(320, Math.round(currentHeight * 0.85));

    const resized = document.createElement('canvas');
    const resizedCtx = resized.getContext('2d');
    if (!resizedCtx) break;

    resized.width = currentWidth;
    resized.height = currentHeight;
    resizedCtx.drawImage(currentCanvas, 0, 0, currentWidth, currentHeight);
    currentCanvas = resized;

    for (const q of [0.75, 0.65, 0.55, 0.45, 0.35]) {
      const blob = await canvasToBlob(currentCanvas, 'image/jpeg', q);
      finalBlob = blob;
      if (blob.size <= targetBytes) {
        return blobToDataUrl(blob);
      }
    }
  }

  return finalBlob ? blobToDataUrl(finalBlob) : originalDataUrl;
}

type PrizeForm = {
  id: number;
  title: string;
  desc: string;
  video: string;
  image: string;
};

type EventType = 'general' | 'tables';

type FormState = {
  title: string;
  drawDateDate: string;
  drawDateTime: string;
  eventType: EventType;
  maxCapacity: string;
  tableCount: string;
  chairsPerTable: string;
  hasGuests: boolean;
  guestsPerTicket: number;
  isPaid: boolean;
  ticketPriceInput: string;
  desc: string;
  allowTransfer: boolean;
  transferAlias: string;
  allowCash: boolean;
  paymentLink: string;
  coverImage: string;
  themeName: string;
  themePrimaryColor: string;
  themeSecondaryColor: string;
  themeAccentColor: string;
  themeTextColor: string;
  themeCardColor: string;
};

const CAPACITY_PRESETS = [50, 100, 150, 200, 300, 500, 1000];
const TABLE_PRESETS = [10, 15, 20, 30, 40, 50];
const CHAIRS_PRESETS = [4, 5, 6, 8, 10];
const PRICE_PRESETS = [2000, 3000, 5000, 8000, 10000, 15000];

export default function CreateRaffle() {
  const navigate = useNavigate();

  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const desktopPublishButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobilePublishButtonRef = useRef<HTMLButtonElement | null>(null);
  const publishPulseTimeoutRef = useRef<number | null>(null);

  const [form, setForm] = useState<FormState>({
    title: '',
    drawDateDate: '',
    drawDateTime: '23:30',
    eventType: 'general',
    maxCapacity: '100',
    tableCount: '20',
    chairsPerTable: '5',
    hasGuests: false,
    guestsPerTicket: 1,
    isPaid: false,
    ticketPriceInput: '',
    desc: '',
    allowTransfer: false,
    transferAlias: '',
    allowCash: true,
    paymentLink: '',
    coverImage: '',
    themeName: 'classic',
    themePrimaryColor: '#fff159',
    themeSecondaryColor: '#3483fa',
    themeAccentColor: '#00a650',
    themeTextColor: '#0f172a',
    themeCardColor: '#ffffff',
  });

  const [prizes, setPrizes] = useState<PrizeForm[]>([
    { id: 1, title: '', desc: '', video: '', image: '' },
  ]);

  const [isCompressingCover, setIsCompressingCover] = useState(false);
  const [compressingPrizeId, setCompressingPrizeId] = useState<number | null>(null);
  const [publishPulse, setPublishPulse] = useState(false);

  useEffect(() => {
    const cleanup = runAfterTourAndIdle(
      () => {
        promptAppShare('create', window.location.origin);
      },
      { minDelayMs: 42000, idleMs: 20000, timeoutMs: 300000 },
    );

    return cleanup;
  }, []);

  useEffect(() => {
    return () => {
      if (publishPulseTimeoutRef.current) {
        window.clearTimeout(publishPulseTimeoutRef.current);
      }
    };
  }, []);

  const combinedEventDate = useMemo(() => {
    if (!form.drawDateDate || !form.drawDateTime) return '';
    return `${form.drawDateDate}T${form.drawDateTime}`;
  }, [form.drawDateDate, form.drawDateTime]);

  const effectiveCapacity = useMemo(() => {
    return form.eventType === 'general'
      ? toNumber(form.maxCapacity, 100)
      : toNumber(form.tableCount, 20);
  }, [form.eventType, form.maxCapacity, form.tableCount]);

  const estimatedAttendanceCapacity = useMemo(() => {
    if (form.eventType === 'tables') {
      return toNumber(form.tableCount, 0) * toNumber(form.chairsPerTable, 0);
    }

    return toNumber(form.maxCapacity, 0);
  }, [form.eventType, form.maxCapacity, form.tableCount, form.chairsPerTable]);

  const pricing = useMemo(() => {
    const ticketPrice = form.isPaid ? toNumber(form.ticketPriceInput, 0) : 0;
    const estimatedGoal = ticketPrice * effectiveCapacity;

    return {
      ticketPrice,
      estimatedGoal,
      totalCapacity: effectiveCapacity,
      tierLabel: getEventTierLabel(effectiveCapacity),
      tierDesc: getEventTierDescription(effectiveCapacity),
    };
  }, [form.isPaid, form.ticketPriceInput, effectiveCapacity]);

  const themePreview = useMemo(() => {
    return {
      primaryColor: form.themePrimaryColor,
      secondaryColor: form.themeSecondaryColor,
      accentColor: form.themeAccentColor,
      textColor: form.themeTextColor,
      cardColor: form.themeCardColor,
    };
  }, [
    form.themePrimaryColor,
    form.themeSecondaryColor,
    form.themeAccentColor,
    form.themeTextColor,
    form.themeCardColor,
  ]);

  const paymentMethodsSummary = useMemo(() => {
    if (!form.isPaid) return 'Acceso gratuito';

    const parts: string[] = [];
    if (form.allowCash) parts.push('Efectivo');
    if (form.allowTransfer) parts.push('Transferencia');
    if (form.paymentLink.trim()) parts.push('Link externo');

    return parts.length ? parts.join(' + ') : 'Sin métodos definidos';
  }, [form.isPaid, form.allowCash, form.allowTransfer, form.paymentLink]);

  const formattedEventDate = useMemo(() => {
    return formatEventDate(form.drawDateDate, form.drawDateTime);
  }, [form.drawDateDate, form.drawDateTime]);

  const cleanedPrizes = useMemo(() => {
    return prizes
      .map((p) => {
        const title = normalizeOptionalText(p.title);
        const desc = normalizeOptionalText(p.desc);
        const video = normalizeOptionalText(p.video);
        const image = p.image || undefined;

        return {
          ...(title ? { title } : {}),
          ...(desc ? { desc } : {}),
          ...(video ? { video } : {}),
          ...(image ? { image } : {}),
        };
      })
      .filter((p) => Object.keys(p).length > 0);
  }, [prizes]);

  const publicSummary = useMemo(() => {
    if (form.eventType === 'general') {
      return `${Number(form.maxCapacity || 0).toLocaleString('es-AR')} cupos max.`;
    }

    return `${Number(form.tableCount || 0).toLocaleString('es-AR')} mesas • ${Number(
      form.chairsPerTable || 0,
    ).toLocaleString('es-AR')} sillas c/u`;
  }, [form.eventType, form.maxCapacity, form.tableCount, form.chairsPerTable]);

  const tourSteps = [
    {
      target: '[data-tour="create-basics"]',
      title: 'Lo primero que van a ver',
      content: 'Definí el nombre, la fecha y la hora. Eso le da claridad inmediata al evento.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="create-type"]',
      title: 'Cómo va a reservar la gente',
      content: 'Elegí si el acceso es por cupo general o por mesas. También podés permitir acompañantes.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="create-pricing"]',
      title: 'Acceso y cobro',
      content: 'Decidí si el evento es gratuito o de pago y activá los métodos que quieras ofrecer.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="create-style"]',
      title: 'Lo visual importa',
      content: 'Un flyer claro y una buena combinación de colores hacen que el evento se comparta mejor.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="create-prizes"]',
      title: 'Secciones destacadas',
      content: 'Sumá beneficios, promos, artistas, consumiciones, imágenes o links de video que ayuden a convencer más rápido.',
      placement: 'top',
    },
    {
      target: '[data-tour="create-terms"]',
      title: 'Dejá todo claro',
      content: 'Ubicación, condiciones, horarios y reglas: cuanto más claro quede, menos mensajes vas a tener que responder.',
      placement: 'top',
    },
  ] satisfies Step[];

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const pulsePublishCta = () => {
    setPublishPulse(true);

    if (publishPulseTimeoutRef.current) {
      window.clearTimeout(publishPulseTimeoutRef.current);
    }

    publishPulseTimeoutRef.current = window.setTimeout(() => {
      setPublishPulse(false);
    }, 1600);
  };

  const focusPublishCta = () => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const btn = isDesktop ? desktopPublishButtonRef.current : mobilePublishButtonRef.current;

    pulsePublishCta();

    if (btn) {
      btn.scrollIntoView({
        behavior: 'smooth',
        block: isDesktop ? 'center' : 'nearest',
      });
      btn.focus();
    }
  };

  const triggerPublish = () => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const btn = isDesktop ? desktopPublishButtonRef.current : mobilePublishButtonRef.current;

    pulsePublishCta();
    btn?.click();
  };

  const handleImage = async (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingPrizeId(prizes[index].id);
      const compressed = await compressImageToTarget(file, {
        maxKB: 100,
        maxWidth: 1280,
        maxHeight: 1280,
      });

      const next = [...prizes];
      next[index].image = compressed;
      setPrizes(next);
    } catch {
      Swal.fire('Error', 'No se pudo procesar la imagen.', 'error');
    } finally {
      setCompressingPrizeId(null);
      e.target.value = '';
    }
  };

  const handleCoverImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingCover(true);
      const compressed = await compressImageToTarget(file, {
        maxKB: 100,
        maxWidth: 1440,
        maxHeight: 1440,
      });

      setField('coverImage', compressed);
    } catch {
      Swal.fire('Error', 'No se pudo procesar el flyer.', 'error');
    } finally {
      setIsCompressingCover(false);
      e.target.value = '';
    }
  };

  const applyThemePreset = (themeName: string) => {
    const theme = getThemeByName(themeName);
    setForm((prev) => ({
      ...prev,
      themeName: theme.name,
      themePrimaryColor: theme.primaryColor,
      themeSecondaryColor: theme.secondaryColor,
      themeAccentColor: theme.accentColor,
      themeTextColor: theme.textColor,
      themeCardColor: theme.cardColor,
    }));
  };

  const removePrize = (index: number) => {
    const next = [...prizes];
    next.splice(index, 1);
    setPrizes(next.length ? next : [{ id: Date.now(), title: '', desc: '', video: '', image: '' }]);
  };

  const validateBeforeSubmit = () => {
    if (!form.title.trim()) {
      Swal.fire('Aviso', 'Escribí un nombre claro para tu evento.', 'warning');
      return false;
    }

    if (!combinedEventDate) {
      Swal.fire('Aviso', 'Definí la fecha y la hora del evento.', 'warning');
      return false;
    }

    if (new Date(combinedEventDate).getTime() <= Date.now()) {
      Swal.fire('Aviso', 'La fecha del evento tiene que ser a futuro.', 'warning');
      return false;
    }

    if (form.eventType === 'general' && toNumber(form.maxCapacity) <= 0) {
      Swal.fire('Aviso', 'Ingresá un cupo máximo válido.', 'warning');
      return false;
    }

    if (
      form.eventType === 'tables' &&
      (toNumber(form.tableCount) <= 0 || toNumber(form.chairsPerTable) <= 0)
    ) {
      Swal.fire('Aviso', 'Ingresá una cantidad válida de mesas y sillas por mesa.', 'warning');
      return false;
    }

    if (form.isPaid) {
      if (pricing.ticketPrice <= 0) {
        Swal.fire(
          'Aviso',
          `Indicá el precio de la ${form.eventType === 'general' ? 'entrada' : 'mesa'}.`,
          'warning',
        );
        return false;
      }

      if (!form.allowCash && !form.allowTransfer && !form.paymentLink.trim()) {
        Swal.fire(
          'Aviso',
          'Si el evento es de pago, activá al menos una forma de cobro.',
          'warning',
        );
        return false;
      }

      if (form.allowTransfer && !form.transferAlias.trim()) {
        Swal.fire('Aviso', 'Cargá el alias o CBU para poder aceptar transferencias.', 'warning');
        return false;
      }

      if (form.paymentLink.trim() && !isValidUrl(form.paymentLink.trim())) {
        Swal.fire('Aviso', 'Revisá el link de pago. No parece una dirección válida.', 'warning');
        return false;
      }
    }

    const prizeWithErrors = prizes.find((p) => {
      const hasAnyContent =
        !!p.title.trim() || !!p.desc.trim() || !!p.video.trim() || !!p.image;

      if (!hasAnyContent) return false;

      if (!p.title.trim()) return true;

      if (p.video.trim() && !isValidUrl(p.video.trim())) return true;

      return false;
    });

    if (prizeWithErrors) {
      if (!prizeWithErrors.title.trim()) {
        Swal.fire(
          'Aviso',
          'Si completás una sección destacada, agregale también un título para que se vea bien en el evento.',
          'warning',
        );
        return false;
      }

      if (prizeWithErrors.video.trim() && !isValidUrl(prizeWithErrors.video.trim())) {
        Swal.fire(
          'Aviso',
          'Uno de los links de video no parece válido. Revisalo o dejalo vacío.',
          'warning',
        );
        return false;
      }
    }

    if (!form.desc.trim()) {
      Swal.fire('Aviso', 'Agregá la ubicación, reglas o información importante para tus invitados.', 'warning');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateBeforeSubmit()) return;

    try {
      Swal.fire({
        title: 'Preparando tu evento...',
        text: 'Estamos generando tu publicación y los accesos.',
        didOpen: () => Swal.showLoading(),
        background: '#ffffff',
        color: '#111827',
        allowOutsideClick: false,
      });

      const payload = {
        title: form.title.trim(),
        drawDate: combinedEventDate,

        eventType: form.eventType,
        maxCapacity: form.eventType === 'general' ? Number(form.maxCapacity) : undefined,
        tableCount: form.eventType === 'tables' ? Number(form.tableCount) : undefined,
        chairsPerTable: form.eventType === 'tables' ? Number(form.chairsPerTable) : undefined,

        allowGuests: form.hasGuests,
        guestsPerTicket: form.hasGuests ? Number(form.guestsPerTicket) : 0,

        isPaid: form.isPaid,
        ticketPrice: form.isPaid ? pricing.ticketPrice : 0,

        paymentLink: form.paymentLink.trim() || undefined,
        transferAlias:
          form.allowTransfer && form.transferAlias.trim() ? form.transferAlias.trim() : undefined,
        allowTransfer: form.isPaid ? form.allowTransfer : false,
        allowCash: form.isPaid ? form.allowCash : true,

        totalNumbers: Number(effectiveCapacity),
        estimatedAttendanceCapacity,
        desiredNetGoal: pricing.estimatedGoal.toString(),

        desc: form.desc.trim(),
        minDraw: '0',

        coverImage: form.coverImage || undefined,
        themeName: form.themeName,
        themePrimaryColor: form.themePrimaryColor,
        themeSecondaryColor: form.themeSecondaryColor,
        themeAccentColor: form.themeAccentColor,
        themeTextColor: form.themeTextColor,
        themeCardColor: form.themeCardColor,

        prizes: cleanedPrizes,
      };

      const { data } = await api.post('/raffles', payload);

      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('trackCustom', 'EventoCreado', {
          tier: pricing.tierLabel,
          price: pricing.ticketPrice,
          capacity: effectiveCapacity,
          eventType: form.eventType,
          isPaid: form.isPaid,
        });
      }

      Swal.fire({
        icon: 'success',
        title: '¡Tu evento ya está listo!',
        html: `
          <div style="text-align:left; font-size:14px;">
            <p style="margin-bottom:8px;"><b>${form.title}</b></p>
            <p><b>Formato:</b> ${form.eventType === 'general' ? 'Acceso general' : 'Mesas / boxes'}</p>
            <p><b>Capacidad:</b> ${Number(effectiveCapacity).toLocaleString('es-AR')} ${
              form.eventType === 'general' ? 'lugares' : 'mesas'
            }</p>
            <p><b>Aforo estimado:</b> ${Number(estimatedAttendanceCapacity).toLocaleString('es-AR')} personas</p>
            <p style="margin-top:8px; color:#059669; font-weight:bold;"><b>Valor:</b> ${form.isPaid ? `$${pricing.ticketPrice.toLocaleString('es-AR')}` : 'Gratis'}</p>
          </div>
        `,
        confirmButtonText: 'Ir a mi panel',
        confirmButtonColor: '#3483fa',
      }).then(() => navigate(`/dashboard/${data.id}`));
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message || 'Hubo un problema de conexión al crear el evento.',
        'error',
      );
    }
  };

  return (
    <>
      <GuidedTour storageKey="tour_create_event_v5" steps={tourSteps} />

      <main className="page-fade min-h-screen bg-slate-50 px-3 pt-2 pb-32 md:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-7xl w-full">
          <AppHeader
            title="Crear evento"
            subtitle="Completá lo importante, mirá cómo queda y publicalo cuando esté listo."
            showBack
            onBack={() => navigate('/')}
            rightSlot={
              <button
                type="button"
                onClick={() =>
                  openHelpModal(
                    'Cómo lograr que tu evento se comparta mejor',
                    `
                      <div style="text-align:left">
                        <p><b>1. Nombre claro:</b> usá el nombre real del evento y una fecha fácil de reconocer.</p>
                        <p><b>2. Menos dudas:</b> dejá bien visible lugar, horario, edad mínima y reglas para no responder lo mismo una y otra vez.</p>
                        <p><b>3. Imagen que invite:</b> un flyer prolijo mejora muchísimo el primer impacto y hace que el link se comparta mejor.</p>
                        <p><b>4. Cobro simple:</b> si el evento es pago, activá al menos una forma cómoda para reservar sin fricción.</p>
                        <p><b>5. Sumá beneficios:</b> DJs, promos, consumiciones, regalos o cualquier detalle que ayude a decidir más rápido.</p>
                      </div>
                    `,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-slate-200 bg-white text-[#3483fa] shadow-sm transition hover:bg-slate-50"
              >
                <i className="fas fa-lightbulb text-[15px]"></i>
              </button>
            }
          />

          <motion.form
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col items-stretch gap-5 lg:flex-row lg:gap-8"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex-1 w-full space-y-5 lg:space-y-6">
              <section data-tour="create-basics" className="mp-card p-4 lg:rounded-[2rem] lg:p-6">
                <div className="mb-4 flex items-center justify-between lg:mb-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                      Paso 1
                    </p>
                    <h2 className="mt-1 text-[20px] font-black text-slate-900 lg:text-[24px]">
                      Lo básico para arrancar
                    </h2>
                  </div>
                </div>

                <div className="space-y-4 lg:space-y-5">
                  <div>
                    <label className="mp-label lg:text-[13px]">Nombre del evento</label>
                    <input
                      type="text"
                      value={form.title}
                      placeholder="Ej: Cumple de Agus / Noche Retro / Fiesta de egresados"
                      onChange={(e) => setField('title', e.target.value)}
                      className="mp-input !text-[14px] lg:!text-[15px] lg:py-3.5"
                      maxLength={90}
                      required
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500 lg:text-[12px]">
                      Elegí un nombre claro. Eso ayuda a que el link se entienda y se comparta mejor.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:gap-4">
                    <div>
                      <label className="mp-label lg:text-[13px]">Fecha</label>
                      <div className="relative">
                        <input
                          ref={dateInputRef}
                          type="date"
                          value={form.drawDateDate}
                          onChange={(e) => setField('drawDateDate', e.target.value)}
                          className="mp-input pr-11 !text-[14px] lg:!text-[15px] lg:py-3.5"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => (dateInputRef.current as any)?.showPicker?.()}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[12px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa] transition hover:bg-[#d8e6fa]"
                        >
                          <i className="fas fa-calendar-days text-[13px] lg:text-[14px]"></i>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mp-label lg:text-[13px]">Hora</label>
                      <div className="relative">
                        <input
                          ref={timeInputRef}
                          type="time"
                          value={form.drawDateTime}
                          onChange={(e) => setField('drawDateTime', e.target.value)}
                          className="mp-input pr-11 !text-[14px] lg:!text-[15px] lg:py-3.5"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => (timeInputRef.current as any)?.showPicker?.()}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[12px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa] transition hover:bg-[#d8e6fa]"
                        >
                          <i className="fas fa-clock text-[13px] lg:text-[14px]"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-slate-200 bg-[#fafcff] p-3 lg:hidden">
                    <p className="text-[12px] font-black uppercase tracking-wide text-slate-500">
                      Resumen rápido
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-black text-slate-900">
                          {form.title || 'Evento sin nombre'}
                        </p>
                        <p className="text-[12px] text-slate-600">{formattedEventDate}</p>
                      </div>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">
                        {form.isPaid ? 'Pago' : 'Gratis'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section data-tour="create-type" className="mp-card p-4 lg:rounded-[2rem] lg:p-6">
                <div className="mb-4 flex items-center justify-between lg:mb-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                      Paso 2
                    </p>
                    <h2 className="mt-1 text-[20px] font-black text-slate-900 lg:text-[24px]">
                      Cómo va a entrar la gente
                    </h2>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-[#f5f7fb] px-3 py-1 text-[11px] font-bold text-slate-600 lg:text-[12px]">
                    {pricing.tierLabel}
                  </div>
                </div>

                <div className="space-y-4 lg:space-y-5">
                  <div>
                    <label className="mp-label mb-2.5 lg:text-[13px]">
                      ¿Qué formato vas a usar?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setField('eventType', 'general')}
                        className={`rounded-[16px] border p-3 text-left transition lg:rounded-[20px] lg:p-4 ${
                          form.eventType === 'general'
                            ? 'border-[#3483fa] bg-[#eaf2ff] shadow-sm ring-1 ring-[#3483fa]/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] lg:mb-3 lg:h-12 lg:w-12 lg:rounded-[14px] ${
                            form.eventType === 'general'
                              ? 'bg-[#3483fa] text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <i className="fas fa-users text-[16px] lg:text-[18px]"></i>
                        </div>
                        <p
                          className={`text-[13px] font-black lg:text-[15px] ${
                            form.eventType === 'general' ? 'text-[#3483fa]' : 'text-slate-700'
                          }`}
                        >
                          Cupo general
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 lg:text-[12px]">
                          Cada reserva representa un lugar individual.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setField('eventType', 'tables')}
                        className={`rounded-[16px] border p-3 text-left transition lg:rounded-[20px] lg:p-4 ${
                          form.eventType === 'tables'
                            ? 'border-[#3483fa] bg-[#eaf2ff] shadow-sm ring-1 ring-[#3483fa]/50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`mb-2 flex h-10 w-10 items-center justify-center rounded-[12px] lg:mb-3 lg:h-12 lg:w-12 lg:rounded-[14px] ${
                            form.eventType === 'tables'
                              ? 'bg-[#3483fa] text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <i className="fas fa-couch text-[16px] lg:text-[18px]"></i>
                        </div>
                        <p
                          className={`text-[13px] font-black lg:text-[15px] ${
                            form.eventType === 'tables' ? 'text-[#3483fa]' : 'text-slate-700'
                          }`}
                        >
                          Mesas o boxes
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 lg:text-[12px]">
                          Cada reserva representa una mesa o espacio completo.
                        </p>
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {form.eventType === 'general' ? (
                      <motion.div
                        key="general-mode"
                        initial={{ opacity: 0, height: 0, y: 8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-[18px] border border-slate-200 bg-white p-4 lg:rounded-[20px]">
                          <label className="mp-label lg:text-[13px]">
                            Capacidad máxima
                          </label>
                          <input
                            type="number"
                            value={form.maxCapacity}
                            onChange={(e) => setField('maxCapacity', e.target.value)}
                            className="mp-input mt-1.5 !text-[14px] lg:!text-[15px] lg:py-3.5"
                            placeholder="Ej: 300"
                            min="1"
                          />

                          <div className="mt-3 flex flex-wrap gap-2">
                            {CAPACITY_PRESETS.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setField('maxCapacity', String(n))}
                                className={`rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition lg:text-[12px] ${
                                  String(n) === form.maxCapacity
                                    ? 'border-[#3483fa] bg-[#3483fa] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="tables-mode"
                        initial={{ opacity: 0, height: 0, y: 8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 rounded-[18px] border border-slate-200 bg-white p-4 lg:rounded-[20px]">
                          <div className="grid grid-cols-2 gap-3 lg:gap-5">
                            <div>
                              <label className="mp-label lg:text-[13px]">
                                Cantidad de mesas
                              </label>
                              <input
                                type="number"
                                value={form.tableCount}
                                onChange={(e) => setField('tableCount', e.target.value)}
                                className="mp-input mt-1.5 !text-[14px] lg:!text-[15px] lg:py-3.5"
                                placeholder="Ej: 20"
                                min="1"
                              />
                            </div>
                            <div>
                              <label className="mp-label lg:text-[13px]">
                                Sillas por mesa
                              </label>
                              <input
                                type="number"
                                value={form.chairsPerTable}
                                onChange={(e) => setField('chairsPerTable', e.target.value)}
                                className="mp-input mt-1.5 !text-[14px] lg:!text-[15px] lg:py-3.5"
                                placeholder="Ej: 5"
                                min="1"
                              />
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-2">
                            <p className="mb-2.5 text-[11px] font-black uppercase tracking-wide text-slate-400 lg:text-[12px]">
                              Configuraciones rápidas
                            </p>
                            <div className="mb-2.5 flex flex-wrap gap-2">
                              {TABLE_PRESETS.map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setField('tableCount', String(n))}
                                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition lg:text-[12px] ${
                                    String(n) === form.tableCount
                                      ? 'border-[#3483fa] bg-[#3483fa] text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {n} mesas
                                </button>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {CHAIRS_PRESETS.map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setField('chairsPerTable', String(n))}
                                  className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition lg:text-[12px] ${
                                    String(n) === form.chairsPerTable
                                      ? 'border-[#3483fa] bg-[#3483fa] text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {n} sillas
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 rounded-[14px] border border-[#d7e7ff] bg-[#eef5ff] p-3.5">
                            <i className="fas fa-info-circle text-[18px] text-[#174ea6]"></i>
                            <p className="text-[13px] font-bold text-[#174ea6] lg:text-[14px]">
                              Aforo estimado: {estimatedAttendanceCapacity.toLocaleString('es-AR')} personas
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[14px] font-black text-slate-900 lg:text-[15px]">
                          ¿Permitir acompañantes?
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 lg:text-[13px]">
                          Útil si una misma persona va a reservar por más gente.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setField('hasGuests', !form.hasGuests)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                          form.hasGuests ? 'bg-[#3483fa]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            form.hasGuests ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {form.hasGuests && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: 6 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -6 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                            <label className="mb-2 flex items-center justify-between">
                              <span className="mp-label lg:text-[13px]">
                                Límite de acompañantes
                              </span>
                              <span className="text-[18px] font-black text-[#3483fa]">
                                +{form.guestsPerTicket}
                              </span>
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={form.guestsPerTicket}
                              onChange={(e) => setField('guestsPerTicket', Number(e.target.value))}
                              className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#3483fa]"
                            />
                            <p className="mt-3 text-[12px] font-medium text-slate-600">
                              Ejemplo visible en el ingreso: “Gómez + {form.guestsPerTicket}”.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </section>

              <section data-tour="create-pricing" className="mp-card p-4 lg:rounded-[2rem] lg:p-6">
                <div className="mb-4 flex items-center justify-between lg:mb-5">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                      Paso 3
                    </p>
                    <h2 className="mt-1 text-[20px] font-black text-slate-900 lg:text-[24px]">
                      Acceso y cobro
                    </h2>
                  </div>
                  <div
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold lg:text-[12px] ${
                      form.isPaid
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {form.isPaid ? 'Con costo' : 'Gratis'}
                  </div>
                </div>

                <div className="space-y-4 lg:space-y-5">
                  <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white p-4">
                    <div>
                      <p className="text-[14px] font-black text-slate-900 lg:text-[15px]">
                        ¿El acceso se cobra?
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500 lg:text-[13px]">
                        {form.isPaid
                          ? 'Activado. Las reservas van a requerir pago.'
                          : 'Desactivado. Va a funcionar como una lista o registro sin costo.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          isPaid: !prev.isPaid,
                          ticketPriceInput: !prev.isPaid ? prev.ticketPriceInput : '',
                        }))
                      }
                      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                        form.isPaid ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                          form.isPaid ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <AnimatePresence>
                    {form.isPaid && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: 8 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        className="overflow-hidden space-y-4"
                      >
                        <div className="rounded-[18px] border border-emerald-200 bg-emerald-50/50 p-4 lg:rounded-[20px] lg:p-5">
                          <label className="mb-2 block text-[12px] font-black uppercase tracking-wide text-emerald-700 lg:text-[13px]">
                            Precio de la {form.eventType === 'general' ? 'entrada' : 'mesa / box'}
                          </label>

                          <div className="relative flex items-center">
                            <span className="absolute left-4 z-10 text-[18px] font-bold text-emerald-700">
                              $
                            </span>
                            <input
                              type="number"
                              value={form.ticketPriceInput}
                              onChange={(e) => setField('ticketPriceInput', e.target.value)}
                              className="mp-input w-full !bg-white !pl-8 !text-[18px] !font-black !text-emerald-800 !border-emerald-200 shadow-inner focus:!border-emerald-500 focus:!ring-emerald-500/20 lg:!text-[20px] lg:py-4"
                              placeholder="Ej: 5000"
                              min="1"
                              required={form.isPaid}
                            />
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {PRICE_PRESETS.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setField('ticketPriceInput', String(n))}
                                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-sm transition lg:text-[12px] ${
                                  String(n) === form.ticketPriceInput
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                ${n.toLocaleString('es-AR')}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-slate-200 bg-white p-4 lg:rounded-[20px] lg:p-5">
                          <p className="mb-3 text-[14px] font-black text-slate-900 lg:text-[15px]">
                            ¿Cómo vas a cobrar?
                          </p>

                          <div className="space-y-3">
                            <label className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3.5 transition hover:bg-slate-100">
                              <input
                                type="checkbox"
                                checked={form.allowCash}
                                onChange={(e) => setField('allowCash', e.target.checked)}
                                className="h-4.5 w-4.5 rounded border-slate-300 text-[#3483fa] focus:ring-[#3483fa]"
                              />
                              <div className="flex flex-col">
                                <span className="text-[13px] font-bold text-slate-800 lg:text-[14px]">
                                  Efectivo
                                </span>
                                <span className="text-[11px] text-slate-500 lg:text-[12px]">
                                  Ideal para cobrar en puerta o en persona.
                                </span>
                              </div>
                            </label>

                            <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-50 transition-all focus-within:border-[#3483fa] focus-within:ring-1 focus-within:ring-[#3483fa]/20">
                              <label className="flex cursor-pointer items-center gap-3 p-3.5 transition hover:bg-slate-100">
                                <input
                                  type="checkbox"
                                  checked={form.allowTransfer}
                                  onChange={(e) => setField('allowTransfer', e.target.checked)}
                                  className="h-4.5 w-4.5 rounded border-slate-300 text-[#3483fa] focus:ring-[#3483fa]"
                                />
                                <div className="flex flex-col">
                                  <span className="text-[13px] font-bold text-slate-800 lg:text-[14px]">
                                    Transferencia
                                  </span>
                                  <span className="text-[11px] text-slate-500 lg:text-[12px]">
                                    Cobrás directo a tu alias o CBU.
                                  </span>
                                </div>
                              </label>

                              <AnimatePresence>
                                {form.allowTransfer && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                  >
                                    <div className="px-3.5 pb-3.5 pt-1">
                                      <input
                                        type="text"
                                        value={form.transferAlias}
                                        onChange={(e) => setField('transferAlias', e.target.value)}
                                        placeholder="Ingresá tu alias o CBU"
                                        className="w-full rounded-[10px] border border-slate-300 p-2.5 text-[13px] focus:border-[#3483fa] focus:outline-none"
                                        required={form.allowTransfer}
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            <label className="flex flex-col gap-2 rounded-[14px] border border-slate-200 bg-slate-50 p-3.5 transition hover:bg-slate-100 focus-within:border-[#3483fa] focus-within:ring-1 focus-within:ring-[#3483fa]/20">
                              <div className="flex items-center gap-3">
                                <i className="fas fa-link w-4.5 text-center text-[16px] text-[#3483fa]"></i>
                                <div className="flex flex-col">
                                  <span className="text-[13px] font-bold text-slate-800 lg:text-[14px]">
                                    Link de pago externo
                                  </span>
                                  <span className="text-[11px] text-slate-500 lg:text-[12px]">
                                    Si usás Mercado Pago, Eventbrite u otra plataforma.
                                  </span>
                                </div>
                              </div>
                              <input
                                type="url"
                                value={form.paymentLink}
                                onChange={(e) => setField('paymentLink', e.target.value)}
                                placeholder="https://..."
                                className="w-full rounded-[10px] border border-slate-300 p-2.5 text-[13px] focus:border-[#3483fa] focus:outline-none"
                              />
                            </label>
                          </div>
                        </div>

                        {toNumber(form.ticketPriceInput) > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="flex items-center justify-between overflow-hidden rounded-[18px] border border-[#d9e7ff] bg-[#eef5ff] p-4 lg:rounded-[20px] lg:p-5"
                          >
                            <div>
                              <p className="text-[12px] font-black uppercase tracking-wide text-[#174ea6] lg:text-[13px]">
                                Proyección bruta
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#174ea6]/70 lg:text-[12px]">
                                Estimación si completás toda la capacidad
                              </p>
                            </div>
                            <p className="text-[24px] font-black text-[#174ea6] lg:text-[28px]">
                              ${pricing.estimatedGoal.toLocaleString('es-AR')}
                            </p>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              <section data-tour="create-style" className="mp-card p-4 lg:rounded-[2rem] lg:p-6">
                <div className="mb-4 lg:mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                      Paso 4
                    </p>
                    <h2 className="mt-1 text-[20px] font-black text-slate-900 lg:text-[24px]">
                      Imagen y estilo
                    </h2>
                  </div>
                </div>

                <div className="space-y-5 lg:space-y-6">
                  <div>
                    <label className="mp-label lg:text-[13px]">Flyer o portada</label>
                    <label className="group mt-1 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-[14px] font-bold text-slate-600 transition hover:border-[#3483fa] hover:bg-slate-100">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full ${
                          form.coverImage
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-white text-[#3483fa] shadow-sm transition-transform group-hover:scale-110'
                        }`}
                      >
                        <i
                          className={`fas text-[20px] ${
                            form.coverImage ? 'fa-check' : 'fa-cloud-arrow-up'
                          }`}
                        ></i>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-slate-900">
                          {isCompressingCover
                            ? 'Optimizando imagen...'
                            : form.coverImage
                            ? '¡Portada lista!'
                            : 'Tocá acá para subir una imagen'}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-slate-500">
                          Recomendamos formato vertical o cuadrado.
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverImage}
                        className="hidden"
                        disabled={isCompressingCover}
                      />
                    </label>

                    {form.coverImage && (
                      <div className="relative mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
                        <img
                          src={form.coverImage}
                          alt="Flyer cargado"
                          className="h-48 w-full object-cover lg:h-56"
                        />
                        <button
                          type="button"
                          onClick={() => setField('coverImage', '')}
                          className="absolute top-3 right-3 rounded-full bg-white/90 p-2.5 text-red-500 shadow-md transition hover:scale-105 hover:bg-red-50"
                          title="Eliminar imagen"
                        >
                          <i className="fas fa-trash text-[14px]"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <label className="mp-label mb-3 lg:text-[13px]">
                      Paleta de colores
                    </label>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                      {RAFFLE_THEME_PRESETS.map((theme) => (
                        <button
                          key={theme.name}
                          type="button"
                          onClick={() => applyThemePreset(theme.name)}
                          className={`relative overflow-hidden rounded-[16px] border p-3.5 text-left transition lg:rounded-[20px] lg:p-4 ${
                            form.themeName === theme.name
                              ? 'border-[#3483fa] ring-1 ring-[#3483fa]/50 shadow-sm'
                              : 'border-slate-200 bg-slate-50 hover:bg-white'
                          }`}
                        >
                          {form.themeName === theme.name && (
                            <div className="absolute top-0 left-0 h-1 w-full bg-[#3483fa]"></div>
                          )}
                          <div className="mb-3 flex items-center gap-1.5">
                            {[theme.primaryColor, theme.secondaryColor, theme.accentColor].map(
                              (color, idx) => (
                                <span
                                  key={idx}
                                  className="h-5 w-5 rounded-full border border-black/10 shadow-sm lg:h-6 lg:w-6"
                                  style={{ backgroundColor: color }}
                                />
                              ),
                            )}
                          </div>
                          <p className="text-[13px] font-black text-slate-900 lg:text-[14px]">
                            {theme.label}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section data-tour="create-prizes" className="mp-card p-4 lg:rounded-[2rem] lg:p-6">
                <div className="mb-4 lg:mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                      Paso 5 (Opcional)
                    </p>
                    <h2 className="mt-1 text-[20px] font-black text-slate-900 lg:text-[24px]">
                      Secciones destacadas
                    </h2>
                  </div>
                </div>
                <p className="mb-5 text-[13px] text-slate-500">
                  Sumá promos, artistas, regalos, beneficios, consumiciones, imágenes o un video teaser para que el evento se vea más tentador.
                </p>

                <div className="space-y-4 lg:space-y-5">
                  {prizes.map((p, i) => (
                    <div
                      key={p.id}
                      className="group relative rounded-[20px] border border-slate-200 bg-[#f8fafc] p-4 lg:p-5"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-[14px] font-black text-slate-900 lg:text-[16px]">
                          Bloque #{i + 1}
                        </p>
                        {i > 0 && (
                          <button
                            type="button"
                            onClick={() => removePrize(i)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-red-500 transition hover:bg-red-50"
                          >
                            <i className="fas fa-trash mr-1.5"></i> Quitar
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 lg:gap-5">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
                          <div>
                            <label className="mp-label lg:text-[13px]">
                              Título
                            </label>
                            <input
                              type="text"
                              placeholder="Ej: 2x1 en barra / DJ invitado / Promo lanzamiento"
                              value={p.title}
                              onChange={(e) => {
                                const next = [...prizes];
                                next[i].title = e.target.value;
                                setPrizes(next);
                              }}
                              className="mp-input mt-1 !text-[14px] lg:!text-[15px] lg:py-3.5"
                            />
                          </div>

                          <div>
                            <label className="mp-label lg:text-[13px]">
                              Descripción breve
                            </label>
                            <input
                              type="text"
                              placeholder="Ej: Hasta las 02:00 mostrando tu pulsera."
                              value={p.desc}
                              onChange={(e) => {
                                const next = [...prizes];
                                next[i].desc = e.target.value;
                                setPrizes(next);
                              }}
                              className="mp-input mt-1 !text-[14px] lg:!text-[15px] lg:py-3.5"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mp-label lg:text-[13px]">
                            Link de video (opcional)
                          </label>
                          <input
                            type="url"
                            placeholder="Ej: https://youtube.com/... o https://instagram.com/..."
                            value={p.video}
                            onChange={(e) => {
                              const next = [...prizes];
                              next[i].video = e.target.value;
                              setPrizes(next);
                            }}
                            className="mp-input mt-1 !text-[14px] lg:!text-[15px] lg:py-3.5"
                          />
                          <p className="mt-1.5 text-[11px] text-slate-500 lg:text-[12px]">
                            Si lo dejás vacío no se manda. Si lo completás, tiene que ser una URL válida.
                          </p>
                        </div>

                        <div>
                          <label className="mp-label lg:text-[13px]">
                            Imagen de refuerzo (opcional)
                          </label>
                          <div className="mt-1 flex items-start gap-4">
                            <label className="flex flex-1 cursor-pointer items-center justify-center gap-3 rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-3.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50">
                              <i
                                className={`fas ${
                                  p.image ? 'fa-check-circle text-emerald-600' : 'fa-camera text-[#3483fa]'
                                } text-[16px]`}
                              ></i>
                              {compressingPrizeId === p.id
                                ? 'Procesando...'
                                : p.image
                                ? 'Imagen lista'
                                : 'Tocar para subir imagen'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImage(e, i)}
                                className="hidden"
                                disabled={compressingPrizeId === p.id}
                              />
                            </label>

                            {p.image && (
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] border border-slate-200 lg:h-16 lg:w-16">
                                <img src={p.image} alt="Refuerzo" className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...prizes];
                                    next[i].image = '';
                                    setPrizes(next);
                                  }}
                                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition hover:opacity-100"
                                >
                                  <i className="fas fa-trash text-[12px] text-white"></i>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPrizes([...prizes, { id: Date.now(), title: '', desc: '', video: '', image: '' }])
                  }
                  className="mp-btn-secondary mt-5 w-full !py-3.5 !text-[14px] lg:!text-[15px]"
                >
                  <i className="fas fa-plus"></i> Agregar otra sección destacada
                </button>
              </section>

              <section data-tour="create-terms" className="mp-card p-4 lg:rounded-[2rem] lg:p-6">
                <div className="mb-4 lg:mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                      Paso 6
                    </p>
                    <h2 className="mt-1 text-[20px] font-black text-slate-900 lg:text-[24px]">
                      Información clave para invitados
                    </h2>
                  </div>
                </div>

                <textarea
                  value={form.desc}
                  placeholder="Ej: El evento es en Av. San Martín 123. Acceso solo para +18 con DNI físico. Dress code elegante sport. Se permite ingreso hasta las 02:30 AM. Si reservás mesa, se mantiene hasta las 23:30..."
                  onChange={(e) => setField('desc', e.target.value)}
                  className="mp-input min-h-[140px] resize-y p-4 !text-[14px] lg:!text-[15px]"
                  required
                />

                <div className="mt-3 flex items-start gap-3 rounded-[12px] border border-amber-200 bg-amber-50 p-3">
                  <i className="fas fa-info-circle mt-0.5 text-amber-600"></i>
                  <p className="text-[12px] font-medium text-amber-800 lg:text-[13px]">
                    Cuanto más claro quede acá, menos dudas vas a recibir después por WhatsApp o Instagram.
                  </p>
                </div>
              </section>
            </div>

            <div className="w-full shrink-0 lg:w-[380px] xl:w-[420px]">
              <div className="flex flex-col gap-4 pb-6 lg:sticky lg:top-[120px]">
                <section className="mp-card overflow-hidden p-0 shadow-sm lg:rounded-[24px]">
                  <div className="px-4 pt-4 pb-2 lg:px-5 lg:pt-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa] lg:text-[12px]">
                          Vista en vivo
                        </p>
                        <h2 className="text-[18px] font-black leading-tight text-slate-900 lg:text-[20px]">
                          Así lo va a ver tu público
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={focusPublishCta}
                        className="shrink-0 rounded-full border border-[#d7e7ff] bg-[#eef5ff] px-3 py-1.5 text-[11px] font-bold text-[#174ea6] transition hover:bg-[#e1eeff]"
                      >
                        Publicar
                      </button>
                    </div>

                    <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                      Si tocás esta vista, te llevo directo al botón final para publicarlo.
                    </p>
                  </div>

                  <div className="px-4 pt-0 pb-4 lg:px-5 lg:pb-5">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={focusPublishCta}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          focusPublishCta();
                        }
                      }}
                      className="cursor-pointer overflow-hidden rounded-[20px] border border-black/5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_24px_60px_rgba(15,23,42,0.16)] focus:outline-none focus:ring-2 focus:ring-[#3483fa]/30"
                      style={{
                        background: `linear-gradient(135deg, ${themePreview.primaryColor} 0%, ${themePreview.secondaryColor} 100%)`,
                        color: themePreview.textColor,
                      }}
                    >
                      <div className="relative">
                        {form.coverImage ? (
                          <img
                            src={form.coverImage}
                            alt="Preview del evento"
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-40 w-full items-center justify-center px-6 text-center"
                            style={{
                              background: `linear-gradient(135deg, ${themePreview.primaryColor} 0%, ${themePreview.secondaryColor} 100%)`,
                            }}
                          >
                            <div>
                              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/20 shadow-sm backdrop-blur">
                                <i className="fas fa-ticket-alt text-[20px]"></i>
                              </div>
                              <p className="text-[15px] font-black">Tu flyer se va a ver acá</p>
                              <p className="mt-1 text-[11px] opacity-80">
                                Subí una imagen atractiva en el paso 4.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur">
                            {form.isPaid ? 'De pago' : 'Gratis'}
                          </span>
                          <span className="rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-sm">
                            {form.eventType === 'general' ? 'Cupos' : 'Mesas'}
                          </span>
                        </div>
                      </div>

                      <div
                        className="p-4 transition-colors duration-500"
                        style={{
                          backgroundColor: themePreview.cardColor,
                          color: themePreview.textColor,
                        }}
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h3 className="truncate-2-lines text-[18px] font-black leading-[1.1]">
                              {form.title || 'Nombre del evento'}
                            </h3>
                            <p className="mt-1.5 text-[12px] font-medium opacity-80">
                              <i className="fas fa-calendar-alt mr-1"></i> {formattedEventDate}
                            </p>
                          </div>

                          <div
                            className="shrink-0 rounded-[12px] px-3 py-2 text-right shadow-sm"
                            style={{ backgroundColor: `${themePreview.accentColor}22` }}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
                              Ingreso
                            </p>
                            <p className="mt-0.5 text-[15px] font-black">
                              {form.isPaid
                                ? `$${pricing.ticketPrice.toLocaleString('es-AR')}`
                                : 'Gratis'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div
                            className="rounded-[14px] p-3"
                            style={{ backgroundColor: `${themePreview.secondaryColor}15` }}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
                              Reserva de
                            </p>
                            <p className="mt-1 text-[12px] font-black">
                              {form.eventType === 'general' ? 'Lugar general' : 'Mesa entera'}
                            </p>
                          </div>

                          <div
                            className="rounded-[14px] p-3"
                            style={{ backgroundColor: `${themePreview.accentColor}15` }}
                          >
                            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
                              Disponibilidad
                            </p>
                            <p className="mt-1 text-[12px] font-black">{publicSummary}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerPublish();
                          }}
                          className="mt-4 w-full rounded-[14px] px-4 py-3 text-[14px] font-black text-white shadow-md transition-transform hover:scale-[1.02]"
                          style={{ backgroundColor: themePreview.accentColor }}
                        >
                          {form.isPaid ? 'Publicar evento' : 'Crear evento'}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 lg:text-[12px]">
                        Revisión final
                      </p>
                      <p className="mt-1 text-[12px] text-slate-500">
                        Antes de publicar, chequeá que lo importante ya esté claro.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {pricing.tierDesc}
                    </span>
                  </div>

                  <div className="space-y-2 text-[12px] font-medium text-slate-600">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                      <span>Evento</span>
                      <b className="max-w-[150px] truncate text-right text-slate-900">
                        {form.title || '-'}
                      </b>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                      <span>Aforo estimado</span>
                      <b className="text-slate-900">
                        {Number(estimatedAttendanceCapacity).toLocaleString('es-AR')} pers.
                      </b>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                      <span>Acompañantes</span>
                      <b className="text-slate-900">
                        {form.hasGuests ? `+${form.guestsPerTicket} por titular` : 'No'}
                      </b>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5">
                      <span>Cobro</span>
                      <b className="max-w-[140px] truncate text-right text-slate-900">
                        {paymentMethodsSummary}
                      </b>
                    </div>

                    {form.isPaid && pricing.estimatedGoal > 0 && (
                      <div className="flex items-center justify-between gap-3 pt-1.5">
                        <span className="font-bold text-emerald-700">Proyección bruta</span>
                        <b className="text-[14px] font-black text-emerald-700">
                          ${pricing.estimatedGoal.toLocaleString('es-AR')}
                        </b>
                      </div>
                    )}
                  </div>

                  <button
                    ref={desktopPublishButtonRef}
                    type="submit"
                    className={`mt-4 w-full rounded-[16px] py-3 text-[15px] font-black text-white transition ${
                      publishPulse ? 'scale-[1.02] ring-4 ring-[#3483fa]/20' : ''
                    } bg-[#3483fa] shadow-[0_12px_24px_rgba(52,131,250,0.3)] hover:-translate-y-0.5 hover:bg-blue-600`}
                  >
                    <i className="fas fa-rocket mr-2"></i>
                    Crear y publicar evento
                  </button>

                  <p className="mt-2 text-center text-[10px] text-slate-400">
                    Después vas a poder editar, pausar o volver a compartir el link.
                  </p>
                </div>
              </div>
            </div>
          </motion.form>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white px-4 text-[14px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Volver
          </button>

          <button
            ref={mobilePublishButtonRef}
            type="button"
            onClick={() => triggerPublish()}
            className={`flex-1 rounded-[16px] bg-[#3483fa] py-3.5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(52,131,250,0.3)] transition hover:bg-blue-600 ${
              publishPulse ? 'scale-[1.02] ring-4 ring-[#3483fa]/20' : ''
            }`}
          >
            <i className="fas fa-rocket mr-2"></i>
            Publicar evento
          </button>
        </div>
      </div>
    </>
  );
}