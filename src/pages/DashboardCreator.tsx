import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AuthContext } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import api from '../api/axios';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import AppFooter from '../components/AppFooter';
import {
  buildShareRaffleLink,
  copyText,
  openHelpModal,
  openWhatsAppShare,
  promptAppShare,
  promptShare,
} from '../utils/ux';
import {
  getPublicRaffleShareText,
  getSellerShareTitle,
} from '../utils/shareMessages';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);

type PurchaseFilter =
  | 'all'
  | 'action'
  | 'approved'
  | 'checked_in'
  | 'rejected'
  | 'other';

type TeamRole = 'promoter' | 'door';
type DashboardTab = 'summary' | 'operations' | 'team' | 'closing';

type TeamForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  whatsapp: string;
  commissionPercent?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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

function normalizePhoneForWhatsApp(phone?: string | null) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('0')) digits = digits.slice(1);
  if (!digits.startsWith('54')) digits = `54${digits}`;

  return digits;
}

function getUnlockPrice(totalNumbers: number) {
  if (totalNumbers <= 100) return 5000;
  if (totalNumbers <= 500) return 12500;
  return 20000;
}

function getPaymentMethodLabel(method?: string | null) {
  if (method === 'transfer') return 'Transferencia';
  if (method === 'cash') return 'Efectivo / puerta';
  if (method === 'link') return 'Link de pago';
  return 'Lista gratis';
}

function getPurchaseStatusMeta(status?: string | null) {
  switch (status) {
    case 'checked_in':
      return {
        label: 'Ya ingresó',
        shortLabel: 'Adentro',
        className: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
        cardClassName: 'border-indigo-200 bg-indigo-50/50',
        dotClassName: 'bg-indigo-500',
        priority: 5,
      };
    case 'approved':
      return {
        label: 'Pago confirmado',
        shortLabel: 'Confirmado',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        cardClassName: 'border-emerald-200 bg-emerald-50/50',
        dotClassName: 'bg-emerald-500',
        priority: 4,
      };
    case 'auto_approved':
      return {
        label: 'Pago confirmado',
        shortLabel: 'Confirmado',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        cardClassName: 'border-emerald-200 bg-emerald-50/50',
        dotClassName: 'bg-emerald-500',
        priority: 4,
      };
    case 'under_review':
      return {
        label: 'Pago para revisar',
        shortLabel: 'Revisar',
        className: 'bg-amber-100 text-amber-700 border border-amber-200',
        cardClassName: 'border-amber-200 bg-amber-50/60',
        dotClassName: 'bg-amber-500',
        priority: 0,
      };
    case 'pending_cash_confirmation':
      return {
        label: 'Pago en puerta',
        shortLabel: 'Puerta',
        className: 'bg-orange-100 text-orange-700 border border-orange-200',
        cardClassName: 'border-orange-200 bg-orange-50/60',
        dotClassName: 'bg-orange-500',
        priority: 1,
      };
    case 'reserved':
      return {
        label: 'Reserva activa',
        shortLabel: 'Reservado',
        className: 'bg-sky-100 text-sky-700 border border-sky-200',
        cardClassName: 'border-sky-200 bg-sky-50/60',
        dotClassName: 'bg-sky-500',
        priority: 2,
      };
    case 'rejected':
      return {
        label: 'Pago rechazado',
        shortLabel: 'Rechazado',
        className: 'bg-rose-100 text-rose-700 border border-rose-200',
        cardClassName: 'border-rose-200 bg-rose-50/60',
        dotClassName: 'bg-rose-500',
        priority: 6,
      };
    case 'expired':
      return {
        label: 'Reserva vencida',
        shortLabel: 'Vencido',
        className: 'bg-slate-100 text-slate-500 border border-slate-200',
        cardClassName: 'border-slate-200 bg-slate-50/70',
        dotClassName: 'bg-slate-400',
        priority: 7,
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        shortLabel: 'Cancelado',
        className: 'bg-slate-100 text-slate-500 border border-slate-200',
        cardClassName: 'border-slate-200 bg-slate-50/70',
        dotClassName: 'bg-slate-400',
        priority: 8,
      };
    default:
      return {
        label: status || 'Sin estado',
        shortLabel: status || 'Sin estado',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
        cardClassName: 'border-slate-200 bg-slate-50/70',
        dotClassName: 'bg-slate-400',
        priority: 9,
      };
  }
}

function canApprovePurchase(status?: string | null) {
  return ['under_review', 'pending_cash_confirmation', 'reserved'].includes(
    String(status || ''),
  );
}

function canRejectPurchase(status?: string | null) {
  return ['under_review', 'pending_cash_confirmation', 'reserved'].includes(
    String(status || ''),
  );
}

function isActionablePurchase(status?: string | null) {
  return canApprovePurchase(status) || canRejectPurchase(status);
}

function isPurchaseApprovedForDoor(status?: string | null) {
  return ['approved', 'auto_approved'].includes(String(status || ''));
}

function isPurchaseCheckedIn(status?: string | null) {
  return String(status || '') === 'checked_in';
}

function getNumbersLabel(numbers?: any[]) {
  if (!Array.isArray(numbers) || numbers.length === 0) return '-';
  return numbers.map((n: any) => `#${n.number}`).join(', ');
}

function getPurchasePrimaryDate(purchase: any) {
  return new Date(
    purchase?.submittedAt ||
      purchase?.reservedAt ||
      purchase?.createdAt ||
      purchase?.updatedAt ||
      0,
  ).getTime();
}

function looksLikeDataUrl(value?: string | null) {
  return typeof value === 'string' && value.startsWith('data:');
}

