import { useEffect, useMemo, useRef, useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import GuidedTour from '../components/GuidedTour';
import {
  copyText,
  openHelpModal,
  openWhatsAppShare,
  promptAppShare,
  runAfterTourAndIdle,
} from '../utils/ux';
import type { Step } from 'react-joyride';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);

type RecentFilter = 'recent' | 'all';

type SelectedRecord =
  | {
      type: 'validation' | 'recent';
      data: any;
    }
  | null;

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeQrToken(rawValue?: string | null) {
  const raw = String(rawValue || '').trim();

  if (!raw) return '';

  if (raw.startsWith('PL|ACCESS|')) {
    return raw.replace(/^PL\|ACCESS\|/i, '').trim();
  }

  try {
    const url = new URL(raw);
    const tokenFromQuery =
      url.searchParams.get('qrToken') ||
      url.searchParams.get('token') ||
      url.searchParams.get('accessToken');

    if (tokenFromQuery) {
      return tokenFromQuery.trim();
    }
  } catch {
    //
  }

  return raw;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Fecha no disponible';
  return new Date(value).toLocaleString('es-AR');
}

function normalizePhoneForWhatsApp(phone?: string | null) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!digits.startsWith('54')) {
    digits = `54${digits}`;
  }

  return digits;
}

function getModeLabel(raffle: any) {
  if (String(raffle?.mode || '').toLowerCase() === 'seated') {
    return 'Evento con ubicaciones';
  }

  return 'Evento por lista / entradas';
}

function getAccessStatusMeta(status?: string | null) {
  switch (String(status || '')) {
    case 'approved':
      return {
        title: 'Acceso válido',
        label: 'Puede ingresar',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        cardClassName: 'border-emerald-200 bg-emerald-50/70',
        dotClassName: 'bg-emerald-500',
        description: 'La entrada está aprobada y se puede registrar el ingreso.',
        isApproved: true,
      };

    case 'pending':
      return {
        title: 'Acceso pendiente',
        label: 'Pendiente de confirmación',
        className: 'bg-amber-100 text-amber-700 border border-amber-200',
        cardClassName: 'border-amber-200 bg-amber-50/70',
        dotClassName: 'bg-amber-500',
        description: 'Todavía no está confirmado. No corresponde dejar pasar.',
        isApproved: false,
      };

    case 'rejected':
      return {
        title: 'Acceso no habilitado',
        label: 'Rechazado',
        className: 'bg-rose-100 text-rose-700 border border-rose-200',
        cardClassName: 'border-rose-200 bg-rose-50/70',
        dotClassName: 'bg-rose-500',
        description: 'La solicitud fue rechazada o quedó anulada.',
        isApproved: false,
      };

    case 'already_used':
      return {
        title: 'Acceso ya utilizado',
        label: 'Ya ingresó',
        className: 'bg-slate-200 text-slate-700 border border-slate-300',
        cardClassName: 'border-slate-300 bg-slate-50/80',
        dotClassName: 'bg-slate-500',
        description: 'Ese acceso ya fue usado anteriormente.',
        isApproved: false,
      };

    case 'wrong_event':
      return {
        title: 'Acceso de otro evento',
        label: 'No corresponde acá',
        className: 'bg-orange-100 text-orange-700 border border-orange-200',
        cardClassName: 'border-orange-200 bg-orange-50/80',
        dotClassName: 'bg-orange-500',
        description: 'Ese código o QR pertenece a otro evento.',
        isApproved: false,
      };

    case 'not_found':
      return {
        title: 'No encontrado',
        label: 'Sin coincidencias',
        className: 'bg-rose-100 text-rose-700 border border-rose-200',
        cardClassName: 'border-rose-200 bg-rose-50/70',
        dotClassName: 'bg-rose-500',
        description: 'No encontramos un acceso válido con esos datos.',
        isApproved: false,
      };

    case 'checked_in':
      return {
        title: 'Ingreso registrado',
        label: 'Ya adentro',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        cardClassName: 'border-emerald-200 bg-emerald-50/70',
        dotClassName: 'bg-emerald-500',
        description: 'El ingreso ya fue registrado correctamente.',
        isApproved: false,
      };

    default:
      return {
        title: 'Estado',
        label: status || 'Sin estado',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        cardClassName: 'border-slate-200 bg-slate-50/70',
        dotClassName: 'bg-slate-400',
        description: 'Estado no identificado.',
        isApproved: false,
      };
  }
}

function getValidationBadge(result: any) {
  if (!result) return getAccessStatusMeta();
  return getAccessStatusMeta(result?.status);
}