function getFileExtension(fileName?: string | null) {
  if (!fileName) return '';
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function getProofMimeType(proof: any) {
  const mime =
    proof?.fileMimeType ||
    proof?.mimeType ||
    proof?.contentType ||
    proof?.type ||
    '';

  if (mime) return String(mime).toLowerCase();

  const ext = getFileExtension(proof?.fileName);
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';

  return '';
}

function normalizeBase64ToDataUrl(
  base64?: string | null,
  mimeType?: string | null,
) {
  if (!base64 || typeof base64 !== 'string') return null;
  if (looksLikeDataUrl(base64)) return base64;
  return `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
}

function getProofPreviewData(proof: any) {
  if (!proof) {
    return {
      previewUrl: null,
      openUrl: null,
      mimeType: '',
      isImage: false,
      isPdf: false,
      exists: false,
    };
  }

  const mimeType = getProofMimeType(proof);

  const possibleUrl =
    proof?.fileUrl ||
    proof?.publicUrl ||
    proof?.url ||
    proof?.signedUrl ||
    proof?.downloadUrl ||
    proof?.previewUrl ||
    null;

  const possibleBase64 =
    proof?.fileBase64 ||
    proof?.base64 ||
    proof?.base64Data ||
    proof?.contentBase64 ||
    proof?.imageBase64 ||
    proof?.previewBase64 ||
    null;

  const normalizedBase64 = normalizeBase64ToDataUrl(possibleBase64, mimeType);
  const previewUrl = possibleUrl || normalizedBase64 || null;
  const openUrl = possibleUrl || normalizedBase64 || null;

  const resolvedMime = String(mimeType || '').toLowerCase();
  const isPdf =
    resolvedMime.includes('pdf') || getFileExtension(proof?.fileName) === 'pdf';
  const isImage =
    resolvedMime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp'].includes(getFileExtension(proof?.fileName));

  return {
    previewUrl,
    openUrl,
    mimeType: resolvedMime,
    isImage,
    isPdf,
    exists: Boolean(previewUrl || proof?.fileName),
  };
}

function getPurchaseUnitCount(purchase: any) {
  if (
    Number.isFinite(Number(purchase?.ticketCount)) &&
    Number(purchase?.ticketCount) > 0
  ) {
    return Number(purchase.ticketCount);
  }

  if (Array.isArray(purchase?.numbers) && purchase.numbers.length > 0) {
    return purchase.numbers.length;
  }

  return 1;
}

function sumPurchaseUnits(list: any[]) {
  return (Array.isArray(list) ? list : []).reduce(
    (acc, item) => acc + getPurchaseUnitCount(item),
    0,
  );
}

function getCapacityLabel(eventData: any) {
  return eventData?.eventType === 'tables' ? 'mesas' : 'pases / lugares';
}

function getMemberDisplayName(member: any) {
  return (
    member?.fullName ||
    `${member?.firstName || ''} ${member?.lastName || ''}`.trim() ||
    member?.email ||
    'Sin nombre'
  );
}

function getMemberWhatsapp(member: any) {
  return member?.whatsapp || member?.phone || member?.buyerPhone || '';
}

function buildAccessMessage(params: {
  role: TeamRole;
  personName: string;
  eventTitle: string;
  email: string;
  password: string;
  loginUrl?: string;
  shareUrl?: string;
  commissionPercent?: string | number | null;
}) {
  const roleLabel = params.role === 'promoter' ? 'RRPP / Ventas' : 'Puerta';

  const lines = [
    `Hola ${params.personName}, ¿cómo va?`,
    '',
    `Ya tenés tu acceso para trabajar en "${params.eventTitle}" como ${roleLabel}.`,
    '',
    `Datos para entrar:`,
    `• Usuario: ${params.email}`,
    `• Clave: ${params.password}`,
  ];

  if (params.role === 'promoter' && params.commissionPercent) {
    lines.push(`• Comisión: ${params.commissionPercent}%`);
  }

  if (params.shareUrl) {
    lines.push(`• Tu link personal: ${params.shareUrl}`);
  }

  if (params.loginUrl) {
    lines.push(`• Panel de acceso: ${params.loginUrl}`);
  }

  lines.push('');

  lines.push(
    params.role === 'promoter'
      ? 'Compartí siempre tu link personal para que el sistema te cuente las ventas automáticamente.'
      : 'El día del evento entrás con este usuario para buscar personas o escanear QR rápido.',
  );

  return lines.join('\n');
}

function isStrongEnoughPassword(password: string) {
  return String(password || '').trim().length >= 6;
}

function sanitizePhoneInput(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function SectionTitle(props: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {props.kicker}
        </p>
        <h2 className="mt-1 text-[20px] font-black leading-tight text-slate-900 lg:text-[24px]">
          {props.title}
        </h2>
        {props.description ? (
          <p className="mt-2 text-[13px] leading-6 text-slate-600 lg:text-[14px]">
            {props.description}
          </p>
        ) : null}
      </div>

      {props.action}
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'rose' | 'indigo';
}) {
  const toneMap = {
    default: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  };

  return (
    <div
      className={cx(
        'rounded-[20px] border p-4 shadow-sm min-h-[142px]',
        toneMap[props.tone || 'default'],
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
        {props.label}
      </p>
      <p className="mt-2 text-[24px] font-black leading-none lg:text-[30px] break-words">
        {props.value}
      </p>
      {props.sublabel ? (
        <p className="mt-2 text-[12px] leading-5 opacity-80">{props.sublabel}</p>
      ) : null}
    </div>
  );
}

function TeamMemberCard(props: {
  role: TeamRole;
  member: any;
  onEdit: () => void;
  onShare: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const shareUrl =
    props.member?.shareLink ||
    props.member?.sellerLink ||
    props.member?.publicLink ||
    props.member?.accessLink ||
    '';

  const isActive = props.member?.isActive !== false;
  const sales = props.member?.soldTickets || props.member?.salesCount || 0;

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-black text-slate-900 lg:text-[18px]">
            {getMemberDisplayName(props.member)}
          </p>

          <div className="mt-1 space-y-1 text-[12px] text-slate-500 lg:text-[13px]">
            <p className="truncate">{props.member?.email || 'Sin email'}</p>
            <p>WhatsApp: {getMemberWhatsapp(props.member) || 'Falta cargar'}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={cx(
                'rounded-full border px-2.5 py-1 text-[11px] font-black',
                isActive
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                  : 'border-rose-200 bg-rose-100 text-rose-700',
              )}
            >
              {isActive ? 'Activo' : 'Pausado'}
            </span>

            {props.role === 'promoter' ? (
              <>
                <span className="rounded-full border border-blue-200 bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700">
                  {sales} venta{sales !== 1 ? 's' : ''}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
                  Comisión: {props.member?.commissionPercent ?? props.member?.commission ?? 0}%
                </span>
              </>
            ) : (
              <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-1 text-[11px] font-black text-indigo-700">
                Equipo de puerta
              </span>
            )}
          </div>
        </div>
      </div>

      {props.role === 'promoter' && shareUrl ? (
        <div className="mt-4 rounded-[16px] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700">
              Link personal
            </span>
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-600">
              {shareUrl}
            </p>
            <button
              type="button"
              onClick={() => copyText(shareUrl, 'Enlace de ventas copiado')}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-[#3483fa] transition hover:bg-slate-50"
            >
              Copiar
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={props.onEdit}
          className="rounded-[14px] border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-black text-slate-700 transition hover:bg-slate-50"
        >
          <i className="fas fa-pen mr-2"></i>
          Editar
        </button>

        <button
          type="button"
          onClick={props.onShare}
          className="rounded-[14px] bg-[#25D366] px-3 py-2.5 text-[12px] font-black text-white transition hover:bg-[#20ba56]"
        >
          <i className="fab fa-whatsapp mr-2"></i>
          Reenviar acceso
        </button>

        <button
          type="button"
          onClick={props.onToggle}
          className={cx(
            'rounded-[14px] px-3 py-2.5 text-[12px] font-black text-white transition',
            isActive
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-emerald-600 hover:bg-emerald-700',
          )}
        >
          <i
            className={cx(
              'fas mr-2',
              isActive ? 'fa-ban' : 'fa-lock-open',
            )}
          ></i>
          {isActive ? 'Pausar' : 'Reactivar'}
        </button>

        <button
          type="button"
          onClick={props.onDelete}
          className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] font-black text-rose-700 transition hover:bg-rose-100"
        >
          <i className="fas fa-trash mr-2"></i>
          Eliminar
        </button>
      </div>
    </div>
  );
}

function PurchaseQuickCard(props: {
  purchase: any;
  onOpenDetail: () => void;
  onOpenProof: () => void;
  onSendWhatsApp: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusMeta = getPurchaseStatusMeta(props.purchase?.status);
  const latestProof = props.purchase?.latestProof;
  const proofPreview = getProofPreviewData(latestProof);

  return (
    <div className={cx('rounded-[22px] border p-4 shadow-sm', statusMeta.cardClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx('h-2.5 w-2.5 rounded-full', statusMeta.dotClassName)}></span>
            <p className="text-[16px] font-black text-slate-900">
              {props.purchase?.buyerName || 'Sin nombre cargado'}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={cx('rounded-full px-2.5 py-1 text-[10px] font-black', statusMeta.className)}>
              {statusMeta.label}
            </span>

            <span
              className={cx(
                'rounded-full border px-2.5 py-1 text-[10px] font-black',
                latestProof
                  ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600',
              )}
            >
              {latestProof ? 'Tiene comprobante' : 'Sin comprobante'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-[14px] border border-black/5 bg-white/80 p-3 col-span-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Reserva
              </p>
              <p className="mt-1 font-black text-slate-900">
                {getNumbersLabel(props.purchase?.numbers)}
              </p>
            </div>


          </div>

          <div className="mt-3 space-y-1 text-[12px] text-slate-600">
            <p>{props.purchase?.buyerPhone || 'Sin teléfono'}</p>
            <p>{getPaymentMethodLabel(props.purchase?.paymentMethod)}</p>
          </div>

          {latestProof ? (
            <button
              type="button"
              onClick={() => {
                if (proofPreview.previewUrl || proofPreview.openUrl) {
                  props.onOpenProof();
                } else {
                  props.onOpenDetail();
                }
              }}
              className="mt-3 flex w-full items-center justify-between rounded-[14px] border border-indigo-100 bg-white px-3 py-2.5 text-left transition hover:shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">
                  Ver comprobante
                </p>
                <p className="truncate text-[12px] font-black text-slate-900">
                  {latestProof?.fileName || 'Abrir archivo'}
                </p>
              </div>
              <i
                className={cx(
                  'fas text-indigo-600',
                  proofPreview.isPdf ? 'fa-file-pdf' : 'fa-eye',
                )}
              ></i>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={props.onSendWhatsApp}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#20ba56]"
            title="Escribirle por WhatsApp"
          >
            <i className="fab fa-whatsapp"></i>
          </button>

          <button
            type="button"
            onClick={props.onOpenDetail}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-[#3483fa] transition hover:bg-blue-50"
            title="Abrir detalles"
          >
            <i className="fas fa-eye"></i>
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-black/5 pt-4">
        <button
          type="button"
          onClick={props.onApprove}
          className="rounded-[14px] bg-emerald-600 py-3 text-[13px] font-black text-white transition hover:bg-emerald-700"
        >
          <i className="fas fa-check mr-2"></i>
          Confirmar pago
        </button>

        <button
          type="button"
          onClick={props.onReject}
          className="rounded-[14px] border border-rose-200 bg-rose-100 py-3 text-[13px] font-black text-rose-700 transition hover:bg-rose-200"
        >
          <i className="fas fa-xmark mr-2"></i>
          Rechazar
        </button>
      </div>
    </div>
  );
}

function QuickJumpButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string | number | null;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cx(
        'relative rounded-[16px] px-3 py-2.5 text-[12px] font-black transition',
        props.active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600',
      )}
    >
      <span>{props.label}</span>
      {props.badge !== null && props.badge !== undefined && props.badge !== '' ? (
        <span
          className={cx(
            'ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black',
            props.active ? 'bg-white/20 text-white' : 'bg-white text-slate-700',
          )}
        >
          {props.badge}
        </span>
      ) : null}
    </button>
  );
}

export default function DashboardCreator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [eventData, setEventData] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [promoters, setPromoters] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);

  const [newPromoter, setNewPromoter] = useState<TeamForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    whatsapp: '',
    commissionPercent: '',
  });

  const [newDoorStaff, setNewDoorStaff] = useState<TeamForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    whatsapp: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeDashboardTab, setActiveDashboardTab] =
    useState<DashboardTab>('summary');
  const [activeTeamTab, setActiveTeamTab] = useState<TeamRole>('promoter');
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [isPromoterFormOpen, setIsPromoterFormOpen] = useState(false);
  const [isDoorFormOpen, setIsDoorFormOpen] = useState(false);

  const [isOperationsModalOpen, setIsOperationsModalOpen] = useState(false);
  const [buyerSearchTerm, setBuyerSearchTerm] = useState('');
  const [purchaseFilter, setPurchaseFilter] =
    useState<PurchaseFilter>('action');
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [proofViewer, setProofViewer] = useState<{
    url: string;
    mimeType: string;
    isImage: boolean;
    isPdf: boolean;
    fileName?: string | null;
  } | null>(null);

  const summarySectionRef = useRef<HTMLDivElement | null>(null);
  const operationsSectionRef = useRef<HTMLDivElement | null>(null);
  const teamSectionRef = useRef<HTMLDivElement | null>(null);
  const closingSectionRef = useRef<HTMLDivElement | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFinished = eventData?.status === 'finished';
  const shareLink = useMemo(() => buildShareRaffleLink(id), [id]);

  const shareMessage = useMemo(() => {
    return getPublicRaffleShareText(shareLink, eventData?.title);
  }, [shareLink, eventData?.title]);

  const financials = dashboard?.financials || {
    grossCollected: 0,
    mpFeeCollected: 0,
    platformFeeCollected: 0,
    organizerNetCollected: 0,
  };

  const salesProgressPercent = Math.max(
    0,
    Math.min(100, Number(dashboard?.salesProgressPercent || 0)),
  );

  const purchasesSorted = useMemo(() => {
    return [...purchases].sort((a: any, b: any) => {
      const aMeta = getPurchaseStatusMeta(a.status);
      const bMeta = getPurchaseStatusMeta(b.status);

      if (aMeta.priority !== bMeta.priority) {
        return aMeta.priority - bMeta.priority;
      }

      return getPurchasePrimaryDate(b) - getPurchasePrimaryDate(a);
    });
  }, [purchases]);

  const urgentPurchases = useMemo(() => {
    return purchasesSorted.filter((p: any) => isActionablePurchase(p.status));
  }, [purchasesSorted]);

  const filteredPurchases = useMemo(() => {
    let base = purchasesSorted;

    if (purchaseFilter === 'action') {
      base = base.filter((purchase: any) => isActionablePurchase(purchase.status));
    } else if (purchaseFilter === 'approved') {
      base = base.filter((purchase: any) =>
        isPurchaseApprovedForDoor(purchase.status),
      );
    } else if (purchaseFilter === 'checked_in') {
      base = base.filter((purchase: any) =>
        isPurchaseCheckedIn(purchase.status),
      );
    } else if (purchaseFilter === 'rejected') {
      base = base.filter(
        (purchase: any) => ['rejected'].includes(String(purchase.status || '')),
      );
    } else if (purchaseFilter === 'other') {
      base = base.filter((purchase: any) =>
        ['expired', 'cancelled'].includes(String(purchase.status || '')),
      );
    }

    if (!buyerSearchTerm.trim()) return base;

    const lowerTerm = buyerSearchTerm.toLowerCase();

    return base.filter((purchase: any) => {
      const numbersText = (purchase.numbers || [])
        .map((n: any) => n.number)
        .join(' ')
        .toLowerCase();

      const latestProof = purchase.latestProof || {};
      const proofName = String(latestProof.fileName || '').toLowerCase();
      const proofStatus = String(latestProof.reviewStatus || '').toLowerCase();

      return (
        (purchase.buyerName || '').toLowerCase().includes(lowerTerm) ||
        (purchase.buyerPhone || '').toLowerCase().includes(lowerTerm) ||
        (purchase.buyerEmail || '').toLowerCase().includes(lowerTerm) ||
        String(purchase.id || '').toLowerCase().includes(lowerTerm) ||
        String(purchase.status || '').toLowerCase().includes(lowerTerm) ||
        String(getPaymentMethodLabel(purchase.paymentMethod))
          .toLowerCase()
          .includes(lowerTerm) ||
        numbersText.includes(lowerTerm) ||
        proofName.includes(lowerTerm) ||
        proofStatus.includes(lowerTerm)
      );
    });
  }, [buyerSearchTerm, purchaseFilter, purchasesSorted]);

  const approvedPurchases = useMemo(() => {
    return purchases.filter((p: any) => isPurchaseApprovedForDoor(p.status)).length;
  }, [purchases]);

  const checkedInCount = useMemo(() => {
    return purchases.filter((p: any) => isPurchaseCheckedIn(p.status)).length;
  }, [purchases]);

  const rejectedPurchases = useMemo(() => {
    return purchases.filter((p: any) => String(p.status || '') === 'rejected').length;
  }, [purchases]);

  const pendingReviewPurchases = useMemo(() => {
    return purchases.filter((p: any) =>
      ['under_review', 'pending_cash_confirmation', 'reserved'].includes(
        String(p.status || ''),
      ),
    ).length;
  }, [purchases]);

  const purchasesWithProofCount = useMemo(() => {
    return purchases.filter((p: any) => Boolean(p?.latestProof)).length;
  }, [purchases]);

  const purchasesReadyForDoor = useMemo(() => {
    return purchases.filter((p: any) => isPurchaseApprovedForDoor(p.status));
  }, [purchases]);

  const purchasesInside = useMemo(() => {
    return purchases.filter((p: any) => isPurchaseCheckedIn(p.status));
  }, [purchases]);

  const outsidePeopleCount = useMemo(() => {
    return sumPurchaseUnits(purchasesReadyForDoor);
  }, [purchasesReadyForDoor]);

  const insidePeopleCount = useMemo(() => {
    return sumPurchaseUnits(purchasesInside);
  }, [purchasesInside]);

  const operationalConfirmedPeople = useMemo(() => {
    return outsidePeopleCount + insidePeopleCount;
  }, [outsidePeopleCount, insidePeopleCount]);

  const operationalOutsideCount = useMemo(() => {
    return purchasesReadyForDoor.length;
  }, [purchasesReadyForDoor]);

  const operationalInsideCount = useMemo(() => {
    return purchasesInside.length;
  }, [purchasesInside]);

  const doorStaffList = useMemo(() => {
    const fromDashboard = Array.isArray(dashboard?.doorStaff)
      ? dashboard.doorStaff
      : [];
    const fromEvent = Array.isArray(eventData?.doorStaff)
      ? eventData.doorStaff
      : [];
    return fromDashboard.length ? fromDashboard : fromEvent;
  }, [dashboard, eventData]);

  const eventTypeLabel = useMemo(() => {
    return eventData?.eventType === 'tables' ? 'Mesas / boxes' : 'Cupo general';
  }, [eventData?.eventType]);

  const capacityUnitLabel = useMemo(() => {
    return getCapacityLabel(eventData);
  }, [eventData]);

  const totalTables = useMemo(() => {
    return toInt(eventData?.tableCount ?? dashboard?.tableCount ?? 0, 0);
  }, [eventData, dashboard]);

  const chairsPerTable = useMemo(() => {
    return toInt(eventData?.chairsPerTable ?? dashboard?.chairsPerTable ?? 0, 0);
  }, [eventData, dashboard]);

  const occupiedTables = useMemo(() => {
    return toInt(dashboard?.occupiedTables ?? 0, 0);
  }, [dashboard]);

  const freeTables = useMemo(() => {
    if (!totalTables) return 0;
    return Math.max(totalTables - occupiedTables, 0);
  }, [totalTables, occupiedTables]);

  const assignedGuests = useMemo(() => {
    return toInt(dashboard?.assignedGuests ?? 0, 0);
  }, [dashboard]);

  const unassignedGuests = useMemo(() => {
    return toInt(dashboard?.unassignedGuests ?? 0, 0);
  }, [dashboard]);

  const unlock = dashboard?.unlock || {
    freeLimit: 20,
    confirmedNumbers: dashboard?.soldCount || 0,
    unlocked: false,
    requiresUnlockPayment: false,
    totalNumbers: dashboard?.totalTickets || eventData?.totalNumbers || 0,
    latestPaidUnlock: null,
  };

  const unlockPrice = getUnlockPrice(
    Number(
      unlock.totalNumbers || eventData?.totalNumbers || dashboard?.totalTickets || 0,
    ),
  );

  const freeLimit = Number(unlock.freeLimit || 20);
  const confirmedForUnlock = Number(unlock.confirmedNumbers || dashboard?.soldCount || 0);
  const remainingFree = Math.max(freeLimit - confirmedForUnlock, 0);
  const overFree = Math.max(confirmedForUnlock - freeLimit, 0);
  const unlockProgress = Math.min(
    100,
    Math.round((confirmedForUnlock / Math.max(1, freeLimit)) * 100),
  );

  const selectedPurchaseProof = useMemo(() => {
    return getProofPreviewData(selectedPurchase?.latestProof);
  }, [selectedPurchase]);

  const filteredPromoters = useMemo(() => {
    if (!teamSearchTerm.trim()) return promoters;

    const lower = teamSearchTerm.toLowerCase();
    return promoters.filter((member: any) => {
      return (
        getMemberDisplayName(member).toLowerCase().includes(lower) ||
        String(member?.email || '').toLowerCase().includes(lower) ||
        String(getMemberWhatsapp(member) || '').toLowerCase().includes(lower)
      );
    });
  }, [promoters, teamSearchTerm]);

  const filteredDoorStaff = useMemo(() => {
    if (!teamSearchTerm.trim()) return doorStaffList;

    const lower = teamSearchTerm.toLowerCase();
    return doorStaffList.filter((member: any) => {
      return (
        getMemberDisplayName(member).toLowerCase().includes(lower) ||
        String(member?.email || '').toLowerCase().includes(lower) ||
        String(getMemberWhatsapp(member) || '').toLowerCase().includes(lower)
      );
    });
  }, [doorStaffList, teamSearchTerm]);

  const hasNoSalesYet = useMemo(() => {
    return purchases.length === 0 && approvedPurchases === 0 && pendingReviewPurchases === 0;
  }, [purchases.length, approvedPurchases, pendingReviewPurchases]);

  const scrollToSection = useCallback((tab: DashboardTab) => {
    setActiveDashboardTab(tab);

    const refs: Record<DashboardTab, React.RefObject<HTMLDivElement | null>> = {
      summary: summarySectionRef,
      operations: operationsSectionRef,
      team: teamSectionRef,
      closing: closingSectionRef,
    };

    refs[tab].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const nextAction = useMemo(() => {
    if (hasNoSalesYet && !isFinished) {
      return {
        tone: 'blue' as const,
        title: 'Arrancá con tus primeras ventas',
        description:
          'Compartí tu link en WhatsApp e Instagram y, si querés moverlo más rápido, sumá uno o dos RRPP con su link personal.',
        actionLabel: 'Ver mi link',
        action: () => scrollToSection('summary'),
      };
    }

    if (!unlock.unlocked && !isFinished) {
      return {
        tone: 'rose' as const,
        title: 'Activá el panel para seguir sin límites',
        description: `Liberá el sistema y seguís vendiendo sin frenos.`,
        actionLabel: 'Ver activación',
        action: () => scrollToSection('closing'),
      };
    }

    if (pendingReviewPurchases > 0) {
      return {
        tone: 'amber' as const,
        title: `Tenés ${pendingReviewPurchases} pago${
          pendingReviewPurchases !== 1 ? 's' : ''
        } para revisar`,
        description:
          'Confirmalos cuanto antes para asegurar esas ventas y evitar dudas en la entrada.',
        actionLabel: 'Ir a cobros',
        action: () => scrollToSection('operations'),
      };
    }

    if (promoters.length === 0) {
      return {
        tone: 'blue' as const,
        title: 'Sumá RRPP y hacé crecer el alcance',
        description:
          'Cada RRPP puede tener su propio link y vos seguís todo desde este panel sin planillas.',
        actionLabel: 'Agregar RRPP',
        action: () => {
          setActiveTeamTab('promoter');
          setIsPromoterFormOpen(true);
          scrollToSection('team');
        },
      };
    }

    if (doorStaffList.length === 0) {
      return {
        tone: 'indigo' as const,
        title: 'Prepará la puerta antes del evento',
        description:
          'Creá accesos para tu equipo de ingreso así el control es más rápido y ordenado.',
        actionLabel: 'Configurar puerta',
        action: () => {
          setActiveTeamTab('door');
          setIsDoorFormOpen(true);
          scrollToSection('team');
        },
      };
    }

    return {
      tone: 'green' as const,
      title: 'Vas bien, seguí moviendo el evento',
      description:
        'Compartí el link, revisá pagos nuevos y mantené a tu equipo activo.',
      actionLabel: 'Ver cobros',
      action: () => scrollToSection('operations'),
    };
  }, [
    hasNoSalesYet,
    unlock.unlocked,
    isFinished,
    unlockPrice,
    pendingReviewPurchases,
    promoters.length,
    doorStaffList.length,
    scrollToSection,
  ]);

  const nextActionToneClasses = useMemo(() => {
    if (nextAction.tone === 'rose') return 'border-rose-200 bg-rose-50';
    if (nextAction.tone === 'amber') return 'border-amber-200 bg-amber-50';
    if (nextAction.tone === 'blue') return 'border-blue-200 bg-blue-50';
    if (nextAction.tone === 'indigo') return 'border-indigo-200 bg-indigo-50';
    return 'border-emerald-200 bg-emerald-50';
  }, [nextAction.tone]);

  const loadData = useCallback(
    async (silent = false) => {
      if (!id) return;

      try {
        if (silent) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const config = { timeout: 60000 };

        const results = await Promise.allSettled([
          api.get(`/raffles/${id}`, config).then((r) => r.data),
          api.get(`/raffles/${id}/dashboard`, config).then((r) => r.data),
          api.get(`/sellers/list/${id}`, config).then((r) => r.data),
          api.get(`/raffle-purchases/raffle/${id}`, config).then((r) => r.data),
        ]);

        const [publicRes, dashboardRes, sellersRes, purchasesRes] = results;

        const possibleErrors = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r) => r.reason);

        const unauthorized = possibleErrors.find(
          (e: any) => e?.response?.status === 401,
        );

        if (unauthorized) {
          navigate('/');
          return;
        }

        if (publicRes.status === 'fulfilled') {
          setEventData(publicRes.value);
        }

        if (dashboardRes.status === 'fulfilled') {
          setDashboard(dashboardRes.value);
        }

        if (sellersRes.status === 'fulfilled') {
          setPromoters(Array.isArray(sellersRes.value) ? sellersRes.value : []);
        }

        if (purchasesRes.status === 'fulfilled') {
          setPurchases(Array.isArray(purchasesRes.value) ? purchasesRes.value : []);
        } else if (!silent) {
          Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: 'warning',
            title: 'Algunos datos tardan en cargar. Probá de nuevo en unos segundos.',
            showConfirmButton: false,
            timer: 3500,
          });
        }

        const hasCriticalError =
          publicRes.status === 'rejected' || dashboardRes.status === 'rejected';

        if (hasCriticalError && !silent) {
          const error =
            publicRes.status === 'rejected'
              ? publicRes.reason
              : dashboardRes.status === 'rejected'
              ? dashboardRes.reason
              : null;

          const isTimeout =
            error?.code === 'ECONNABORTED' ||
            error?.message?.includes('timeout');

          if (isTimeout) {
            Swal.fire({
              toast: true,
              position: 'bottom-end',
              icon: 'warning',
              title:
                'La conexión está lenta. Estamos intentando actualizar.',
              showConfirmButton: false,
              timer: 3000,
            });
          } else {
            Swal.fire(
              'Error',
              'No pudimos cargar tu panel completo. Probá recargando la página.',
              'error',
            );
          }
        }
      } catch (e: any) {
        if (e?.name !== 'CanceledError' && e?.code !== 'ERR_CANCELED') {
          Swal.fire('Error', 'No se pudo actualizar tu información.', 'error');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id, navigate],
  );

  const scheduleLoadData = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      loadData(true);
    }, 700);
  }, [loadData]);

  useEffect(() => {
    if (!user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    loadData();

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [loadData]);

  useEffect(() => {
    if (!id) return;

    const onUpdate = () => scheduleLoadData();
    const onPurchaseUpdate = () => scheduleLoadData();
    const onFomo = (data: any) => {
      if (isFinished) return;
      if (Swal.isVisible()) return;

      Swal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'info',
        title: data.message,
        showConfirmButton: false,
        timer: 2200,
        background: '#ffffff',
        color: '#111827',
      });
    };

    socket.on(`raffle-${id}-update`, onUpdate);
    socket.on(`raffle-${id}-purchase-update`, onPurchaseUpdate);
    socket.on(`raffle-${id}-fomo`, onFomo);

    return () => {
      socket.off(`raffle-${id}-update`, onUpdate);
      socket.off(`raffle-${id}-purchase-update`, onPurchaseUpdate);
      socket.off(`raffle-${id}-fomo`, onFomo);
    };
  }, [id, isFinished, scheduleLoadData]);

  useEffect(() => {
    if (!eventData) return;

    const shareTimer = window.setTimeout(() => {
      promptShare(`creator-public-link-${id}`, {
        title: getSellerShareTitle(eventData?.title),
        text: shareMessage,
        url: shareLink,
      });
    }, 36000);

    const appTimer = window.setTimeout(() => {
      promptAppShare(`creator-app-${id}`, window.location.origin);
    }, 90000);

    return () => {
      window.clearTimeout(shareTimer);
      window.clearTimeout(appTimer);
    };
  }, [eventData, id, shareLink, shareMessage]);

  const copyLink = async () => {
    await copyText(shareMessage, 'Mensaje de difusión copiado.');
  };

  const sharePublicLink = () => {
    openWhatsAppShare(shareMessage);
  };

  const sendBuyerWhatsApp = (purchase: any) => {
    const phone = normalizePhoneForWhatsApp(purchase?.buyerPhone);

    const message = [
      `Hola ${purchase?.buyerName || ''}, ¿cómo va? Te escribo desde la organización de "${
        eventData?.title || ''
      }".`,
      '',
      `Tu estado actual es: *${getPurchaseStatusMeta(purchase?.status).label}*.`,
      `Lugares / números: ${getNumbersLabel(purchase?.numbers)}.`,
      `Forma de pago: ${getPaymentMethodLabel(purchase?.paymentMethod)}.`,
      '',
      'Cualquier duda, respondeme por acá.',
    ].join('\n');

    if (phone) {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      return;
    }

    openWhatsAppShare(message);
  };

  const openProofViewer = (proof: any) => {
    const preview = getProofPreviewData(proof);

    if (!preview.previewUrl && !preview.openUrl) {
      Swal.fire(
        'Archivo no disponible',
        'Este comprobante se cargó, pero no lo podemos mostrar desde acá. Pedíselo por WhatsApp.',
        'info',
      );
      return;
    }

    setProofViewer({
      url: String(preview.openUrl || preview.previewUrl),
      mimeType: preview.mimeType,
      isImage: preview.isImage,
      isPdf: preview.isPdf,
      fileName: proof?.fileName || 'Comprobante',
    });
  };

  const handleDownloadCSV = () => {
    if (purchasesSorted.length === 0) {
      return Swal.fire('No hay datos', 'Todavía no tenés operaciones para exportar.', 'info');
    }

    const headers = [
      'Operacion',
      'Estado',
      'Metodo',
      'Invitado',
      'Telefono',
      'Email',
      'Pases',
      'Cantidad',
      'Valor',
      'RRPP',
      'Tiene comprobante',
      'Fecha Reserva',
      'Fecha Aprobacion',
      'Fecha Ingreso',
    ];

    const rows = purchasesSorted.map((purchase: any) => [
      purchase.id,
      purchase.status || '',
      getPaymentMethodLabel(purchase.paymentMethod),
      `"${purchase.buyerName || ''}"`,
      purchase.buyerPhone || '',
      purchase.buyerEmail || '',
      `"${(purchase.numbers || []).map((n: any) => n.number).join(' / ')}"`,
      purchase.ticketCount || 0,
      toMoney(purchase.totalAmount),
      `"${
        purchase.createdBySeller
          ? `${purchase.createdBySeller.firstName || ''} ${
              purchase.createdBySeller.lastName || ''
            }`.trim()
          : 'Venta directa'
      }"`,
      purchase.latestProof ? 'Si' : 'No',
      purchase.reservedAt || '',
      purchase.approvedAt || '',
      purchase.checkedInAt || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join(
      '\n',
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Reporte_Ventas_${(eventData?.title || 'evento').replace(
        /\s+/g,
        '_',
      )}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareCredentials = async (params: {
    role: TeamRole;
    person: any;
    password: string;
  }) => {
    const phone = normalizePhoneForWhatsApp(getMemberWhatsapp(params.person));

    if (!phone) {
      Swal.fire(
        'Falta el número',
        'Para enviarle sus accesos directo por WhatsApp primero necesitás cargarle un número.',
        'warning',
      );
      return;
    }

    const shareUrl =
      params.person?.shareLink ||
      params.person?.sellerLink ||
      params.person?.publicLink ||
      params.person?.accessLink ||
      '';

    const loginUrl = params.person?.loginUrl || `${window.location.origin}/login`;

    const message = buildAccessMessage({
      role: params.role,
      personName: getMemberDisplayName(params.person),
      eventTitle: eventData?.title || 'Tu evento',
      email: params.person?.email || '',
      password: params.password,
      loginUrl,
      shareUrl,
      commissionPercent:
        params.role === 'promoter'
          ? params.person?.commissionPercent ?? params.person?.commission ?? null
          : null,
    });

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const promptShareCredentials = async (params: {
    role: TeamRole;
    person: any;
    password: string;
    successTitle: string;
  }) => {
    const result = await Swal.fire({
      title: params.successTitle,
      html: `
        <div style="text-align:left;line-height:1.7;color:#334155;font-size:14px;">
          <p>La cuenta para <b>${getMemberDisplayName(params.person)}</b> ya fue creada.</p>
          <p>Si querés, podés enviarle ahora mismo su acceso por WhatsApp.</p>
        </div>
      `,
      icon: 'success',
      showCancelButton: true,
      confirmButtonText: 'Enviar por WhatsApp',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#25D366',
      background: '#ffffff',
      color: '#111827',
    });

    if (result.isConfirmed) {
      await shareCredentials({
        role: params.role,
        person: params.person,
        password: params.password,
      });
    }
  };

  const askPasswordToReshare = async (params: { role: TeamRole; person: any }) => {
    const result = await Swal.fire({
      title: 'Reenviar acceso',
      html: `
        <div style="text-align:left;line-height:1.7;color:#334155;font-size:14px;">
          <p>Vas a reenviar los datos de acceso a <b>${getMemberDisplayName(
            params.person,
          )}</b>.</p>
          <p>Por seguridad, ingresá la contraseña actual para incluirla en el mensaje.</p>
          <input
            id="share-password"
            type="text"
            placeholder="Escribí la clave actual"
            style="
              width:100%;
              margin-top:12px;
              border:1px solid #cbd5e1;
              border-radius:14px;
              padding:12px 14px;
              font-size:14px;
              box-sizing:border-box;
            "
          />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Armar mensaje',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#25D366',
      background: '#ffffff',
      color: '#111827',
      preConfirm: () => {
        const password = (
          document.getElementById('share-password') as HTMLInputElement | null
        )?.value?.trim();

        if (!isStrongEnoughPassword(password || '')) {
          Swal.showValidationMessage(
            'Completá con una clave válida de al menos 6 caracteres',
          );
          return;
        }

        return { password };
      },
    });

    if (!result.isConfirmed) return;

    await shareCredentials({
      role: params.role,
      person: params.person,
      password: result.value.password,
    });
  };

  const validateTeamForm = (form: TeamForm, role: TeamRole) => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      Swal.fire(
        'Faltan datos',
        role === 'promoter'
          ? 'Completá nombre, apellido y mail para crear el acceso del RRPP.'
          : 'Completá nombre, apellido y mail para crear el acceso de puerta.',
        'warning',
      );
      return false;
    }

    if (!form.whatsapp.trim()) {
      Swal.fire(
        'Falta el WhatsApp',
        'Cargá un número para poder enviarle los datos de acceso.',
        'warning',
      );
      return false;
    }

    if (!isStrongEnoughPassword(form.password)) {
      Swal.fire(
        'Contraseña muy corta',
        'Usá una clave de al menos 6 caracteres.',
        'warning',
      );
      return false;
    }

    if (role === 'promoter' && Number(form.commissionPercent || 0) < 0) {
      Swal.fire(
        'Comisión inválida',
        'Si no lleva comisión, poné 0.',
        'warning',
      );
      return false;
    }

    return true;
  };

  const handleAddPromoter = async () => {
    if (isFinished) {
      return Swal.fire(
        'Evento finalizado',
        'Ya cerraste el evento, no podés agregar más vendedores.',
        'info',
      );
    }

    if (!validateTeamForm(newPromoter, 'promoter')) return;

    const payload = {
      firstName: newPromoter.firstName.trim(),
      lastName: newPromoter.lastName.trim(),
      email: newPromoter.email.trim(),
      password: newPromoter.password.trim(),
      whatsapp: newPromoter.whatsapp.trim(),
      commissionPercent: Number(newPromoter.commissionPercent || 0),
    };

    try {
      const response = await api.post(`/sellers/assign/${id}`, payload);
      const created = response?.data || payload;

      setNewPromoter({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        whatsapp: '',
        commissionPercent: '',
      });

      setIsPromoterFormOpen(false);
      scheduleLoadData();

      await promptShareCredentials({
        role: 'promoter',
        person: {
          ...created,
          ...payload,
        },
        password: payload.password,
        successTitle: '¡RRPP agregado!',
      });
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message || 'No pudimos registrar al RRPP.',
        'error',
      );
    }
  };

  const handleAddDoorStaff = async () => {
    if (isFinished) {
      return Swal.fire(
        'Evento finalizado',
        'Ya cerraste el evento, no hace falta crear nuevos accesos de puerta.',
        'info',
      );
    }

    if (!validateTeamForm(newDoorStaff, 'door')) return;

    const payload = {
      firstName: newDoorStaff.firstName.trim(),
      lastName: newDoorStaff.lastName.trim(),
      email: newDoorStaff.email.trim(),
      password: newDoorStaff.password.trim(),
      whatsapp: newDoorStaff.whatsapp.trim(),
    };

    try {
      const response = await api.post(`/raffles/${id}/door-staff`, payload);
      const created = response?.data || payload;

      setNewDoorStaff({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        whatsapp: '',
      });

      setIsDoorFormOpen(false);
      scheduleLoadData();

      await promptShareCredentials({
        role: 'door',
        person: {
          ...created,
          ...payload,
        },
        password: payload.password,
        successTitle: '¡Acceso de puerta creado!',
      });
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message ||
          'No pudimos guardar el acceso de puerta.',
        'error',
      );
    }
  };

  const handleEditPromoter = async (member: any) => {
    const result = await Swal.fire({
      title: 'Editar RRPP',
      html: `
        <div style="display:grid;gap:10px;text-align:left;">
          <input id="edit-firstName" class="swal2-input" placeholder="Nombre" value="${
            member?.firstName || ''
          }" />
          <input id="edit-lastName" class="swal2-input" placeholder="Apellido" value="${
            member?.lastName || ''
          }" />
          <input id="edit-email" class="swal2-input" placeholder="Correo" value="${
            member?.email || ''
          }" />
          <input id="edit-whatsapp" class="swal2-input" placeholder="WhatsApp" value="${
            getMemberWhatsapp(member) || ''
          }" />
          <input id="edit-password" class="swal2-input" placeholder="Nueva clave (opcional)" value="" />
          <input id="edit-commission" class="swal2-input" placeholder="% comisión" value="${
            member?.commissionPercent ?? member?.commission ?? 0
          }" />
          <p style="font-size:12px;color:#64748b;margin:0;">Si cambiás la clave, después podés reenviarle los datos por WhatsApp.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3483fa',
      background: '#ffffff',
      color: '#111827',
      preConfirm: () => {
        const firstName = (
          document.getElementById('edit-firstName') as HTMLInputElement | null
        )?.value?.trim();
        const lastName = (
          document.getElementById('edit-lastName') as HTMLInputElement | null
        )?.value?.trim();
        const email = (
          document.getElementById('edit-email') as HTMLInputElement | null
        )?.value?.trim();
        const whatsapp = (
          document.getElementById('edit-whatsapp') as HTMLInputElement | null
        )?.value?.trim();
        const password = (
          document.getElementById('edit-password') as HTMLInputElement | null
        )?.value?.trim();
        const commissionPercent = (
          document.getElementById('edit-commission') as HTMLInputElement | null
        )?.value?.trim();

        if (!firstName || !lastName || !email || !whatsapp) {
          Swal.showValidationMessage(
            'Nombre, apellido, correo y WhatsApp son obligatorios',
          );
          return;
        }

        if (password && !isStrongEnoughPassword(password)) {
          Swal.showValidationMessage(
            'La nueva clave tiene que tener al menos 6 caracteres',
          );
          return;
        }

        return {
          firstName,
          lastName,
          email,
          whatsapp,
          commissionPercent: Number(commissionPercent || 0),
          ...(password ? { password } : {}),
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await api.patch(`/sellers/${member.id}`, result.value);
      scheduleLoadData();

      if (result.value?.password) {
        await promptShareCredentials({
          role: 'promoter',
          person: { ...member, ...result.value },
          password: result.value.password,
          successTitle: '¡RRPP actualizado!',
        });
      } else {
        Swal.fire('Guardado', 'Los datos del RRPP fueron actualizados.', 'success');
      }
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message || 'No pudimos guardar los cambios.',
        'error',
      );
    }
  };

  const handleEditDoorStaff = async (member: any) => {
    const result = await Swal.fire({
      title: 'Editar acceso de puerta',
      html: `
        <div style="display:grid;gap:10px;text-align:left;">
          <input id="edit-firstName" class="swal2-input" placeholder="Nombre" value="${
            member?.firstName || ''
          }" />
          <input id="edit-lastName" class="swal2-input" placeholder="Apellido" value="${
            member?.lastName || ''
          }" />
          <input id="edit-email" class="swal2-input" placeholder="Correo" value="${
            member?.email || ''
          }" />
          <input id="edit-whatsapp" class="swal2-input" placeholder="WhatsApp" value="${
            getMemberWhatsapp(member) || ''
          }" />
          <input id="edit-password" class="swal2-input" placeholder="Nueva clave (opcional)" value="" />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3483fa',
      background: '#ffffff',
      color: '#111827',
      preConfirm: () => {
        const firstName = (
          document.getElementById('edit-firstName') as HTMLInputElement | null
        )?.value?.trim();
        const lastName = (
          document.getElementById('edit-lastName') as HTMLInputElement | null
        )?.value?.trim();
        const email = (
          document.getElementById('edit-email') as HTMLInputElement | null
        )?.value?.trim();
        const whatsapp = (
          document.getElementById('edit-whatsapp') as HTMLInputElement | null
        )?.value?.trim();
        const password = (
          document.getElementById('edit-password') as HTMLInputElement | null
        )?.value?.trim();

        if (!firstName || !lastName || !email || !whatsapp) {
          Swal.showValidationMessage(
            'Completá todos los datos obligatorios.',
          );
          return;
        }

        if (password && !isStrongEnoughPassword(password)) {
          Swal.showValidationMessage(
            'La clave nueva tiene que tener al menos 6 caracteres.',
          );
          return;
        }

        return {
          firstName,
          lastName,
          email,
          whatsapp,
          ...(password ? { password } : {}),
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await api.patch(`/raffles/${id}/door-staff/${member.id}`, result.value);
      scheduleLoadData();

      if (result.value?.password) {
        await promptShareCredentials({
          role: 'door',
          person: { ...member, ...result.value },
          password: result.value.password,
          successTitle: '¡Acceso actualizado!',
        });
      } else {
        Swal.fire(
          'Actualizado',
          'Los datos del equipo de puerta fueron guardados.',
          'success',
        );
      }
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message ||
          'No pudimos editar este acceso.',
        'error',
      );
    }
  };

  const handleTogglePromoterStatus = async (member: any) => {
    const nextIsActive = member?.isActive === false;

    const result = await Swal.fire({
      title: nextIsActive ? '¿Reactivar RRPP?' : '¿Pausar RRPP?',
      text: nextIsActive
        ? 'Va a poder volver a entrar y usar su link personal.'
        : 'Mientras esté pausado no va a poder entrar ni vender.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: nextIsActive ? 'Reactivar' : 'Pausar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nextIsActive ? '#16a34a' : '#dc2626',
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/sellers/${member.id}/status`, {
        isActive: nextIsActive,
      });
      scheduleLoadData();
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message || 'No pudimos cambiar el estado del RRPP.',
        'error',
      );
    }
  };

  const handleToggleDoorStaffStatus = async (member: any) => {
    const nextIsActive = member?.isActive === false;

    const result = await Swal.fire({
      title: nextIsActive
        ? '¿Reactivar acceso de puerta?'
        : '¿Pausar acceso de puerta?',
      text: nextIsActive
        ? 'Va a poder volver a ingresar y escanear.'
        : 'El usuario pierde acceso inmediato al control de ingreso.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: nextIsActive ? 'Reactivar' : 'Pausar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nextIsActive ? '#16a34a' : '#dc2626',
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/raffles/${id}/door-staff/${member.id}/status`, {
        isActive: nextIsActive,
      });
      scheduleLoadData();
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message ||
          'No pudimos cambiar el estado de este acceso.',
        'error',
      );
    }
  };

  const handleDeletePromoter = async (member: any) => {
    const sales = member?.soldTickets || member?.salesCount || 0;

    const result = await Swal.fire({
      title: 'Eliminar RRPP',
      html: `
        <div style="text-align:left;line-height:1.7;color:#334155;font-size:14px;">
          <p>Vas a sacar a <b>${getMemberDisplayName(member)}</b> del evento.</p>
          ${
            sales > 0
              ? `<p><b>Ojo:</b> este RRPP ya generó <b>${sales}</b> venta${
                  sales !== 1 ? 's' : ''
                }. En ese caso suele convenir pausar en vez de eliminar.</p>`
              : `<p>Como todavía no vendió, eliminarlo no te afecta el historial del evento.</p>`
          }
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/sellers/${member.id}`);
      scheduleLoadData();

      Swal.fire('Eliminado', 'El RRPP fue quitado del evento.', 'success');
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message || 'No pudimos eliminarlo.',
        'error',
      );
    }
  };

  const handleDeleteDoorStaff = async (member: any) => {
    const result = await Swal.fire({
      title: 'Eliminar acceso de puerta',
      html: `
        <div style="text-align:left;line-height:1.7;color:#334155;font-size:14px;">
          <p>Si eliminás a <b>${getMemberDisplayName(member)}</b>, su acceso deja de funcionar.</p>
          <p>Si solo querés frenarlo por un rato, usá “Pausar”.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/raffles/${id}/door-staff/${member.id}`);
      scheduleLoadData();

      Swal.fire('Eliminado', 'El acceso fue quitado.', 'success');
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message || 'No pudimos eliminar este acceso.',
        'error',
      );
    }
  };

  const handleApprovePurchase = async (purchase: any) => {
    const result = await Swal.fire({
      title: 'Confirmar pago',
      html: `
        <div style="text-align:left;">
          <div style="margin-bottom:14px;padding:14px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
            <div style="font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">
              Vas a confirmar a:
            </div>
            <div style="margin-top:8px;font-size:18px;font-weight:800;color:#0f172a;">
              ${purchase?.buyerName || 'Invitado sin nombre'}
            </div>
            <div style="margin-top:6px;font-size:14px;color:#334155;">
              Lugares / números: <b>${getNumbersLabel(purchase?.numbers)}</b>
            </div>
            <div style="margin-top:4px;font-size:14px;color:#334155;">
              Pago: <b>${getPaymentMethodLabel(purchase?.paymentMethod)}</b> por <b>$${toMoney(
        purchase?.totalAmount,
      ).toLocaleString('es-AR')}</b>
            </div>
            <div style="margin-top:4px;font-size:14px;color:#334155;">
              Comprobante: <b>${purchase?.latestProof ? 'Cargado' : 'Sin adjunto'}</b>
            </div>
          </div>

          <label for="approve-notes" style="display:block;margin-bottom:8px;font-size:14px;font-weight:800;color:#0f172a;">
            Nota interna (opcional)
          </label>
          <textarea
            id="approve-notes"
            rows="5"
            placeholder="Ej: Transferencia verificada desde Mercado Pago..."
            style="
              width:100%;
              resize:none;
              border:1px solid #cbd5e1;
              border-radius:16px;
              padding:14px;
              font-size:14px;
              line-height:1.6;
              color:#0f172a;
              background:#ffffff;
              outline:none;
              box-sizing:border-box;
            "
          ></textarea>

          <p style="margin-top:10px;font-size:12px;line-height:1.6;color:#64748b;">
            Al confirmar, esta reserva pasa a estar lista para el evento.
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      background: '#ffffff',
      color: '#111827',
      width: 640,
      focusConfirm: false,
      preConfirm: () => {
        const notes = (
          document.getElementById('approve-notes') as HTMLTextAreaElement | null
        )?.value;
        return {
          reviewNotes: notes?.trim() || undefined,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/raffle-purchases/${purchase.id}/approve`, {
        reviewNotes: result.value?.reviewNotes,
      });

      if (selectedPurchase?.id === purchase.id) {
        setSelectedPurchase(null);
      }

      Swal.fire({
        icon: 'success',
        title: 'Pago confirmado',
        text: 'La reserva ya quedó lista.',
        confirmButtonColor: '#16a34a',
        background: '#ffffff',
        color: '#111827',
      });

      scheduleLoadData();
    } catch (error: any) {
      Swal.fire(
        'Error',
        error?.response?.data?.message ||
          'No pudimos confirmar este pago.',
        'error',
      );
    }
  };

  const handleRejectPurchase = async (purchase: any) => {
    const result = await Swal.fire({
      title: 'Rechazar reserva',
      html: `
        <div style="text-align:left;">
          <div style="margin-bottom:14px;padding:14px;border-radius:16px;background:#fff1f2;border:1px solid #fecdd3;">
            <div style="font-size:12px;font-weight:800;color:#be123c;text-transform:uppercase;letter-spacing:.08em;">
              Se van a liberar estos lugares de:
            </div>
            <div style="margin-top:8px;font-size:18px;font-weight:800;color:#0f172a;">
              ${purchase?.buyerName || 'Invitado sin nombre'}
            </div>
            <div style="margin-top:6px;font-size:14px;color:#334155;">
              Lugares / números: <b>${getNumbersLabel(purchase?.numbers)}</b>
            </div>
          </div>

          <label for="reject-reason" style="display:block;margin-bottom:8px;font-size:14px;font-weight:800;color:#0f172a;">
            Motivo <span style="color:#dc2626;">*</span>
          </label>
          <textarea
            id="reject-reason"
            rows="5"
            placeholder="Ej: comprobante inválido, pago no impactado, carga duplicada..."
            style="
              width:100%;
              resize:none;
              border:1px solid #fca5a5;
              border-radius:16px;
              padding:14px;
              font-size:14px;
              line-height:1.6;
              color:#0f172a;
              background:#ffffff;
              outline:none;
              box-sizing:border-box;
            "
          ></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Rechazar y liberar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      background: '#ffffff',
      color: '#111827',
      width: 640,
      focusConfirm: false,
      preConfirm: () => {
        const reason = (
          document.getElementById('reject-reason') as HTMLTextAreaElement | null
        )?.value;

        if (!reason?.trim()) {
          Swal.showValidationMessage(
            'Escribí el motivo para que quede registro.',
          );
          return;
        }

        return {
          reason: reason.trim(),
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/raffle-purchases/${purchase.id}/reject`, {
        reason: result.value.reason,
      });

      if (selectedPurchase?.id === purchase.id) {
        setSelectedPurchase(null);
      }

      Swal.fire({
        icon: 'success',
        title: 'Reserva rechazada',
        text: 'Los lugares volvieron a quedar disponibles.',
        confirmButtonColor: '#dc2626',
        background: '#ffffff',
        color: '#111827',
      });

      scheduleLoadData();
    } catch (error: any) {
      Swal.fire(
        'Error',
        error?.response?.data?.message ||
          'No pudimos rechazar esta reserva.',
        'error',
      );
    }
  };

  const handleUnlockCheckout = async () => {
    try {
      Swal.fire({
        title: 'Preparando tu link de activación...',
        didOpen: () => Swal.showLoading(),
        background: '#ffffff',
        color: '#111827',
      });

      const response = await api.post('/raffle-access-payments/checkout', {
        raffleId: id,
        forceUnlock: true,
        allowEarlyUnlock: true,
        ignoreFreeLimit: true,
        payBeforeThreshold: true,
      });

      Swal.close();

      if (response.data?.alreadyUnlocked) {
        await Swal.fire({
          icon: 'success',
          title: '¡Panel activado!',
          text: 'Ya podés seguir operando sin límites.',
          background: '#ffffff',
          color: '#111827',
        });
        await loadData(true);
        return;
      }

      if (response.data?.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
        return;
      }

      Swal.fire(
        'Algo pasó',
        'No pudimos generar el enlace de pago ahora. Probá de nuevo en un rato.',
        'warning',
      );
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'No pudimos iniciar la activación. Probá de nuevo.';

      if (String(msg).toLowerCase().includes('límite gratuito')) {
        Swal.fire(
          'Todavía no hace falta pagar',
          'Seguís dentro del tramo gratis. Cuando lo superes, vas a poder activar el panel.',
          'info',
        );
        return;
      }

      Swal.fire('Ups', msg, 'error');
    }
  };

  const handleCloseEvent = async () => {
    if (isFinished) {
      Swal.fire(
        'El evento ya está cerrado',
        'El link de ventas ya quedó desactivado.',
        'info',
      );
      return;
    }

    if (!unlock.unlocked) {
      const result = await Swal.fire({
        title: 'Primero activá el panel',
        html: `
          <div style="text-align:left; line-height:1.7; color:#334155; font-size:14px;">
            <p>Antes de cerrar definitivamente el evento, necesitás activar el panel completo.</p>
            <p>Eso te libera el sistema y consolida toda la gestión final.</p>
            <p style="margin-top:10px;"><b>Valor:</b> $${unlockPrice.toLocaleString(
              'es-AR',
            )}</p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ir a activarlo',
        cancelButtonText: 'Ahora no',
        confirmButtonColor: '#3483fa',
        background: '#ffffff',
        color: '#111827',
      });

      if (result.isConfirmed) {
        scrollToSection('closing');
      }

      return;
    }

    const result = await Swal.fire({
      title: '¿Cerrar ventas definitivamente?',
      html: `
        <div style="text-align:left; line-height:1.7; color:#334155; font-size:14px;">
          <p>Si seguís, el link deja de aceptar nuevas reservas.</p>
          <p style="margin-top:10px;"><b>Hacelo solo si ya no querés sumar más gente.</b></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar ventas',
      cancelButtonText: 'Todavía no',
      confirmButtonColor: '#3483fa',
      background: '#ffffff',
      color: '#111827',
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({
        title: 'Cerrando evento...',
        didOpen: () => Swal.showLoading(),
        background: '#ffffff',
        allowOutsideClick: false,
      });

      await api.post(`/raffles/${id}/finalize-draw`, {
        winners: [],
      });

      await loadData(true);

      Swal.fire('Evento cerrado', 'El link ya no acepta nuevas ventas.', 'success');
    } catch (err: any) {
      Swal.fire(
        'Error',
        err?.response?.data?.message ||
          'No pudimos cerrar el evento.',
        'error',
      );
    }
  };

  if ((isLoading && !eventData) || (isLoading && !dashboard)) {
    return (
      <>
        <main className="page-fade px-3 pt-1">
          <AppHeader
            title="Armando tu panel..."
            subtitle="Estamos trayendo ventas, equipo y estado general."
            showBack
            onBack={() => navigate('/')}
            rightSlot={
              <button
                type="button"
                onClick={() =>
                  openHelpModal(
                    '¿Por qué tarda a veces?',
                    `
                      <p>Estamos agrupando ventas, pagos, métricas y equipo en un mismo panel.</p>
                    `,
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-black/5 bg-white text-[#3483fa] shadow-sm"
              >
                <i className="fas fa-headset text-[14px]"></i>
              </button>
            }
          />

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#3483fa]"></div>
            <p className="text-[14px] font-bold text-slate-700">
              Estamos preparando tu panel...
            </p>
          </div>
        </main>

        <BottomNav
          items={[
            { label: 'Inicio', icon: 'fa-home', to: '/' },
            { label: 'Atrás', icon: 'fa-arrow-left', onClick: () => navigate('/') },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <main className="page-fade min-h-screen bg-slate-50 px-3 pb-24 pt-2 md:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <AppHeader
            title={eventData?.title}
            subtitle={
              isFinished
                ? `Evento cerrado el ${formatDateTime(
                    eventData?.finishedAt || dashboard?.finishedAt,
                  )}`
                : `Ventas activas · ${eventTypeLabel} · ${capacityUnitLabel}`
            }
            showBack
            onBack={() => navigate('/')}
            rightSlot={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={sharePublicLink}
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-[#25D366] bg-[#25D366] text-white shadow-sm transition hover:scale-105"
                  title="Compartir link por WhatsApp"
                >
                  <i className="fab fa-whatsapp text-[15px]"></i>
                </button>

                <button
                  type="button"
                  onClick={() => loadData(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-slate-200 bg-white text-[#3483fa] shadow-sm transition hover:bg-slate-50"
                  title="Actualizar datos"
                >
                  <i
                    className={cx(
                      'fas fa-rotate-right text-[14px]',
                      isRefreshing && 'animate-spin',
                    )}
                  ></i>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openHelpModal(
                      'Cómo usar este panel',
                      `
                        <p>Desde acá manejás ventas, equipo y puerta en un solo lugar.</p>
                      `,
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-slate-200 bg-white text-[#3483fa] shadow-sm transition hover:bg-slate-50"
                  title="Cómo usar este panel"
                >
                  <i className="fas fa-headset text-[14px]"></i>
                </button>
              </div>
            }
          />

          <div className="sticky top-[72px] z-20 mt-4 rounded-[22px] border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur lg:hidden">
            <div className="grid grid-cols-4 gap-2">
              <QuickJumpButton
                label="Resumen"
                active={activeDashboardTab === 'summary'}
                onClick={() => scrollToSection('summary')}
              />
              <QuickJumpButton
                label="Cobros"
                active={activeDashboardTab === 'operations'}
                badge={pendingReviewPurchases > 0 ? pendingReviewPurchases : null}
                onClick={() => scrollToSection('operations')}
              />
              <QuickJumpButton
                label="Equipo"
                active={activeDashboardTab === 'team'}
                onClick={() => scrollToSection('team')}
              />
              <QuickJumpButton
                label="Cierre"
                active={activeDashboardTab === 'closing'}
                onClick={() => scrollToSection('closing')}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <section ref={summarySectionRef} className="scroll-mt-[120px]">
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="bg-[#fff159] px-4 py-5 lg:p-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">
                      Tu link principal
                    </p>
                    <h2 className="mt-1 text-[24px] font-black leading-tight text-slate-900 lg:text-[30px]">
                      Compartilo y empezá a mover el evento
                    </h2>
                    <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-700 lg:text-[15px]">
                      Este es el enlace que tenés que usar para difundir el evento y sumar reservas sin explicar todo por mensaje una y otra vez.
                    </p>

                    <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-[#e6d950]/60 p-3 lg:p-4">
                      <p className="min-w-0 flex-1 break-all text-[13px] font-medium leading-5 text-slate-800 lg:text-[15px]">
                        {shareLink}
                      </p>

                      <button
                        type="button"
                        onClick={() => copyText(shareLink, '¡Link copiado!')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#3483fa] shadow-sm transition hover:scale-105"
                        title="Copiar link"
                      >
                        <i className="fas fa-copy text-[14px]"></i>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
                    <div className="space-y-4">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[12px] font-black uppercase tracking-wide text-emerald-700">
                          Cómo sacarle jugo
                        </p>
                        <p className="mt-2 text-[13px] leading-6 text-slate-700 lg:text-[14px]">
                          Pegalo en WhatsApp, historias de Instagram, perfil de bio o donde más te muevas. Así la gente entra, entiende y reserva sin depender de vos.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={copyLink}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-slate-900 px-4 py-3 text-[14px] font-black text-white transition hover:bg-slate-800"
                        >
                          <i className="fas fa-copy"></i>
                          Copiar mensaje
                        </button>

                        <button
                          type="button"
                          onClick={sharePublicLink}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#25D366] px-4 py-3 text-[14px] font-black text-white transition hover:bg-[#20ba56]"
                        >
                          <i className="fab fa-whatsapp"></i>
                          Compartir
                        </button>

                        <Link
                          to={`/raffle/${id}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          <i className="fas fa-eye text-[#3483fa]"></i>
                          Vista pública
                        </Link>
                      </div>
                    </div>

                    <div
                      className={cx(
                        'rounded-[22px] border p-4 shadow-sm lg:p-5',
                        nextActionToneClasses,
                      )}
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Próximo paso recomendado
                      </p>
                      <p className="mt-2 text-[18px] font-black leading-tight text-slate-900">
                        {nextAction.title}
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-slate-700">
                        {nextAction.description}
                      </p>

                      <button
                        type="button"
                        onClick={nextAction.action}
                        className="mt-4 rounded-[14px] bg-slate-900 px-4 py-2.5 text-[13px] font-black text-white transition hover:bg-slate-800"
                      >
                        {nextAction.actionLabel}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:p-6">
                  <SectionTitle
                    kicker="Resumen del evento"
                    title="Así viene tu fecha"
                    description="Una vista rápida para saber si estás vendiendo bien, si te falta revisar pagos o si ya tenés que mover más difusión."
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          openHelpModal(
                            'Cómo leer este resumen',
                            `
                              <p>Este bloque te muestra en un vistazo cómo viene el evento y qué conviene hacer ahora.</p>
                            `,
                          )
                        }
                        className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa] transition hover:bg-[#d8e6fa]"
                      >
                        <i className="fas fa-chart-line"></i>
                      </button>
                    }
                  />

                  <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[13px] font-bold text-slate-700">
                        Ocupación sobre tu objetivo
                      </p>
                      <p className="text-[16px] font-black text-[#3483fa]">
                        {salesProgressPercent}%
                      </p>
                    </div>

                    <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#3483fa] transition-all duration-500"
                        style={{ width: `${salesProgressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      label="Ventas confirmadas"
                      value={operationalOutsideCount}
                      sublabel={`${outsidePeopleCount} personas confirmadas`}
                      tone="green"
                    />
                    <StatCard
                      label="Ingresos validados"
                      value={operationalInsideCount}
                      sublabel={`${insidePeopleCount} persona${insidePeopleCount !== 1 ? 's' : ''} ya entró`}
                      tone="indigo"
                    />
                    <StatCard
                      label="Pagos pendientes"
                      value={pendingReviewPurchases}
                      sublabel="Todavía necesitan tu confirmación"
                      tone="amber"
                    />
                    <StatCard
                      label="Reservas liberadas"
                      value={rejectedPurchases}
                      sublabel="Se volvieron a dejar disponibles"
                      tone="rose"
                    />
                    <StatCard
                      label="Personas entre confirmados e ingresos"
                      value={operationalConfirmedPeople}
                      sublabel="Sumando lo confirmado y lo ya validado"
                    />
                    <StatCard
                      label="Capacidad total"
                      value={dashboard?.totalTickets || 0}
                      sublabel={capacityUnitLabel}
                    />

                    <StatCard
                      label="Estado del panel"
                      value={unlock.unlocked ? 'Al día' : 'Pendiente de activar'}
                      sublabel={
                        unlock.unlocked
                          ? 'Podés seguir operando sin trabas'
                          : 'Activá el panel para seguir sin límites'
                      }
                      tone={unlock.unlocked ? 'green' : 'rose'}
                    />
                  </div>

                  {hasNoSalesYet && !isFinished ? (
                    <div className="mt-5 rounded-[22px] border border-blue-200 bg-blue-50 p-4 lg:p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                        Primeros pasos
                      </p>
                      <p className="mt-1 text-[18px] font-black text-slate-900">
                        Todavía no arrancaste a mover el evento
                      </p>
                      <div className="mt-3 space-y-2 text-[13px] leading-6 text-slate-700">
                        <p>1. Compartí tu link en WhatsApp y tus historias.</p>
                        <p>2. Sumá 1 o 2 RRPP si querés que se difunda más rápido.</p>
                        <p>3. Dejá bien clara la fecha, lugar y forma de pago para que la gente no te pregunte todo por privado.</p>
                      </div>
                    </div>
                  ) : null}

                  {eventData?.eventType === 'tables' ? (
                    <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[12px] font-black uppercase tracking-wide text-slate-500">
                        Estado de mesas
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <div className="rounded-[16px] border border-slate-200 bg-white p-3">
                          <p className="text-[11px] text-slate-500">Mesas totales</p>
                          <p className="mt-1 text-[20px] font-black text-slate-900">
                            {totalTables}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-slate-200 bg-white p-3">
                          <p className="text-[11px] text-slate-500">Personas por mesa</p>
                          <p className="mt-1 text-[20px] font-black text-slate-900">
                            {chairsPerTable}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-[11px] text-emerald-700">Mesas ocupadas</p>
                          <p className="mt-1 text-[20px] font-black text-emerald-900">
                            {occupiedTables}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-slate-200 bg-white p-3">
                          <p className="text-[11px] text-slate-500">Mesas libres</p>
                          <p className="mt-1 text-[20px] font-black text-slate-900">
                            {freeTables}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-3">
                          <p className="text-[11px] text-amber-700">Personas sin ubicar</p>
                          <p className="mt-1 text-[20px] font-black text-amber-900">
                            {unassignedGuests}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
                        <p className="text-[14px] font-black text-slate-900">
                          Organización de mesas
                        </p>
                        <p className="mt-1 text-[13px] leading-6 text-slate-600">
                          Ya ubicaste a <b>{assignedGuests}</b> invitado
                          {assignedGuests !== 1 ? 's' : ''} y todavía te faltan asignar{' '}
                          <b>{unassignedGuests}</b>.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section
                ref={teamSectionRef}
                className="scroll-mt-[120px] rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:p-6"
              >
                <SectionTitle
                  kicker="Equipo"
                  title="Sumá ventas y ordená la puerta"
                  description="Creá accesos para RRPP y para tu equipo de ingreso. Cada uno ve solo lo que necesita."
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        openHelpModal(
                          'Para qué sirve el equipo',
                          `
                            <p>Los RRPP venden con su link y vos ves todo ordenado. El equipo de puerta entra solo a validar ingresos.</p>
                          `,
                        )
                      }
                      className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa] transition hover:bg-[#d8e6fa]"
                    >
                      <i className="fas fa-users"></i>
                    </button>
                  }
                />

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTeamTab('promoter')}
                    className={cx(
                      'rounded-[18px] border px-4 py-3 text-left transition',
                      activeTeamTab === 'promoter'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700',
                    )}
                  >
                    <p className="text-[12px] font-black uppercase tracking-wide opacity-80">
                      RRPP / Ventas
                    </p>
                    <p className="mt-1 text-[18px] font-black">{promoters.length}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTeamTab('door')}
                    className={cx(
                      'rounded-[18px] border px-4 py-3 text-left transition',
                      activeTeamTab === 'door'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700',
                    )}
                  >
                    <p className="text-[12px] font-black uppercase tracking-wide opacity-80">
                      Puerta
                    </p>
                    <p className="mt-1 text-[18px] font-black">{doorStaffList.length}</p>
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                  <div className="relative flex-1">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="text"
                      placeholder={
                        activeTeamTab === 'promoter'
                          ? 'Buscar RRPP...'
                          : 'Buscar personal de puerta...'
                      }
                      value={teamSearchTerm}
                      onChange={(e) => setTeamSearchTerm(e.target.value)}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-[14px] text-slate-900 outline-none transition focus:border-[#3483fa] focus:bg-white"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeTeamTab === 'promoter') {
                        setIsPromoterFormOpen((prev) => !prev);
                        setIsDoorFormOpen(false);
                      } else {
                        setIsDoorFormOpen((prev) => !prev);
                        setIsPromoterFormOpen(false);
                      }
                    }}
                    className="rounded-[18px] bg-slate-900 px-4 py-3 text-[14px] font-black text-white transition hover:bg-slate-800"
                  >
                    <i className="fas fa-user-plus mr-2"></i>
                    {activeTeamTab === 'promoter'
                      ? 'Agregar RRPP'
                      : 'Agregar acceso de puerta'}
                  </button>
                </div>

                {activeTeamTab === 'promoter' && isPromoterFormOpen && !isFinished ? (
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:p-5">
                    <p className="mb-4 text-[16px] font-black text-slate-900">
                      Nuevo RRPP
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={newPromoter.firstName}
                        onChange={(e) =>
                          setNewPromoter({ ...newPromoter, firstName: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="text"
                        placeholder="Apellido"
                        value={newPromoter.lastName}
                        onChange={(e) =>
                          setNewPromoter({ ...newPromoter, lastName: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="email"
                        placeholder="Correo para ingresar"
                        value={newPromoter.email}
                        onChange={(e) =>
                          setNewPromoter({ ...newPromoter, email: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="text"
                        placeholder="Clave"
                        value={newPromoter.password}
                        onChange={(e) =>
                          setNewPromoter({ ...newPromoter, password: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="text"
                        placeholder="WhatsApp"
                        value={newPromoter.whatsapp}
                        onChange={(e) =>
                          setNewPromoter({
                            ...newPromoter,
                            whatsapp: sanitizePhoneInput(e.target.value),
                          })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="number"
                        placeholder="% comisión"
                        value={newPromoter.commissionPercent}
                        onChange={(e) =>
                          setNewPromoter({
                            ...newPromoter,
                            commissionPercent: e.target.value,
                          })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleAddPromoter}
                        className="flex-1 rounded-[16px] bg-[#3483fa] py-3 text-[14px] font-black text-white transition hover:bg-blue-600"
                      >
                        Crear acceso
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPromoterFormOpen(false)}
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                {activeTeamTab === 'door' && isDoorFormOpen && !isFinished ? (
                  <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:p-5">
                    <p className="mb-4 text-[16px] font-black text-slate-900">
                      Nuevo acceso de puerta
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Nombre"
                        value={newDoorStaff.firstName}
                        onChange={(e) =>
                          setNewDoorStaff({ ...newDoorStaff, firstName: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="text"
                        placeholder="Apellido"
                        value={newDoorStaff.lastName}
                        onChange={(e) =>
                          setNewDoorStaff({ ...newDoorStaff, lastName: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="email"
                        placeholder="Correo para ingresar"
                        value={newDoorStaff.email}
                        onChange={(e) =>
                          setNewDoorStaff({ ...newDoorStaff, email: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <input
                        type="text"
                        placeholder="Clave"
                        value={newDoorStaff.password}
                        onChange={(e) =>
                          setNewDoorStaff({ ...newDoorStaff, password: e.target.value })
                        }
                        className="mp-input bg-white !text-[14px] lg:!py-3.5"
                      />

                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="WhatsApp"
                          value={newDoorStaff.whatsapp}
                          onChange={(e) =>
                            setNewDoorStaff({
                              ...newDoorStaff,
                              whatsapp: sanitizePhoneInput(e.target.value),
                            })
                          }
                          className="mp-input bg-white !text-[14px] lg:!py-3.5"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleAddDoorStaff}
                        className="flex-1 rounded-[16px] bg-slate-900 py-3 text-[14px] font-black text-white transition hover:bg-slate-800"
                      >
                        Crear acceso
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsDoorFormOpen(false)}
                        className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {activeTeamTab === 'promoter' ? (
                    filteredPromoters.length === 0 ? (
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-[14px] text-slate-600">
                        {promoters.length === 0
                          ? 'Todavía no sumaste RRPP. Si querés vender más sin hacerlo todo vos, este es el mejor siguiente paso.'
                          : 'No encontramos ningún RRPP con esa búsqueda.'}
                      </div>
                    ) : (
                      filteredPromoters.map((member: any, i: number) => (
                        <motion.div
                          key={member.id || member.email || i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <TeamMemberCard
                            role="promoter"
                            member={member}
                            onEdit={() => handleEditPromoter(member)}
                            onShare={() =>
                              askPasswordToReshare({
                                role: 'promoter',
                                person: member,
                              })
                            }
                            onToggle={() => handleTogglePromoterStatus(member)}
                            onDelete={() => handleDeletePromoter(member)}
                          />
                        </motion.div>
                      ))
                    )
                  ) : filteredDoorStaff.length === 0 ? (
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-[14px] text-slate-600">
                      {doorStaffList.length === 0
                        ? 'Todavía no creaste accesos de puerta. Prepararlos antes del evento te evita demoras en el ingreso.'
                        : 'No encontramos ningún perfil con esa búsqueda.'}
                    </div>
                  ) : (
                    filteredDoorStaff.map((member: any, i: number) => (
                      <motion.div
                        key={member.id || member.email || i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <TeamMemberCard
                          role="door"
                          member={member}
                          onEdit={() => handleEditDoorStaff(member)}
                          onShare={() =>
                            askPasswordToReshare({
                              role: 'door',
                              person: member,
                            })
                          }
                          onToggle={() => handleToggleDoorStaffStatus(member)}
                          onDelete={() => handleDeleteDoorStaff(member)}
                        />
                      </motion.div>
                    ))
                  )}
                </div>
              </section>

              <section
                ref={closingSectionRef}
                className="scroll-mt-[120px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-5 lg:p-6">
                  <SectionTitle
                    kicker="Activación y cierre"
                    title={
                      isFinished
                        ? 'Evento cerrado'
                        : 'Activá el panel y manejá el cierre'
                    }
                    description={
                      isFinished
                        ? 'Las ventas ya quedaron cerradas y el evento pasó a histórico.'
                        : 'Con un pago único liberás el panel completo. Cuando ya no quieras vender más, también podés cerrar el evento desde acá.'
                    }
                  />
                </div>

                <div className="p-4 lg:p-6">
                  {!isFinished ? (
                    <>
                      <div
                        className={cx(
                          'rounded-[22px] border p-4 lg:p-5',
                          unlock.unlocked
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-rose-200 bg-rose-50',
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p
                              className={cx(
                                'text-[11px] font-black uppercase tracking-[0.16em]',
                                unlock.unlocked
                                  ? 'text-emerald-700'
                                  : 'text-rose-700',
                              )}
                            >
                              Activación del panel
                            </p>
                            <p className="mt-1 text-[18px] font-black text-slate-900 lg:text-[20px]">
                              {unlock.unlocked
                                ? 'Panel activado'
                                : 'Pago único para seguir sin límites'}
                            </p>
<p className="mt-2 text-[13px] leading-6 text-slate-700 lg:text-[14px]">
  {unlock.unlocked
    ? 'Ya tenés el sistema activo y podés seguir operando con normalidad.'
    : confirmedForUnlock <= 0
    ? `Todavía no usaste ninguna de tus ${freeLimit} operaciones incluidas. Cuando lo necesites, podés activar el panel por $${unlockPrice.toLocaleString(
        'es-AR',
      )}.`
    : confirmedForUnlock < freeLimit
    ? `Ya usaste ${confirmedForUnlock} de tus ${freeLimit} operaciones incluidas. Si querés, podés activar el panel por $${unlockPrice.toLocaleString(
        'es-AR',
      )} antes de llegar al límite.`
    : `Ya alcanzaste tus ${freeLimit} operaciones incluidas. Activá el panel por $${unlockPrice.toLocaleString(
        'es-AR',
      )} para seguir sin bloqueos.`}
</p>
                          </div>

                          {!unlock.unlocked ? (
                            <div className="rounded-[18px] border border-white/70 bg-white px-4 py-3 text-right shadow-sm">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                Pago único
                              </p>
                              <p className="mt-1 text-[22px] font-black text-slate-900">
                                ${unlockPrice.toLocaleString('es-AR')}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-600">
                              Tramo gratis inicial
                            </span>
                            <span className="text-[12px] font-black text-slate-900">
                              {Math.min(confirmedForUnlock, freeLimit)} / {freeLimit}
                            </span>
                          </div>

                          <div className="h-4 w-full overflow-hidden rounded-full bg-white/70">
                            <div
                              className={cx(
                                'h-full rounded-full transition-all',
                                unlock.requiresUnlockPayment
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                  : 'bg-gradient-to-r from-[#3483fa] to-[#6aa7ff]',
                              )}
                              style={{ width: `${unlockProgress}%` }}
                            ></div>
                          </div>

                          {!unlock.unlocked && !unlock.requiresUnlockPayment ? (
                            <p className="mt-2 text-[12px] leading-5 text-slate-700">
                              Todavía estás dentro del tramo gratis. Te quedan{' '}
                              <b>{remainingFree}</b> operación
                              {remainingFree !== 1 ? 'es' : ''} antes de activar el panel.
                            </p>
                          ) : null}

                          {!unlock.unlocked && unlock.requiresUnlockPayment ? (
                            <p className="mt-2 text-[12px] leading-5 text-amber-700">
                              Ya superaste el tramo gratis. Activá el panel cuanto antes para seguir vendiendo sin trabas.
                            </p>
                          ) : null}

                          {unlock.unlocked ? (
                            <p className="mt-2 text-[12px] leading-5 text-emerald-700">
                              Todo listo: el panel ya está activo.
                            </p>
                          ) : null}
                        </div>

                        {!unlock.unlocked ? (
                          <button
                            type="button"
                            onClick={handleUnlockCheckout}
                            className="mt-4 w-full rounded-[18px] bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] px-4 py-4 text-[15px] font-black text-white transition hover:scale-[1.01]"
                          >
                            <i className="fas fa-wallet mr-2"></i>
                            Activar panel por ${unlockPrice.toLocaleString('es-AR')}
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-5 rounded-[22px] border border-blue-200 bg-blue-50 p-4 lg:p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa]">
                          Cierre del evento
                        </p>
                        <p className="mt-1 text-[18px] font-black text-slate-900 lg:text-[20px]">
                          Cerrar ventas definitivamente
                        </p>
                        <p className="mt-2 text-[13px] leading-6 text-slate-700 lg:text-[14px]">
                          Usá esto cuando ya no quieras aceptar nuevas reservas.
                        </p>

                        <button
                          type="button"
                          onClick={handleCloseEvent}
                          className={cx(
                            'mt-4 w-full rounded-[18px] py-4 text-[15px] font-black transition',
                            isFinished
                              ? 'cursor-not-allowed border border-slate-300 bg-slate-200 text-slate-500'
                              : 'bg-slate-900 text-white hover:bg-slate-800',
                          )}
                          disabled={isFinished}
                        >
                          <i
                            className={cx(
                              'fas mr-2',
                              isFinished ? 'fa-check-circle' : 'fa-power-off',
                            )}
                          ></i>
                          {isFinished
                            ? 'Evento ya cerrado'
                            : 'Cerrar ventas'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                      <p className="text-[18px] font-black">
                        Evento cerrado
                      </p>
                      <p className="mt-2 text-[14px] leading-6">
                        Las ventas quedaron cerradas el{' '}
                        {formatDateTime(
                          eventData?.finishedAt || dashboard?.finishedAt,
                        )}
                        .
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-4 xl:sticky xl:top-[120px] xl:h-fit">
              <section
                ref={operationsSectionRef}
                className="scroll-mt-[120px] rounded-[28px] border border-blue-200 bg-white p-4 shadow-sm lg:p-5"
              >
                <SectionTitle
                  kicker="Cobros"
                  title="Pagos para revisar"
                  description="Desde acá confirmás cobros, revisás comprobantes y dejás lista cada reserva para el evento."
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        openHelpModal(
                          'Cómo usar este bloque',
                          `
                            <p>Acá confirmás pagos, revisás comprobantes y dejás cada reserva lista para el evento.</p>
                          `,
                        )
                      }
                      className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa] transition hover:bg-[#d8e6fa]"
                    >
                      <i className="fas fa-receipt"></i>
                    </button>
                  }
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[11px] font-bold text-amber-700">
                      Cobros para confirmar
                    </p>
                    <p className="mt-1 text-[24px] font-black text-amber-900">
                      {pendingReviewPurchases}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-bold text-emerald-700">
                      Ventas confirmadas
                    </p>
                    <p className="mt-1 text-[24px] font-black text-emerald-900">
                      {approvedPurchases}
                    </p>
                  </div>
                </div>

                {!unlock.unlocked && !isFinished ? (
                  <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">
                      Importante
                    </p>
                    <p className="mt-1 text-[15px] font-black text-slate-900">
                      Activá el panel antes del evento
                    </p>
                    <p className="mt-2 text-[13px] leading-6 text-slate-700">
                      Hacelo con tiempo para que todo siga funcionando sin sorpresas.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {urgentPurchases.length === 0 ? (
                    <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-600">
                        <i className="fas fa-check text-[20px]"></i>
                      </div>
                      <p className="text-[16px] font-black text-emerald-900">
                        No tenés pagos pendientes
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-emerald-700">
                        Todo lo que entró hasta ahora ya está revisado.
                      </p>
                    </div>
                  ) : (
                    urgentPurchases.slice(0, 4).map((purchase: any) => (
                      <PurchaseQuickCard
                        key={purchase.id}
                        purchase={purchase}
                        onOpenDetail={() => setSelectedPurchase(purchase)}
                        onOpenProof={() => openProofViewer(purchase?.latestProof)}
                        onSendWhatsApp={() => sendBuyerWhatsApp(purchase)}
                        onApprove={() => handleApprovePurchase(purchase)}
                        onReject={() => handleRejectPurchase(purchase)}
                      />
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsOperationsModalOpen(true)}
                  className="mt-4 w-full rounded-[18px] bg-slate-900 py-4 text-[15px] font-black text-white transition hover:bg-slate-800"
                >
                  <i className="fas fa-list-ul mr-2 text-slate-300"></i>
                  Ver listado completo
                </button>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
                <SectionTitle
                  kicker="Accesos rápidos"
                  title="Atajos útiles"
                  description="Movete rápido entre las partes más importantes del panel."
                />

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToSection('summary')}
                    className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] font-black text-slate-700 transition hover:bg-white"
                  >
                    Resumen
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('operations')}
                    className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] font-black text-slate-700 transition hover:bg-white"
                  >
                    Cobros
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('team')}
                    className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] font-black text-slate-700 transition hover:bg-white"
                  >
                    Equipo
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('closing')}
                    className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] font-black text-slate-700 transition hover:bg-white"
                  >
                    Activación / cierre
                  </button>
                </div>

                <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Estado rápido
                  </p>
                  <div className="mt-3 space-y-2 text-[13px] text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>Pagos para revisar</span>
                      <b>{pendingReviewPurchases}</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>RRPP activos</span>
                      <b>{promoters.length}</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Accesos de puerta</span>
                      <b>{doorStaffList.length}</b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Estado del panel</span>
                      <b>{unlock.unlocked ? 'Activo' : 'Pendiente'}</b>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isOperationsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-900/60 p-0 backdrop-blur-sm sm:justify-center sm:p-4"
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#f8f9fa] shadow-2xl sm:mx-auto sm:h-[88vh] sm:max-w-5xl sm:rounded-[28px]"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
                  <div>
                    <h3 className="text-[20px] font-black text-slate-900 sm:text-[22px]">
                      Listado de reservas y pagos
                    </h3>
                    <p className="mt-0.5 text-[12px] font-medium text-slate-500 sm:text-[13px]">
                      {purchasesSorted.length} registros · {pendingReviewPurchases}{' '}
                      para revisar · {purchasesWithProofCount} con comprobante
                    </p>
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={handleDownloadCSV}
                      title="Exportar CSV"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8fff2] text-[#00a650] transition hover:bg-[#d1fadd]"
                    >
                      <i className="fas fa-file-csv"></i>
                    </button>

                    <button
                      onClick={() => setIsOperationsModalOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>

                <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                  <div className="hide-scrollbar -mb-2 flex gap-2 overflow-x-auto pb-2">
                    <button
                      type="button"
                      onClick={() => setPurchaseFilter('action')}
                      className={cx(
                        'shrink-0 rounded-[14px] px-4 py-2.5 text-[13px] font-black transition',
                        purchaseFilter === 'action'
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      Pendientes ({pendingReviewPurchases})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurchaseFilter('all')}
                      className={cx(
                        'shrink-0 rounded-[14px] px-4 py-2.5 text-[13px] font-black transition',
                        purchaseFilter === 'all'
                          ? 'bg-[#3483fa] text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      Todos ({purchasesSorted.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurchaseFilter('approved')}
                      className={cx(
                        'shrink-0 rounded-[14px] px-4 py-2.5 text-[13px] font-black transition',
                        purchaseFilter === 'approved'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      Confirmados ({approvedPurchases})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurchaseFilter('checked_in')}
                      className={cx(
                        'shrink-0 rounded-[14px] px-4 py-2.5 text-[13px] font-black transition',
                        purchaseFilter === 'checked_in'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      Ingresaron ({checkedInCount})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurchaseFilter('rejected')}
                      className={cx(
                        'shrink-0 rounded-[14px] px-4 py-2.5 text-[13px] font-black transition',
                        purchaseFilter === 'rejected'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      Rechazados ({rejectedPurchases})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPurchaseFilter('other')}
                      className={cx(
                        'shrink-0 rounded-[14px] px-4 py-2.5 text-[13px] font-black transition',
                        purchaseFilter === 'other'
                          ? 'bg-slate-700 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                      )}
                    >
                      Otros
                    </button>
                  </div>

                  <div className="relative mt-3">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="text"
                      placeholder="Buscar por nombre, teléfono, mail, RRPP o estado..."
                      value={buyerSearchTerm}
                      onChange={(e) => setBuyerSearchTerm(e.target.value)}
                      className="w-full rounded-[16px] border-none bg-slate-100 py-3.5 pl-11 pr-10 text-[14px] text-slate-900 outline-none ring-2 ring-transparent transition focus:bg-white focus:ring-[#3483fa]/50"
                    />
                    {buyerSearchTerm ? (
                      <button
                        onClick={() => setBuyerSearchTerm('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                      >
                        <i className="fas fa-times-circle text-[16px]"></i>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
                  {filteredPurchases.length === 0 ? (
                    <div className="mt-12 text-center text-slate-500">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
                        <i className="fas fa-search text-2xl text-slate-400"></i>
                      </div>
                      <p className="text-[16px] font-black text-slate-800">
                        No encontramos resultados
                      </p>
                      <p className="mt-1 text-[14px]">
                        Probá con otra búsqueda o cambiá el filtro.
                      </p>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-4xl space-y-3 sm:space-y-4">
                      {filteredPurchases.map((purchase: any) => {
                        const statusMeta = getPurchaseStatusMeta(purchase.status);
                        const latestProof = purchase.latestProof;
                        const proofPreview = getProofPreviewData(latestProof);

                        return (
                          <div
                            key={purchase.id}
                            className={cx(
                              'rounded-[20px] border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5',
                              statusMeta.priority === 0
                                ? 'border-amber-300 ring-2 ring-amber-100'
                                : 'border-slate-200',
                            )}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={cx(
                                      'rounded-full px-2.5 py-1 text-[11px] font-black',
                                      statusMeta.className,
                                    )}
                                  >
                                    {statusMeta.label}
                                  </span>

                                  <span
                                    className={cx(
                                      'rounded-full border px-2.5 py-1 text-[11px] font-black',
                                      latestProof
                                        ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
                                        : 'border-slate-200 bg-slate-100 text-slate-600',
                                    )}
                                  >
                                    {latestProof ? 'Tiene comprobante' : 'Sin comprobante'}
                                  </span>

                                  {purchase.createdBySeller ? (
                                    <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                                      <i className="fas fa-user-tag"></i>
                                      Venta por RRPP
                                    </span>
                                  ) : null}
                                </div>

                                <p className="text-[18px] font-black leading-tight text-slate-900 sm:text-[20px]">
                                  {purchase.buyerName || (
                                    <span className="italic text-slate-400">
                                      Sin nombre
                                    </span>
                                  )}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-slate-600">
                                  <p className="font-medium">
                                    <i className="fas fa-phone-alt w-4 text-center text-slate-400"></i>
                                    {purchase.buyerPhone || 'Sin teléfono'}
                                  </p>
                                  {purchase.buyerEmail ? (
                                    <p className="font-medium">
                                      <i className="fas fa-envelope w-4 text-center text-slate-400"></i>
                                      {purchase.buyerEmail}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4 sm:gap-3 sm:text-[13px]">
                                  <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                      Lugares / números
                                    </p>
                                    <p className="mt-0.5 text-[15px] font-black text-slate-900">
                                      {getNumbersLabel(purchase.numbers)}
                                    </p>
                                  </div>



                                  <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                      Forma de pago
                                    </p>
                                    <p className="mt-0.5 font-bold text-slate-900">
                                      {getPaymentMethodLabel(purchase.paymentMethod)}
                                    </p>
                                  </div>

                                  <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                                      Fecha
                                    </p>
                                    <p className="mt-0.5 font-bold text-slate-900">
                                      {formatDateTime(
                                        purchase.submittedAt || purchase.reservedAt,
                                      ).split(',')[0]}
                                    </p>
                                  </div>
                                </div>

                                {purchase.createdBySeller ? (
                                  <p className="mt-3 inline-block rounded-[10px] bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-600">
                                    <i className="fas fa-handshake mr-1.5"></i>
                                    RRPP:{' '}
                                    {`${purchase.createdBySeller.firstName || ''} ${
                                      purchase.createdBySeller.lastName || ''
                                    }`.trim()}
                                  </p>
                                ) : null}
                              </div>

                              <div className="mt-2 flex w-full gap-2 border-t border-slate-100 pt-3 sm:mt-0 sm:w-auto sm:flex-col sm:border-none sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPurchase(purchase)}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-slate-900 px-4 py-3 text-white transition hover:bg-slate-800 sm:h-11 sm:w-11 sm:flex-none sm:p-0"
                                  title="Ver detalle"
                                >
                                  <i className="fas fa-eye"></i>
                                  <span className="text-[13px] font-black sm:hidden">
                                    Ver detalle
                                  </span>
                                </button>

                                {purchase.buyerPhone ? (
                                  <button
                                    type="button"
                                    onClick={() => sendBuyerWhatsApp(purchase)}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#25D366] px-4 py-3 text-white transition hover:bg-[#20ba56] sm:h-11 sm:w-11 sm:flex-none sm:p-0"
                                    title="Escribir por WhatsApp"
                                  >
                                    <i className="fab fa-whatsapp text-[16px]"></i>
                                    <span className="text-[13px] font-black sm:hidden">
                                      WhatsApp
                                    </span>
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {(latestProof ||
                              canApprovePurchase(purchase.status) ||
                              canRejectPurchase(purchase.status)) ? (
                              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                                {latestProof ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        proofPreview.previewUrl ||
                                        proofPreview.openUrl
                                      ) {
                                        openProofViewer(latestProof);
                                      } else {
                                        setSelectedPurchase(purchase);
                                      }
                                    }}
                                    className="group flex flex-1 items-center gap-3 rounded-[14px] border border-indigo-100 bg-indigo-50/50 p-2 text-left transition hover:bg-indigo-50"
                                  >
                                    {proofPreview.isImage &&
                                    proofPreview.previewUrl ? (
                                      <>
                                        <img
                                          src={proofPreview.previewUrl}
                                          alt="Comprobante"
                                          className="h-10 w-10 rounded-[8px] border border-indigo-100 object-cover"
                                        />
                                        <div>
                                          <p className="text-[12px] font-black text-indigo-900 transition group-hover:text-[#3483fa]">
                                            Ver comprobante
                                          </p>
                                          <p className="text-[10px] font-medium text-indigo-500">
                                            Revisalo antes de confirmar
                                          </p>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-indigo-100 bg-white text-indigo-500">
                                          <i className="fas fa-file-invoice"></i>
                                        </div>
                                        <div>
                                          <p className="text-[12px] font-black text-indigo-900 transition group-hover:text-[#3483fa]">
                                            Abrir comprobante
                                          </p>
                                          <p className="max-w-[120px] truncate text-[10px] font-medium text-indigo-500">
                                            {latestProof.fileName || 'Archivo'}
                                          </p>
                                        </div>
                                      </>
                                    )}
                                  </button>
                                ) : null}

                                <div className="flex gap-2 sm:ml-auto">
                                  {canRejectPurchase(purchase.status) ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRejectPurchase(purchase)}
                                      className="flex-1 rounded-[14px] border-2 border-rose-100 bg-white px-4 py-2.5 text-[13px] font-black text-rose-600 shadow-sm transition hover:bg-rose-50 sm:flex-none"
                                    >
                                      Rechazar
                                    </button>
                                  ) : null}

                                  {canApprovePurchase(purchase.status) ? (
                                    <button
                                      type="button"
                                      onClick={() => handleApprovePurchase(purchase)}
                                      className="flex-1 rounded-[14px] bg-emerald-600 px-5 py-2.5 text-[13px] font-black text-white transition hover:bg-emerald-700 sm:flex-none"
                                    >
                                      <i className="fas fa-check mr-2"></i>
                                      Confirmar
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedPurchase && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            >
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-slate-50 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[28px]"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#3483fa]">
                      Detalle de la reserva
                    </p>
                    <h3 className="mt-0.5 text-[20px] font-black leading-tight text-slate-900 sm:text-[24px]">
                      {selectedPurchase.buyerName || 'Reserva sin nombre'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPurchase(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 sm:h-12 sm:w-12"
                  >
                    <i className="fas fa-times sm:text-[18px]"></i>
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cx(
                        'rounded-full px-3 py-1 text-[12px] font-black',
                        getPurchaseStatusMeta(selectedPurchase.status).className,
                      )}
                    >
                      {getPurchaseStatusMeta(selectedPurchase.status).label}
                    </span>

                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-black text-slate-700 shadow-sm">
                      Pago: {getPaymentMethodLabel(selectedPurchase.paymentMethod)}
                    </span>

                    <span
                      className={cx(
                        'rounded-full border px-3 py-1 text-[12px] font-black shadow-sm',
                        selectedPurchase.latestProof
                          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-500',
                      )}
                    >
                      {selectedPurchase.latestProof
                        ? 'Con comprobante'
                        : 'Sin comprobante'}
                    </span>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <p className="mb-3 border-b border-slate-100 pb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Resumen de compra
                    </p>

                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      <div>
                        <p className="text-[12px] font-bold text-slate-500">
                          Lugares / números
                        </p>
                        <p className="mt-1 inline-block rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-1 text-[18px] font-black text-slate-900">
                          {getNumbersLabel(selectedPurchase.numbers)}
                        </p>
                      </div>



                      <div>
                        <p className="text-[12px] font-bold text-slate-500">
                          Fecha de reserva
                        </p>
                        <p className="mt-1 text-[14px] font-black text-slate-800">
                          {formatDateTime(selectedPurchase.reservedAt)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[12px] font-bold text-slate-500">
                          Último movimiento
                        </p>
                        <p className="mt-1 text-[14px] font-black text-slate-800">
                          {formatDateTime(
                            selectedPurchase.checkedInAt ||
                              selectedPurchase.submittedAt ||
                              selectedPurchase.reviewedAt ||
                              selectedPurchase.updatedAt,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <p className="mb-3 border-b border-slate-100 pb-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Datos de contacto
                    </p>

                    <div className="space-y-3 text-[14px] text-slate-800">
                      <p className="flex items-center gap-3">
                        <i className="fas fa-user w-5 text-center text-slate-400"></i>
                        <span className="font-bold">
                          {selectedPurchase.buyerName || 'N/A'}
                        </span>
                      </p>

                      <p className="flex items-center gap-3">
                        <i className="fas fa-phone-alt w-5 text-center text-slate-400"></i>
                        <span className="font-medium">
                          {selectedPurchase.buyerPhone || 'Sin teléfono'}
                        </span>

                        {selectedPurchase.buyerPhone ? (
                          <button
                            type="button"
                            onClick={() => sendBuyerWhatsApp(selectedPurchase)}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1.5 text-[11px] font-black text-[#25D366] transition hover:bg-[#25D366] hover:text-white"
                          >
                            <i className="fab fa-whatsapp"></i>
                            Escribir
                          </button>
                        ) : null}
                      </p>

                      {selectedPurchase.buyerEmail ? (
                        <p className="flex items-center gap-3">
                          <i className="fas fa-envelope w-5 text-center text-slate-400"></i>
                          <span className="font-medium">
                            {selectedPurchase.buyerEmail}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {selectedPurchase.latestProof ? (
                    <div className="relative overflow-hidden rounded-[20px] border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
                      <div className="absolute left-0 top-0 h-full w-1 bg-indigo-400"></div>

                      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-500">
                        Comprobante
                      </p>

                      {selectedPurchaseProof.previewUrl ? (
                        <button
                          type="button"
                          onClick={() => openProofViewer(selectedPurchase.latestProof)}
                          className="group w-full text-left"
                        >
                          {selectedPurchaseProof.isImage ? (
                            <div className="flex gap-4 rounded-[16px] border border-indigo-100 bg-indigo-50/50 p-3 transition hover:bg-indigo-50">
                              <img
                                src={selectedPurchaseProof.previewUrl}
                                alt="Comprobante"
                                className="h-24 w-24 rounded-[12px] border border-white object-cover shadow-sm"
                              />
                              <div className="flex flex-col justify-center">
                                <p className="text-[15px] font-black text-indigo-900 transition group-hover:text-[#3483fa]">
                                  Abrir comprobante
                                </p>
                                <p className="mt-1 text-[13px] text-indigo-600">
                                  Revisalo antes de confirmar el pago
                                </p>
                              </div>
                            </div>
                          ) : selectedPurchaseProof.isPdf ? (
                            <div className="flex items-center gap-4 rounded-[16px] border border-indigo-100 bg-indigo-50/50 p-4 transition hover:bg-indigo-50">
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm">
                                <i className="fas fa-file-pdf text-[24px]"></i>
                              </div>
                              <div>
                                <p className="text-[15px] font-black text-indigo-900 transition group-hover:text-[#3483fa]">
                                  Abrir PDF
                                </p>
                                <p className="mt-1 text-[13px] text-indigo-600">
                                  {selectedPurchase.latestProof.fileName ||
                                    'Archivo PDF'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-center">
                              <p className="text-[14px] font-bold text-slate-700">
                                Abrir archivo
                              </p>
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                          <p className="text-[14px] font-bold text-slate-700">
                            No se puede mostrar desde acá
                          </p>
                          <p className="mt-1 text-[13px] text-slate-500">
                            Pedilo por WhatsApp o revisá el movimiento por tu cuenta.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {selectedPurchase.createdBySeller ? (
                    <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        Venta por RRPP
                      </p>
                      <p className="mt-1 text-[14px] font-medium text-emerald-900">
                        Esta reserva fue generada por{' '}
                        <b className="font-black">
                          {`${selectedPurchase.createdBySeller.firstName || ''} ${
                            selectedPurchase.createdBySeller.lastName || ''
                          }`.trim()}
                        </b>
                      </p>
                    </div>
                  ) : null}

                  {selectedPurchase.rejectionReason ? (
                    <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-700">
                        Motivo de rechazo
                      </p>
                      <p className="mt-1 text-[14px] font-bold text-rose-900">
                        {selectedPurchase.rejectionReason}
                      </p>
                    </div>
                  ) : null}

                  {selectedPurchase.reviewNotes ? (
                    <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">
                        Nota interna
                      </p>
                      <p className="mt-1 text-[14px] font-bold text-amber-900">
                        {selectedPurchase.reviewNotes}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {canApprovePurchase(selectedPurchase.status) ||
                    canRejectPurchase(selectedPurchase.status) ? (
                      <>
                        {canRejectPurchase(selectedPurchase.status) ? (
                          <button
                            type="button"
                            onClick={() => handleRejectPurchase(selectedPurchase)}
                            className="flex-1 rounded-[16px] border-2 border-rose-100 bg-white py-3.5 text-[14px] font-black text-rose-600 shadow-sm transition hover:bg-rose-50"
                          >
                            <i className="fas fa-xmark mr-2"></i>
                            Rechazar
                          </button>
                        ) : null}

                        {canApprovePurchase(selectedPurchase.status) ? (
                          <button
                            type="button"
                            onClick={() => handleApprovePurchase(selectedPurchase)}
                            className="flex-1 rounded-[16px] bg-emerald-600 py-3.5 text-[14px] font-black text-white transition hover:bg-emerald-700"
                          >
                            <i className="fas fa-check mr-2"></i>
                            Confirmar pago
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedPurchase(null)}
                        className="w-full rounded-[16px] bg-slate-900 py-3.5 text-[14px] font-black text-white transition hover:bg-slate-800"
                      >
                        Cerrar
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {proofViewer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/90 p-0 backdrop-blur-md sm:items-center sm:p-4"
            >
              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 24, opacity: 0, scale: 0.98 }}
                className="flex h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] bg-black shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[28px]"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">
                      Comprobante
                    </p>
                    <h3 className="truncate text-[18px] font-black text-white sm:text-[20px]">
                      {proofViewer.fileName || 'Archivo'}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setProofViewer(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:h-12 sm:w-12"
                  >
                    <i className="fas fa-times sm:text-[18px]"></i>
                  </button>
                </div>

                <div className="relative flex flex-1 items-center justify-center overflow-auto p-4 sm:p-6">
                  {proofViewer.isImage ? (
                    <img
                      src={proofViewer.url}
                      alt={proofViewer.fileName || 'Comprobante'}
                      className="max-h-[75vh] w-auto max-w-full rounded-[16px] object-contain shadow-2xl"
                    />
                  ) : proofViewer.isPdf ? (
                    <iframe
                      src={proofViewer.url}
                      title={proofViewer.fileName || 'PDF'}
                      className="h-[75vh] w-full rounded-[16px] bg-white"
                    />
                  ) : (
                    <div className="max-w-sm rounded-[20px] border border-dashed border-white/20 p-8 text-center">
                      <i className="fas fa-eye-slash mb-4 text-4xl text-white/30"></i>
                      <p className="text-[16px] font-black text-white">
                        No podemos mostrar este archivo
                      </p>
                      <p className="mt-2 text-[14px] text-white/60">
                        Revisalo por fuera o pedilo nuevamente.
                      </p>
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/10 p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => setProofViewer(null)}
                    className="w-full rounded-[16px] bg-white py-3.5 text-[15px] font-black text-black transition hover:bg-slate-200"
                  >
                    Cerrar visor
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
              label: 'Difundir',
              icon: 'fab fa-whatsapp',
              onClick: sharePublicLink,
            },
            {
              label: 'Cobros',
              icon: 'fa-list-check',
              onClick: () => scrollToSection('operations'),
            },
            {
              label: 'Ayuda',
              icon: 'fa-headset',
              onClick: () =>
                openHelpModal(
                  'Tip rápido',
                  `
                    <p>Si querés vender más, compartí el link seguido y revisá los pagos pendientes lo antes posible.</p>
                  `,
                ),
            },
          ]}
        />
      </div>

      <AppFooter />
    </>
  );
}