function getPaymentMethodLabel(method?: string | null) {
  if (method === 'transfer') return 'Transferencia';
  if (method === 'cash') return 'Efectivo';
  if (method === 'link') return 'Link de pago';
  return 'No informado';
}

function getDisplayName(record: any) {
  return (
    record?.item?.attendeeName ||
    record?.attendeeName ||
    record?.purchase?.buyerName ||
    record?.buyerName ||
    'Sin nombre'
  );
}

function getDisplayPhone(record: any) {
  return (
    record?.item?.attendeePhone ||
    record?.attendeePhone ||
    record?.purchase?.buyerPhone ||
    record?.buyerPhone ||
    ''
  );
}

function getDisplayEmail(record: any) {
  return (
    record?.item?.attendeeEmail ||
    record?.attendeeEmail ||
    record?.purchase?.buyerEmail ||
    record?.buyerEmail ||
    ''
  );
}

function getAccessCode(record: any) {
  return (
    record?.item?.accessCode ||
    record?.accessCode ||
    record?.purchase?.accessCode ||
    ''
  );
}

function getTicketNumber(record: any) {
  return record?.item?.ticketNumber || record?.ticketNumber || '';
}

function getSeatSummary(record: any, raffle: any) {
  const seatLabel = record?.item?.seatLabel || record?.seatLabel || null;
  const sectionLabel = record?.item?.sectionLabel || record?.sectionLabel || null;
  const tableLabel = record?.item?.tableLabel || record?.tableLabel || null;

  const parts = [tableLabel, sectionLabel, seatLabel].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' · ');
  }

  if (getTicketNumber(record)) {
    return `Entrada ${getTicketNumber(record)}`;
  }

  if (String(raffle?.mode || '').toLowerCase() === 'seated') {
    return 'Ubicación no informada';
  }

  return 'Acceso general';
}

function getSearchableText(record: any, raffle: any) {
  return [
    getDisplayName(record),
    getDisplayPhone(record),
    getDisplayEmail(record),
    getAccessCode(record),
    getTicketNumber(record),
    getSeatSummary(record, raffle),
    record?.status,
    record?.purchase?.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getBarcodeDetectorClass() {
  return (window as any).BarcodeDetector || null;
}

export default function DashboardDoor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useContext(AuthContext);

  const [raffle, setRaffle] = useState<any>(null);
  const [accessibleRaffle, setAccessibleRaffle] = useState<any>(null);
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [validationValue, setValidationValue] = useState('');
  const [validating, setValidating] = useState(false);

  const [recentFilter, setRecentFilter] = useState<RecentFilter>('recent');
  const [searchTerm, setSearchTerm] = useState('');

  const [lastValidation, setLastValidation] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerMessage, setScannerMessage] = useState('Preparando cámara...');

  const fetchTimeoutRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerTimerRef = useRef<any>(null);
  const validationInputRef = useRef<HTMLInputElement | null>(null);

  const isFinished = raffle?.status === 'finished';
  const title = useMemo(() => raffle?.title || 'Control de acceso', [raffle]);

  const confirmedCount = useMemo(() => {
    const tickets = Array.isArray(raffle?.tickets) ? raffle.tickets : [];
    return tickets.filter((t: any) => String(t?.status) === 'sold').length;
  }, [raffle]);

  const pendingCount = useMemo(() => {
    const tickets = Array.isArray(raffle?.tickets) ? raffle.tickets : [];
    return tickets.filter((t: any) => String(t?.status) === 'pending').length;
  }, [raffle]);

  const availableCount = useMemo(() => {
    const tickets = Array.isArray(raffle?.tickets) ? raffle.tickets : [];
    return tickets.filter((t: any) => String(t?.status) === 'available').length;
  }, [raffle]);

  const capacity = useMemo(() => {
    return (
      toInt(raffle?.totalNumbers, 0) ||
      toInt(raffle?.maxCapacity, 0) ||
      toInt(raffle?.capacity, 0) ||
      0
    );
  }, [raffle]);

  const confirmedPercent = useMemo(() => {
    if (!capacity) return 0;
    return Math.min(100, Math.round((confirmedCount / capacity) * 100));
  }, [confirmedCount, capacity]);

  const filteredRecentCheckins = useMemo(() => {
    let base = [...recentCheckins];

    if (recentFilter === 'recent') {
      base = base.slice(0, 20);
    }

    const term = searchTerm.trim().toLowerCase();

    if (!term) return base;

    return base.filter((record) => getSearchableText(record, raffle).includes(term));
  }, [recentCheckins, recentFilter, searchTerm, raffle]);

  const currentValidationMeta = useMemo(
    () => getValidationBadge(lastValidation),
    [lastValidation],
  );

  const tourSteps = [
    {
      target: '[data-tour="door-validator"]',
      title: 'Escanear es tu prioridad',
      content:
        'Toda la gestión de puerta empieza acá. Tocá para abrir la cámara o ingresá un código rápido.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="door-last-result"]',
      title: 'Validación en 1 clic',
      content:
        'Cuando leas un código, vas a ver su estado al instante. Si está verde, un solo toque más y ya queda registrado su ingreso.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="door-stats"]',
      title: 'Tu resumen',
      content:
        'Acá abajo podés ir pispeando cómo viene la ocupación del evento mientras dejás pasar a la gente.',
      placement: 'top',
    },
  ] satisfies Step[];

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      const config = { timeout: 60000 };

      const [publicRaffle, myRaffles, recent] = await Promise.all([
        api.get(`/raffles/${id}`, config).then((r) => r.data),
        api.get('/access/my-raffles', config).then((r) => r.data),
        api.get(`/access/raffle/${id}/recent-checkins`, config).then((r) => r.data),
      ]);

      const matched =
        (Array.isArray(myRaffles)
          ? myRaffles.find((item: any) => {
              const raffleId = item?.raffle?.id || item?.id;
              return String(raffleId) === String(id);
            })
          : null) || null;

      setRaffle(publicRaffle);
      setAccessibleRaffle(matched);
      setRecentCheckins(Array.isArray(recent) ? recent : []);
    } catch (error: any) {
      console.error('Error cargando dashboard de acceso:', error);

      if (error?.response?.status === 401) {
        navigate('/', { replace: true });
        return;
      }

      if (error?.response?.status === 403) {
        Swal.fire(
          'Sin acceso',
          'Tu usuario no tiene permiso para operar la puerta de este evento.',
          'error',
        );
        navigate('/', { replace: true });
        return;
      }

      Swal.fire(
        'Error',
        error?.response?.data?.message || 'No se pudo cargar el panel de acceso.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  const scheduleReload = () => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    fetchTimeoutRef.current = setTimeout(() => {
      loadData();
    }, 700);
  };

  const stopScanner = () => {
    if (scannerTimerRef.current) {
      clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }

    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }

    const videoEl = videoRef.current;
    if (videoEl) {
      try {
        (videoEl as any).srcObject = null;
      } catch {
        //
      }
    }

    setScannerReady(false);
  };

  const executeValidation = async (
    consumeEntry: boolean,
    forcedValue?: string,
    isQrMode: boolean = false,
  ) => {
    if (!id) return;

    const rawValue = String(forcedValue ?? validationValue ?? '').trim();
    const cleanValue = isQrMode ? normalizeQrToken(rawValue) : rawValue;

    if (!cleanValue) {
      Swal.fire(
        'Falta un dato',
        'Escribí el código o escaneá un QR para poder validar.',
        'warning',
      );
      return;
    }

    try {
      setValidating(true);

      const payload = isQrMode
        ? {
            raffleId: id,
            qrToken: cleanValue,
            consumeEntry,
          }
        : {
            raffleId: id,
            accessCode: cleanValue,
            consumeEntry,
          };

      const endpoint = isQrMode ? '/access/validate-qr' : '/access/validate-code';

      const { data } = await api.post(endpoint, payload);

      setLastValidation(data);
      
      // Si el usuario acaba de ingresar el código, lo mantenemos en el input por si quiere volver a tocar algo.
      if (!isQrMode) {
         setValidationValue(cleanValue);
      }

      if (data?.ok && data?.allowEntry && consumeEntry) {
        setValidationValue('');
        setLastValidation(null); // Limpiamos la última validación porque ya entró

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Ingreso registrado correctamente',
          showConfirmButton: false,
          timer: 1700,
          background: '#ffffff',
          color: '#111827',
        });

        await loadData();
        return;
      }

      if (data?.ok && data?.allowEntry && !consumeEntry) {
        // Si el QR está ok, hacemos scroll automático a la vista del resultado (muy útil en mobile)
        setTimeout(() => {
           document.getElementById('door-last-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        // Si fue rechazado, mostramos el modal para que quede súper claro y no deje pasar
        Swal.fire({
          icon:
            data?.status === 'pending'
              ? 'warning'
              : data?.status === 'approved'
              ? 'success'
              : 'error',
          title: getValidationBadge(data).title,
          text: data?.message || getValidationBadge(data).description,
          confirmButtonColor: '#3483fa',
          background: '#ffffff',
          color: '#111827',
        });
      }
    } catch (error: any) {
      console.error('Error validando acceso:', error);

      Swal.fire(
        'Error',
        error?.response?.data?.message || 'No se pudo validar el acceso.',
        'error',
      );
    } finally {
      setValidating(false);
    }
  };

  const handleQrDetected = async (rawValue: string) => {
    stopScanner();
    setScannerOpen(false);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'QR detectado',
      showConfirmButton: false,
      timer: 1000,
      background: '#ffffff',
      color: '#111827',
    });

    await executeValidation(false, rawValue, true);
  };

  const startScanner = async () => {
    setScannerError('');
    setScannerMessage('Preparando cámara...');
    setScannerReady(false);

    const DetectorClass = getBarcodeDetectorClass();

    if (!DetectorClass) {
      setScannerError(
        'Tu navegador no soporta lectura automática de QR desde cámara. Probá usar Chrome o Safari actualizados.',
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError(
        'Este dispositivo o navegador no permite acceder a la cámara.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      scannerStreamRef.current = stream;

      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error('No se pudo inicializar la cámara.');
      }

      (videoEl as any).srcObject = stream;
      await videoEl.play();

      const detector = new DetectorClass({
        formats: ['qr_code'],
      });

      setScannerReady(true);
      setScannerMessage('Apuntá la cámara al QR del comprador');

      const scan = async () => {
        if (!videoRef.current || !scannerOpen) return;

        try {
          const results = await detector.detect(videoRef.current);

          if (Array.isArray(results) && results.length > 0) {
            const first = results[0];
            const rawValue = String(first?.rawValue || '').trim();

            if (rawValue) {
              await handleQrDetected(rawValue);
              return;
            }
          }
        } catch {
          //
        }

        scannerTimerRef.current = setTimeout(scan, 260);
      };

      scan();
    } catch (error: any) {
      console.error('Error abriendo cámara:', error);
      setScannerError(
        'No pudimos abrir la cámara. Revisá que hayas dado permiso y que la conexión sea segura.',
      );
    }
  };

  useEffect(() => {
    if (!ready) return;

    if (!user?.id) {
      navigate('/', { replace: true });
      return;
    }

    if (user.role !== 'door' && user.role !== 'creator') {
      Swal.fire(
        'Sin acceso',
        'Este panel está pensado para control de ingreso.',
        'warning',
      );
      navigate('/', { replace: true });
      return;
    }

    loadData();

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [id, ready, user?.id, user?.role]);

  useEffect(() => {
    if (!id) return;

    const onUpdate = () => {
      scheduleReload();
    };

    socket.on(`raffle-${id}-update`, onUpdate);
    socket.on(`raffle-${id}-purchase-update`, onUpdate);

    return () => {
      socket.off(`raffle-${id}-update`, onUpdate);
      socket.off(`raffle-${id}-purchase-update`, onUpdate);
    };
  }, [id]);

  useEffect(() => {
    if (!raffle) return;

    const cleanup = runAfterTourAndIdle(
      () => {
        promptAppShare(`door-app-${id}`, window.location.origin);
      },
      { minDelayMs: 90000, idleMs: 25000, timeoutMs: 300000 },
    );

    return () => cleanup();
  }, [raffle, id]);

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [scannerOpen]);

  const sendBuyerWhatsApp = (record: any) => {
    const phone = normalizePhoneForWhatsApp(getDisplayPhone(record));
    const code = getAccessCode(record);

    const message = [
      `Hola ${getDisplayName(record)}, te escribimos por "${title}".`,
      '',
      code ? `Código: ${code}` : null,
      `Ubicación / acceso: ${getSeatSummary(record, raffle)}.`,
      '',
      'Si necesitás ayuda con tu ingreso, respondé este mensaje.',
    ]
      .filter(Boolean)
      .join('\n');

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      return;
    }

    openWhatsAppShare(message);
  };

  const handleCopyCode = async (record: any) => {
    const code = getAccessCode(record);

    if (!code) {
      Swal.fire('Aviso', 'Esta persona todavía no tiene un código visible.', 'info');
      return;
    }

    await copyText(code, 'Código copiado.');
  };

  const openValidationModeHelp = () => {
    openHelpModal(
      'Cómo habilitar ingresos',
      `
        <p>Este panel está optimizado para que la fila fluya rapidísimo:</p>
        <p>1. Tocá el botón grande de <b>Escanear QR</b>.</p>
        <p>2. Si todo está en orden, te va a aparecer un botón verde gigante de <b>Registrar Ingreso</b>.</p>
        <p>3. ¡Listo! Ya puede pasar la siguiente persona.</p>
        <p><br/><i>Si alguien trae la entrada anotada, podés ingresar el código de 6 dígitos manualmente.</i></p>
      `,
    );
  };

  if (loading || !raffle) {
    return (
      <>
        <main className="page-fade px-3 pt-1">
          <AppHeader
            title="Control de acceso"
            subtitle="Preparando panel..."
            showBack
            onBack={() => navigate('/')}
          />
          <div className="mp-card p-6 text-center mt-6">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#3483fa]"></div>
            <p className="text-[14px] font-bold text-slate-700">Cargando escáner y listas...</p>
          </div>
        </main>
        <BottomNav
          items={[
            { label: 'Inicio', icon: 'fa-home', to: '/' },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <GuidedTour storageKey={`tour_door_${id}_v4_plg`} steps={tourSteps} />

      {/* Botón flotante masivo (FAB) solo visible en mobile para lectura de QR */}
      {!scannerOpen && !isFinished && (
        <div className="fixed inset-x-0 bottom-[88px] z-40 flex justify-center lg:hidden px-4 pointer-events-none">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="pointer-events-auto flex w-full max-w-[320px] items-center justify-center gap-3 rounded-[24px] bg-[#3483fa] py-4 text-[17px] font-black text-white shadow-[0_12px_30px_rgba(52,131,250,0.35)] active:scale-[0.98] transition-transform"
          >
            <i className="fas fa-camera text-[22px]"></i>
            ESCANEAR QR
          </button>
        </div>
      )}

      <main className="page-fade min-h-screen bg-slate-50 px-3 pt-1 pb-32 md:px-5 lg:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <AppHeader
            title={title}
            subtitle={`${getModeLabel(raffle)} · Puerta`}
            showBack
            onBack={() => navigate('/')}
            rightSlot={
              <button
                type="button"
                onClick={openValidationModeHelp}
                className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-white text-[#3483fa] shadow-sm border border-slate-200"
              >
                <i className="fas fa-question text-[14px]"></i>
              </button>
            }
          />

          {isFinished && (
            <section className="mb-4 overflow-hidden rounded-[22px] border border-rose-200 bg-white shadow-sm mt-4">
              <div className="bg-rose-50 px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">
                  Evento cerrado
                </p>
                <h2 className="text-[20px] leading-[1.08] font-black text-slate-900 mt-1">
                  Este evento ya finalizó
                </h2>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-700">
                  La puerta no registrará ingresos nuevos.
                </p>
              </div>
            </section>
          )}

          {/* MÁGIA DE PLG: En mobile, usamos flex-col-reverse o forzamos el orden.
            En XL usamos Grid normal.
            Queremos que el Validador (que está en la 2da columna del código original)
            aparezca PRIMERO en mobile.
          */}
          <div className="mt-4 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1.6fr)_420px] 2xl:grid-cols-[minmax(0,1.8fr)_460px]">
            
            {/* --- SECCIÓN 1 EN MOBILE (Validador y Resultado) --- */}
            <div className="order-1 space-y-5 xl:order-2 xl:sticky xl:top-[96px] xl:self-start">
              
              <section
                data-tour="door-validator"
                className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:p-6"
              >
                <div className="mb-4">
                  <h2 className="text-[22px] font-black text-slate-900 leading-tight">
                    Revisión de entrada
                  </h2>
                  <p className="mt-1 text-[14px] text-slate-500">
                    Escaneá el QR del celular del asistente.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  disabled={isFinished}
                  className="w-full hidden lg:flex rounded-[20px] bg-[#3483fa] py-5 text-[16px] font-black text-white shadow-[0_8px_18px_rgba(52,131,250,0.22)] active:scale-[0.98] transition-transform items-center justify-center gap-3 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <i className="fas fa-camera text-[20px]"></i>
                  Escanear código QR
                </button>

                <div className="mt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-[12px] font-black uppercase tracking-wider text-slate-400">O Ingreso manual</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <i className="fas fa-keyboard absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input
                        ref={validationInputRef}
                        type="text"
                        placeholder="Ej: EV-ABC123"
                        value={validationValue}
                        onChange={(e) => setValidationValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            executeValidation(false, validationValue, false);
                          }
                        }}
                        disabled={isFinished}
                        className="w-full rounded-[16px] border border-slate-300 bg-slate-50 py-3.5 pl-11 pr-4 text-[15px] font-bold text-slate-900 outline-none focus:border-[#3483fa] focus:bg-white disabled:opacity-60 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => executeValidation(false, validationValue, false)}
                      disabled={validating || isFinished}
                      className="shrink-0 rounded-[16px] bg-slate-900 px-6 py-3.5 text-[14px] font-black text-white active:scale-[0.98] transition-transform disabled:opacity-60"
                    >
                      Consultar
                    </button>
                  </div>
                </div>
              </section>

              {/* Resultado Vivo */}
              <section id="door-last-result" data-tour="door-last-result">
                {!lastValidation ? (
                  <div className="rounded-[24px] border border-slate-200 border-dashed bg-slate-50 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                      <i className="fas fa-expand text-[18px]"></i>
                    </div>
                    <p className="text-[14px] font-bold text-slate-600">
                      El resultado de la validación aparecerá acá
                    </p>
                  </div>
                ) : (
                  <div className={`rounded-[24px] border p-5 shadow-md ${currentValidationMeta.cardClassName}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${currentValidationMeta.dotClassName} shadow-sm`}></span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${currentValidationMeta.className}`}
                          >
                            {currentValidationMeta.label}
                          </span>
                        </div>
                        
                        <p className="mt-3 text-[22px] font-black text-slate-900 leading-tight">
                          {getDisplayName(lastValidation)}
                        </p>

                        <p className="mt-1 text-[13px] font-medium text-slate-600">
                          {getSeatSummary(lastValidation, raffle)}
                        </p>

                        <div className="mt-4 rounded-[14px] bg-white/70 p-3 backdrop-blur-sm border border-white/40">
                          <p className="text-[13px] leading-relaxed text-slate-800 font-medium">
                            {lastValidation?.message || currentValidationMeta.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ACA ESTÁ EL FLUJO PLG: Botón de registro in-context */}
                    {currentValidationMeta.isApproved && !isFinished && (
                       <button
                         type="button"
                         onClick={() => executeValidation(true, getAccessCode(lastValidation), false)}
                         className="mt-5 w-full rounded-[18px] bg-emerald-500 py-4 text-[16px] font-black text-white shadow-[0_8px_18px_rgba(16,185,129,0.25)] active:scale-[0.98] transition-transform flex justify-center items-center gap-2"
                       >
                         <i className="fas fa-check-circle text-[18px]"></i>
                         Registrar Ingreso
                       </button>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(lastValidation)}
                        className="flex-1 rounded-[14px] bg-white/60 py-2.5 text-[12px] font-black text-slate-700 hover:bg-white transition"
                      >
                        <i className="fas fa-copy mr-1.5"></i> Código
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRecord({ type: 'validation', data: lastValidation })}
                        className="flex-1 rounded-[14px] bg-white/60 py-2.5 text-[12px] font-black text-slate-700 hover:bg-white transition"
                      >
                        <i className="fas fa-eye mr-1.5"></i> Detalles
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* --- SECCIÓN 2 EN MOBILE (Estadísticas e Historial) --- */}
            <div className="order-2 space-y-5 xl:order-1">
              
              <motion.section
                data-tour="door-stats"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="bg-slate-900 px-5 py-5 text-white lg:px-6 lg:py-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                     <i className="fas fa-ticket-alt text-[120px]"></i>
                  </div>
                  <div className="relative z-10 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Resumen en vivo
                      </p>
                      <h2 className="mt-1 text-[22px] leading-[1.1] font-black lg:text-[28px]">
                        Estado de la puerta
                      </h2>
                    </div>

                    <div className="rounded-[16px] bg-white/10 px-4 py-2 backdrop-blur-md self-start lg:self-auto border border-white/5">
                      <p className="text-[12px] font-bold text-white flex items-center gap-2">
                         <i className="fas fa-user-circle text-slate-400"></i>
                        {user?.firstName || 'Personal'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
                  <div className="rounded-[20px] bg-slate-50 p-4 border border-slate-100">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Adentro
                    </p>
                    <p className="mt-1 text-[28px] font-black text-[#3483fa] leading-none">
                      {recentCheckins.length}
                    </p>
                  </div>
                  
                  <div className="rounded-[20px] bg-emerald-50 p-4 border border-emerald-100">
                    <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                      Listos
                    </p>
                    <p className="mt-1 text-[28px] font-black text-slate-900 leading-none">
                      {confirmedCount}
                    </p>
                  </div>

                  <div className="rounded-[20px] bg-amber-50 p-4 border border-amber-100">
                    <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
                      Pendientes
                    </p>
                    <p className="mt-1 text-[28px] font-black text-slate-900 leading-none">
                      {pendingCount}
                    </p>
                  </div>

                  <div className="rounded-[20px] bg-white p-4 border border-slate-200 hidden lg:block">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                      Disponibles
                    </p>
                    <p className="mt-1 text-[28px] font-black text-slate-900 leading-none">
                      {availableCount}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 lg:px-5 lg:pb-5">
                  <div className="rounded-[20px] bg-[#f8fafc] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[12px] font-black text-slate-600">
                        Ocupación esperada (confirmados)
                      </p>
                      <p className="text-[12px] font-black text-slate-900">
                        {confirmedPercent}%
                      </p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all duration-500"
                        style={{ width: `${confirmedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.section>

              <section
                data-tour="door-search"
                className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:p-6"
              >
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-[20px] font-black text-slate-900 leading-tight">
                      Historial de ingresos
                    </h2>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecentFilter('recent')}
                      className={`rounded-full px-4 py-2 text-[12px] font-black transition-colors ${
                        recentFilter === 'recent'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Últimos 20
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentFilter('all')}
                      className={`rounded-full px-4 py-2 text-[12px] font-black transition-colors ${
                        recentFilter === 'all'
                          ? 'bg-[#3483fa] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Ver todos
                    </button>
                  </div>
                </div>

                <div className="relative mb-5">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="text"
                    placeholder="Buscar nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-[16px] border border-slate-200 bg-[#f8fafc] py-3.5 pl-11 pr-10 text-[14px] font-semibold text-slate-900 outline-none focus:border-[#3483fa] focus:bg-white transition-colors"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <i className="fas fa-times-circle"></i>
                    </button>
                  )}
                </div>

                {filteredRecentCheckins.length === 0 ? (
                  <div className="rounded-[20px] border border-slate-200 border-dashed bg-slate-50 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                      <i className="fas fa-user-check text-[18px]"></i>
                    </div>
                    <p className="text-[15px] font-black text-slate-900">
                      Sin ingresos recientes
                    </p>
                    <p className="mt-1 text-[13px] leading-6 text-slate-500">
                      A medida que valides entradas, se verán reflejadas acá.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="hidden lg:block overflow-hidden rounded-[20px] border border-slate-200">
                      <div className="grid grid-cols-[1.2fr_.9fr_.9fr_.9fr_160px] bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <div>Persona</div>
                        <div>Código</div>
                        <div>Ubicación</div>
                        <div>Hora</div>
                        <div className="text-right">Acciones</div>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white">
                        {filteredRecentCheckins.map((record: any) => (
                          <div
                            key={record?.itemId || record?.id}
                            className="grid grid-cols-[1.2fr_.9fr_.9fr_.9fr_160px] items-center px-4 py-3 hover:bg-slate-50 transition"
                          >
                            <div className="min-w-0 pr-3">
                              <p className="truncate text-[14px] font-black text-slate-900">
                                {getDisplayName(record)}
                              </p>
                            </div>

                            <div className="pr-3">
                              <p className="truncate text-[13px] font-bold text-slate-600">
                                {getAccessCode(record) || '-'}
                              </p>
                            </div>

                            <div className="pr-3">
                              <p className="truncate text-[13px] font-bold text-slate-600">
                                {getSeatSummary(record, raffle)}
                              </p>
                            </div>

                            <div className="pr-3">
                              <p className="text-[13px] font-bold text-slate-600">
                                {new Date(record?.checkedInAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit'})}
                              </p>
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => sendBuyerWhatsApp(record)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors"
                              >
                                <i className="fab fa-whatsapp text-[14px]"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRecord({ type: 'recent', data: record })}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-[#3483fa] hover:bg-[#3483fa] hover:text-white hover:border-transparent transition-colors"
                              >
                                <i className="fas fa-eye text-[12px]"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 lg:hidden">
                      {filteredRecentCheckins.map((record: any) => (
                        <div
                          key={record?.itemId || record?.id}
                          className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="h-2 w-2 rounded-full bg-[#3483fa]"></span>
                                <p className="text-[15px] font-black text-slate-900 truncate">
                                  {getDisplayName(record)}
                                </p>
                              </div>
                              <p className="text-[12px] text-slate-500 pl-4">
                                Ingreso: {new Date(record?.checkedInAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit'})}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => sendBuyerWhatsApp(record)}
                                className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-50 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors border border-slate-100"
                              >
                                <i className="fab fa-whatsapp text-[16px]"></i>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRecord({ type: 'recent', data: record })}
                                className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-600 hover:text-[#3483fa] transition-colors"
                              >
                                <i className="fas fa-chevron-right text-[14px]"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {scannerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-0 sm:p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl flex flex-col overflow-hidden sm:rounded-[32px] bg-[#0f172a] shadow-2xl border border-white/10"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white bg-black/40">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Lector
                  </p>
                  <h3 className="text-[20px] font-black">Escáner de entradas</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setScannerOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <i className="fas fa-times text-[16px]"></i>
                </button>
              </div>

              <div className="relative flex-1 bg-black min-h-[50vh]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />

                {/* Marcador central */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[240px] w-[240px] sm:h-[280px] sm:w-[280px] rounded-[32px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]">
                    <div className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-[24px] border-l-4 border-t-4 border-[#3483fa]" />
                    <div className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-[24px] border-r-4 border-t-4 border-[#3483fa]" />
                    <div className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-[24px] border-b-4 border-l-4 border-[#3483fa]" />
                    <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-[24px] border-b-4 border-r-4 border-[#3483fa]" />
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-6 pb-8 pt-20 text-center text-white">
                  <div className="mx-auto max-w-sm backdrop-blur-sm bg-black/40 rounded-2xl p-4 border border-white/10">
                    <p className="text-[16px] font-black">{scannerMessage}</p>
                    <p className="mt-1 text-[13px] text-slate-300">
                      Enfocá el QR del asistente adentro del marco. La lectura es automática.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0f172a] p-5 shrink-0 border-t border-white/10">
                {!!scannerError ? (
                  <button
                    type="button"
                    onClick={startScanner}
                    className="w-full rounded-[18px] bg-[#3483fa] py-4 text-[15px] font-black text-white active:scale-95 transition-transform"
                  >
                    <i className="fas fa-rotate-right mr-2"></i>
                    Reintentar cámara
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setScannerOpen(false);
                      setTimeout(() => {
                        validationInputRef.current?.focus();
                      }, 150);
                    }}
                    className="w-full rounded-[18px] border border-white/20 bg-white/5 py-4 text-[15px] font-black text-white hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Ingresar código manualmente
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-[32px]"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Detalle de entrada
                  </p>
                  <h3 className="text-[20px] font-black text-slate-900 leading-tight mt-0.5">
                    {getDisplayName(selectedRecord.data)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <i className="fas fa-times text-[16px]"></i>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide border ${
                      selectedRecord.type === 'recent'
                        ? getAccessStatusMeta('checked_in').className
                        : getValidationBadge(selectedRecord.data).className
                    }`}
                  >
                    {selectedRecord.type === 'recent'
                      ? 'Ingresado al evento'
                      : getValidationBadge(selectedRecord.data).label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600 uppercase tracking-wide">
                    {getPaymentMethodLabel(
                      selectedRecord.data?.purchase?.paymentMethod ||
                        selectedRecord.data?.paymentMethod,
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[12px] font-black uppercase tracking-wide text-slate-500">
                      Código de acceso
                    </p>
                    <p className="mt-1 text-[18px] font-black text-slate-900 break-all">
                      {getAccessCode(selectedRecord.data) || '-'}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-4">
                    <p className="text-[12px] font-black uppercase tracking-wide text-slate-500">
                      Ubicación / Asiento
                    </p>
                    <p className="mt-1 text-[16px] font-bold text-slate-800">
                      {getSeatSummary(selectedRecord.data, raffle)}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 border-b border-slate-100 pb-2 mb-3">
                    Info del asistente
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center text-slate-400"><i className="fas fa-user"></i></div>
                      <p className="text-[14px] font-bold text-slate-800">{getDisplayName(selectedRecord.data)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center text-slate-400"><i className="fab fa-whatsapp text-[16px]"></i></div>
                      <p className="text-[14px] font-medium text-slate-700">{getDisplayPhone(selectedRecord.data) || '-'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center text-slate-400"><i className="fas fa-envelope"></i></div>
                      <p className="text-[14px] font-medium text-slate-700 break-all">{getDisplayEmail(selectedRecord.data) || '-'}</p>
                    </div>
                  </div>
                </div>

                {selectedRecord.type === 'validation' && (
                  <div className="mt-4 rounded-[20px] bg-slate-100 p-4">
                    <p className="text-[12px] font-black text-slate-900">
                      Mensaje del sistema
                    </p>
                    <p className="mt-1 text-[14px] leading-relaxed text-slate-700">
                      {selectedRecord.data?.message || getValidationBadge(selectedRecord.data).description}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-white p-5">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => sendBuyerWhatsApp(selectedRecord.data)}
                    className="rounded-[18px] bg-[#25D366] py-3.5 text-[14px] font-black text-white shadow-[0_6px_16px_rgba(37,211,102,0.25)] active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <i className="fab fa-whatsapp text-[18px]"></i>
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(selectedRecord.data)}
                    className="rounded-[18px] border border-slate-200 bg-slate-50 py-3.5 text-[14px] font-black text-slate-700 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-copy"></i>
                    Copiar código
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="block lg:hidden">
        <BottomNav
          items={[
            {
              label: 'Inicio',
              icon: 'fa-home',
              active: true,
              to: '/',
            },
            {
              label: 'Ayuda',
              icon: 'fa-headset',
              onClick: openValidationModeHelp,
            },
          ]}
        />
      </div>
    </>
  );
}