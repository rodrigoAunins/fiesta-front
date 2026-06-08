import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Swal from 'sweetalert2';
import api from '../api/axios';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import AppFooter from '../components/AppFooter';
import GuidedTour from '../components/GuidedTour';
import {
  buildShareRaffleLink,
  openHelpModal,
  openWhatsAppShare,
  promptAppShare,
  promptShare,
  runAfterTourAndIdle,
} from '../utils/ux';
import type { Step } from 'react-joyride';
import {
  getPublicRaffleShareText,
  getSellerShareTitle,
} from '../utils/shareMessages';
import { getRaffleTheme } from '../utils/raffleTheme';

const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin);

GlobalWorkerOptions.workerSrc = pdfWorker;

type PaymentMethod = 'transfer' | 'cash';
type EventType = 'general' | 'tables';

type AttendeeForm = {
  fullName: string;
  phone: string;
  email: string;
};

type SeatLike = {
  id: string | number;
  label?: string;
  name?: string;
  number?: string | number;
  status?: string;
  occupied?: boolean;
  reserved?: boolean;
  available?: boolean;
  buyerName?: string;
};

type TableLike = {
  id: string | number;
  name?: string;
  label?: string;
  title?: string;
  code?: string;
  capacity?: number;
  totalSeats?: number;
  availableSeats?: number;
  occupiedSeats?: number;
  price?: number;
  status?: string;
  seats?: SeatLike[];
};

const MAX_PROOF_BYTES = 100 * 1024;
const MAX_IMAGE_DIMENSION = 1400;
const INITIAL_IMAGE_QUALITY = 0.82;
const MIN_IMAGE_QUALITY = 0.18;
const MAX_FILE_INPUT_BYTES = 25 * 1024 * 1024;

function createEmptyAttendee(): AttendeeForm {
  return {
    fullName: '',
    phone: '',
    email: '',
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Fecha no disponible';
  return new Date(value).toLocaleString('es-AR');
}

function toMoney(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getYoutubeId(url: string) {
  if (!url) return null;
  if (url.includes('v=')) return url.split('v=')[1].split('&')[0];
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
  if (url.includes('/embed/')) return url.split('/embed/')[1].split('?')[0];
  return null;
}

function paymentMethodLabel(method: PaymentMethod) {
  return method === 'transfer' ? 'Transferencia' : 'Efectivo';
}

function getEnabledPaymentMethods(eventData: any): PaymentMethod[] {
  const methods: PaymentMethod[] = [];

  const transferEnabled = !!eventData?.allowTransfer && !!eventData?.transferAlias;
  const cashEnabled = !!eventData?.allowCash;

  if (transferEnabled) methods.push('transfer');
  if (cashEnabled) methods.push('cash');

  return methods;
}

function getPaymentMethodsText(eventData: any) {
  const methods = getEnabledPaymentMethods(eventData);

  if (!methods.length) return 'Método a confirmar';
  if (methods.length === 1) return paymentMethodLabel(methods[0]);
  return methods.map(paymentMethodLabel).join(' o ');
}

function getDefaultPaymentMethod(eventData: any): PaymentMethod {
  const methods = getEnabledPaymentMethods(eventData);
  return methods[0] || 'transfer';
}

function escapeHtml(value?: string | null) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

function normalizePhoneForWhatsApp(phone?: string | null) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!digits.startsWith('54')) {
    digits = `54${digits}`;
  }

  return digits;
}

function getEventType(eventData: any): EventType {
  return eventData?.eventType === 'tables' ? 'tables' : 'general';
}

function getEntryUnitLabel(eventData: any) {
  return getEventType(eventData) === 'tables' ? 'mesa' : 'entrada';
}

function getEntryUnitLabelPlural(eventData: any) {
  return getEventType(eventData) === 'tables' ? 'mesas' : 'entradas';
}

function isApprovedPurchase(status?: string | null) {
  return status === 'approved' || status === 'auto_approved';
}

function isRejectedPurchase(status?: string | null) {
  return status === 'rejected';
}

function isPendingPurchase(status?: string | null) {
  return !isApprovedPurchase(status) && !isRejectedPurchase(status);
}

function getQrCustomerGuide(status?: string | null) {
  if (isApprovedPurchase(status)) {
    return {
      title: 'Tu QR ya está listo para ingresar',
      badge: 'Listo para usar',
      text:
        'Guardalo y presentalo en puerta. Allí lo escanean y tu ingreso queda confirmado en el momento.',
    };
  }

  if (isRejectedPurchase(status)) {
    return {
      title: 'Este QR no habilita ingreso',
      badge: 'No válido para ingresar',
      text:
        'Queda como referencia de tu solicitud. Si necesitás resolverlo, hablá con el organizador antes de asistir.',
    };
  }

  return {
    title: 'Tu QR ya fue generado',
    badge: 'Pendiente de validación',
    text:
      'Guardalo desde ahora. En puerta lo escanean y validan tu estado en el momento. Si tu pago ya fue confirmado, ingresás. Si todavía está pendiente, el personal te lo va a indicar.',
  };
}

function getPurchaseStatusMeta(status?: string | null) {
  switch (status) {
    case 'auto_approved':
      return {
        title: '¡Acceso confirmado!',
        label: 'Confirmado automático',
        color: '#166534',
        bg: '#dcfce7',
        border: '#86efac',
        description:
          'Tu pago fue validado automáticamente. Tu acceso ya está confirmado y este QR ya se puede usar en puerta.',
      };

    case 'approved':
      return {
        title: '¡Acceso confirmado!',
        label: 'Aprobado',
        color: '#166534',
        bg: '#dcfce7',
        border: '#86efac',
        description:
          'El organizador aprobó tu operación. Tu acceso ya está confirmado y este QR ya se puede usar en puerta.',
      };

    case 'under_review':
      return {
        title: 'Comprobante enviado',
        label: 'En revisión',
        color: '#92400e',
        bg: '#fef3c7',
        border: '#fcd34d',
        description:
          'Tu comprobante fue recibido. Tu QR ya está generado, pero el ingreso se habilita cuando el organizador confirme el pago.',
      };

    case 'pending_cash_confirmation':
      return {
        title: 'Reserva pendiente de confirmación',
        label: 'Pendiente de validación',
        color: '#9a3412',
        bg: '#ffedd5',
        border: '#fdba74',
        description:
          'Tu reserva quedó registrada. Tu QR ya existe, pero el ingreso se habilita cuando el pago en efectivo sea confirmado.',
      };

    case 'reserved':
    case 'pending_proof':
      return {
        title: 'Reserva creada',
        label: 'Pendiente',
        color: '#334155',
        bg: '#f1f5f9',
        border: '#cbd5e1',
        description:
          'Tu solicitud quedó guardada. Tu QR ya fue generado, pero todavía falta completar o validar el pago.',
      };

    case 'rejected':
      return {
        title: 'Solicitud rechazada',
        label: 'Rechazado',
        color: '#991b1b',
        bg: '#fee2e2',
        border: '#fca5a5',
        description:
          'Esta solicitud fue rechazada. El QR queda como referencia, pero no habilita ingreso.',
      };

    default:
      return {
        title: 'Operación registrada',
        label: status || 'Registrado',
        color: '#1e3a8a',
        bg: '#dbeafe',
        border: '#93c5fd',
        description:
          'Tu operación fue registrada correctamente. Guardá tu código y revisá el estado antes del evento.',
      };
  }
}

function getPurchaseStatusMessage(status?: string | null) {
  const meta = getPurchaseStatusMeta(status);

  return {
    title: meta.title,
    html: `
      <p>${meta.description}</p>
    `,
    icon:
      status === 'approved' || status === 'auto_approved'
        ? ('success' as const)
        : status === 'rejected'
          ? ('error' as const)
          : ('success' as const),
  };
}

function buildUploadOptimizationHtml(meta?: {
  sourceKind: 'image' | 'pdf';
  originalSize: number;
  finalSize: number;
}) {
  if (!meta) return '';

  const label =
    meta.sourceKind === 'pdf'
      ? 'Tu PDF fue convertido a una imagen liviana para garantizar que llegue al instante.'
      : 'Optimizamos el peso de tu imagen automáticamente para una carga súper rápida.';

  return `
    <div style="margin-top:12px; padding:12px 14px; border-radius:14px; background:#f8fafc; border:1px solid #dbe2ea; text-align:left;">
      <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">
        🚀 Archivo optimizado
      </div>
      <div style="margin-top:6px; font-size:13px; line-height:1.7; color:#334155;">
        ${label}
      </div>
    </div>
  `;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo leer el archivo de forma correcta.'));
        return;
      }
      resolve(reader.result);
    };

    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No pudimos procesar la imagen seleccionada.'));
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Fallo al comprimir la imagen.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function compressCanvasUnderLimit(
  sourceCanvas: HTMLCanvasElement,
  maxBytes = MAX_PROOF_BYTES,
  outputType: 'image/jpeg' = 'image/jpeg',
): Promise<Blob> {
  const workCanvas = document.createElement('canvas');
  const workCtx = workCanvas.getContext('2d');

  if (!workCtx) {
    throw new Error('Tu navegador no soporta la optimización de imágenes.');
  }

  let quality = INITIAL_IMAGE_QUALITY;
  let scale = 1;

  for (let attempt = 0; attempt < 20; attempt++) {
    const width = Math.max(320, Math.round(sourceCanvas.width * scale));
    const height = Math.max(320, Math.round(sourceCanvas.height * scale));

    workCanvas.width = width;
    workCanvas.height = height;

    workCtx.clearRect(0, 0, width, height);
    workCtx.fillStyle = '#ffffff';
    workCtx.fillRect(0, 0, width, height);
    workCtx.drawImage(sourceCanvas, 0, 0, width, height);

    const blob = await canvasToBlob(workCanvas, outputType, quality);

    if (blob.size <= maxBytes) {
      return blob;
    }

    if (quality > MIN_IMAGE_QUALITY) {
      quality = Math.max(MIN_IMAGE_QUALITY, quality - 0.08);
    } else {
      scale *= 0.82;
    }
  }

  throw new Error(
    'El comprobante es demasiado pesado. Por favor intentá con una captura de pantalla más simple.',
  );
}

async function compressImageUnderLimit(file: File) {
  const image = await loadImageFromFile(file);

  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;

  if (width <= 0 || height <= 0) {
    throw new Error('La imagen no tiene un formato o tamaño válido.');
  }

  const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo preparar la imagen.');
  }

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await compressCanvasUnderLimit(canvas, MAX_PROOF_BYTES, 'image/jpeg');
  const safeName = (file.name || 'comprobante').replace(/\.[^.]+$/, '').trim();

  return {
    file: new File([blob], `${safeName || 'comprobante'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    }),
    sourceKind: 'image' as const,
    originalSize: file.size,
    finalSize: blob.size,
  };
}

async function convertPdfFirstPageToImageUnderLimit(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  try {
    const page = await pdf.getPage(1);
    const firstViewport = page.getViewport({ scale: 1 });

    const targetScale =
      firstViewport.width > MAX_IMAGE_DIMENSION
        ? MAX_IMAGE_DIMENSION / firstViewport.width
        : 1.4;

    const viewport = page.getViewport({ scale: targetScale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('No se pudo convertir el archivo PDF.');
    }

    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    } as any).promise;

    const blob = await compressCanvasUnderLimit(canvas, MAX_PROOF_BYTES, 'image/jpeg');
    const safeName = (file.name || 'comprobante').replace(/\.[^.]+$/, '').trim();

    return {
      file: new File([blob], `${safeName || 'comprobante'}_pdf.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      }),
      sourceKind: 'pdf' as const,
      originalSize: file.size,
      finalSize: blob.size,
    };
  } finally {
    await pdf.destroy();
  }
}

async function prepareProofFile(file: File) {
  if (file.size > MAX_FILE_INPUT_BYTES) {
    throw new Error(
      'El archivo es demasiado grande (máx 25MB). Por favor, subí una captura de pantalla más liviana.',
    );
  }

  if (isPdfFile(file)) {
    return convertPdfFirstPageToImageUnderLimit(file);
  }

  if (isImageFile(file)) {
    return compressImageUnderLimit(file);
  }

  throw new Error('Solo aceptamos imágenes (JPG/PNG) o documentos PDF.');
}

function resolveAccessCode(purchase: any) {
  const code =
    purchase?.accessCode ||
    purchase?.entryCode ||
    purchase?.reservationCode ||
    purchase?.confirmationCode ||
    purchase?.publicCode ||
    purchase?.code;

  if (code) return String(code).toUpperCase();

  const rawId = String(purchase?.id || '');
  if (rawId) return `EV-${rawId.slice(-6).toUpperCase()}`;

  return `EV-${String(Date.now()).slice(-6)}`;
}

function getPurchaseStorageKey(eventId?: string | null) {
  return `paselibre:lastPurchase:${eventId || 'unknown'}`;
}

function resolveSellerInfo(eventData: any, sellerId?: string | null) {
  if (!sellerId || !Array.isArray(eventData?.sellers)) return null;

  return (
    eventData.sellers.find((item: any) => {
      const currentId = String(item?.seller?.id || item?.id || '');
      return currentId === String(sellerId);
    }) || null
  );
}

function resolveTables(eventData: any): TableLike[] {
  if (Array.isArray(eventData?.tablesLayout) && eventData.tablesLayout.length) {
    return eventData.tablesLayout;
  }

  if (Array.isArray(eventData?.tables) && eventData.tables.length) {
    return eventData.tables;
  }

  return [];
}

function getTableName(table: TableLike) {
  return (
    table?.label ||
    table?.name ||
    table?.title ||
    table?.code ||
    `Mesa ${table?.id ?? ''}`
  );
}

function getTableCapacity(table: TableLike, eventData: any) {
  return (
    toInt(table?.capacity, 0) ||
    toInt(table?.totalSeats, 0) ||
    (Array.isArray(table?.seats) ? table.seats.length : 0) ||
    toInt(eventData?.chairsPerTable, 0) ||
    1
  );
}

function isSeatSelectable(seat: SeatLike) {
  if (seat?.available === true) return true;
  if (seat?.occupied === true) return false;
  if (seat?.reserved === true) return false;
  if (String(seat?.status || '').toLowerCase() === 'available') return true;
  if (String(seat?.status || '').toLowerCase() === 'sold') return false;
  if (String(seat?.status || '').toLowerCase() === 'occupied') return false;
  if (String(seat?.status || '').toLowerCase() === 'reserved') return false;
  return !seat?.occupied;
}

function getAvailableSeatCount(table: TableLike, eventData: any) {
  if (Number.isFinite(Number(table?.availableSeats))) {
    return Math.max(0, Number(table.availableSeats));
  }

  if (Array.isArray(table?.seats) && table.seats.length) {
    return table.seats.filter(isSeatSelectable).length;
  }

  const capacity = getTableCapacity(table, eventData);
  const occupied = toInt(table?.occupiedSeats, 0);
  return Math.max(capacity - occupied, 0);
}

function getGeneralAvailability(eventData: any, fallbackTickets: any[]) {
  const explicit =
    eventData?.availableCount ??
    eventData?.remainingCapacity ??
    eventData?.remainingTickets ??
    eventData?.remainingSpots;

  if (Number.isFinite(Number(explicit))) {
    return Math.max(0, Number(explicit));
  }

  if (Array.isArray(fallbackTickets) && fallbackTickets.length) {
    return fallbackTickets.filter((t) => String(t?.status) === 'available').length;
  }

  const maxCapacity =
    eventData?.maxCapacity ??
    eventData?.totalNumbers ??
    eventData?.totalTickets ??
    0;

  const sold =
    eventData?.soldCount ??
    eventData?.confirmedCount ??
    eventData?.approvedCount ??
    0;

  const pending =
    eventData?.pendingCount ??
    eventData?.underReviewCount ??
    0;

  return Math.max(0, Number(maxCapacity || 0) - Number(sold || 0) - Number(pending || 0));
}

function getGeneralPending(eventData: any, fallbackTickets: any[]) {
  const explicit =
    eventData?.pendingCount ??
    eventData?.underReviewCount ??
    eventData?.pendingReservations;

  if (Number.isFinite(Number(explicit))) return Math.max(0, Number(explicit));

  if (Array.isArray(fallbackTickets) && fallbackTickets.length) {
    return fallbackTickets.filter((t) => String(t?.status) === 'pending').length;
  }

  return 0;
}

function getGeneralConfirmed(eventData: any, fallbackTickets: any[]) {
  const explicit =
    eventData?.soldCount ??
    eventData?.confirmedCount ??
    eventData?.approvedCount;

  if (Number.isFinite(Number(explicit))) return Math.max(0, Number(explicit));

  if (Array.isArray(fallbackTickets) && fallbackTickets.length) {
    return fallbackTickets.filter((t) => String(t?.status) === 'sold').length;
  }

  return 0;
}

function buildBuyerAccessWhatsAppText(eventData: any, purchase: any) {
  const code = resolveAccessCode(purchase);
  const statusMeta = getPurchaseStatusMeta(purchase?.status);
  const qrGuide = getQrCustomerGuide(purchase?.status);

  return [
    `🎟️ ${eventData?.title || 'Mi evento'}`,
    '',
    `Código: ${code}`,
    `Estado: ${statusMeta.label}`,
    `Fecha: ${formatDateTime(eventData?.drawDate)}`,
    '',
    qrGuide.title,
    qrGuide.text,
  ].join('\n');
}

function openPrintWindow(html: string) {
  const printWindow = window.open('', '_blank', 'width=920,height=1200');

  if (!printWindow) {
    Swal.fire(
      'Ventana bloqueada',
      'Tu navegador bloqueó la apertura del PDF. Permití popups para continuar.',
      'warning',
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function buildPrintablePurchaseHtml(params: {
  eventData: any;
  purchase: any;
  theme: any;
  type: 'reservation' | 'event';
}) {
  const { eventData, purchase, theme, type } = params;
  const code = resolveAccessCode(purchase);
  const statusMeta = getPurchaseStatusMeta(purchase?.status);
  const qrSrc = purchase?.qrBase64 || purchase?.qrUrl || '';
  const qrGuide = getQrCustomerGuide(purchase?.status);
  const attendees = Array.isArray(purchase?.attendees) ? purchase.attendees : [];
  const tableName = purchase?.tableName || purchase?.selectedTableName || '';
  const seatsText = Array.isArray(purchase?.seatLabels) ? purchase.seatLabels.join(', ') : '';
  const title =
    type === 'reservation'
      ? purchase?.status === 'approved' || purchase?.status === 'auto_approved'
        ? 'Entrada / comprobante de acceso'
        : 'Solicitud / reserva del evento'
      : 'Ficha del evento';

  const subtitle =
    type === 'reservation'
      ? purchase?.status === 'approved' || purchase?.status === 'auto_approved'
        ? 'Documento válido sujeto a control del organizador'
        : 'Documento informativo. Todavía no reemplaza la validación final del organizador.'
      : 'Información para guardar y presentar el día del evento';

  const attendeesHtml =
    attendees.length > 0
      ? attendees
          .map(
            (att: any, idx: number) => `
              <div class="row-item">
                <div class="row-index">${idx + 1}</div>
                <div class="row-main">
                  <div class="row-title">${escapeHtml(att?.fullName || 'Invitado')}</div>
                  <div class="row-sub">${escapeHtml(att?.phone || '')} ${att?.email ? `· ${escapeHtml(att.email)}` : ''}</div>
                </div>
              </div>
            `,
          )
          .join('')
      : `<div class="muted">No se registraron acompañantes en este documento.</div>`;

  return `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Inter, Arial, sans-serif;
            background: #f8fafc;
            color: #0f172a;
            padding: 32px;
          }
          .sheet {
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 28px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          .hero {
            padding: 28px;
            background: linear-gradient(135deg, ${theme?.primaryColor || '#fff159'} 0%, ${theme?.secondaryColor || '#3483fa'} 100%);
            color: ${theme?.textColor || '#0f172a'};
          }
          .badge {
            display: inline-block;
            padding: 7px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: .08em;
            text-transform: uppercase;
            background: rgba(255,255,255,.85);
            color: #0f172a;
          }
          .title {
            margin: 14px 0 0;
            font-size: 28px;
            font-weight: 900;
            line-height: 1.1;
          }
          .subtitle {
            margin: 10px 0 0;
            font-size: 14px;
            line-height: 1.7;
            opacity: .95;
          }
          .content {
            padding: 24px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 16px;
            background: #ffffff;
          }
          .eyebrow {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .08em;
            color: #64748b;
          }
          .strong {
            margin-top: 6px;
            font-size: 19px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.2;
          }
          .muted {
            font-size: 13px;
            color: #475569;
            line-height: 1.7;
          }
          .status {
            margin-top: 16px;
            border-radius: 18px;
            padding: 16px;
            border: 1px solid ${statusMeta.border};
            background: ${statusMeta.bg};
            color: ${statusMeta.color};
          }
          .code-box {
            margin-top: 18px;
            border: 2px dashed #cbd5e1;
            background: #f8fafc;
            padding: 18px;
            border-radius: 20px;
            text-align: center;
          }
          .code-label {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .08em;
            color: #64748b;
          }
          .code-value {
            margin-top: 8px;
            font-size: 30px;
            font-weight: 900;
            letter-spacing: .08em;
            color: #0f172a;
          }
          .rows {
            margin-top: 18px;
            display: grid;
            gap: 10px;
          }
          .row-item {
            display: flex;
            gap: 12px;
            align-items: center;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 12px;
            background: #f8fafc;
          }
          .row-index {
            width: 34px;
            height: 34px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 900;
            background: #eaf2ff;
            color: #2563eb;
            flex-shrink: 0;
          }
          .row-title {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          .row-sub {
            margin-top: 3px;
            font-size: 12px;
            color: #64748b;
          }
          .footer-cta {
            margin-top: 24px;
            border-radius: 22px;
            padding: 20px;
            background: #0f172a;
            color: #ffffff;
          }
          .qr {
            margin-top: 18px;
            text-align: center;
          }
          .qr img {
            width: 180px;
            height: 180px;
            object-fit: contain;
            border-radius: 18px;
            border: 1px solid #e2e8f0;
            background: #ffffff;
            padding: 10px;
          }
          @media print {
            body { background: #ffffff; padding: 0; }
            .sheet { border: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="hero">
            <span class="badge">Mi Fiesta</span>
            <div class="title">${escapeHtml(eventData?.title || 'Evento')}</div>
            <div class="subtitle">${escapeHtml(title)} · ${escapeHtml(subtitle)}</div>
          </div>

          <div class="content">
            <div class="grid">
              <div class="card">
                <div class="eyebrow">Fecha</div>
                <div class="strong">${escapeHtml(formatDateTime(eventData?.drawDate))}</div>
                <div class="muted">Guardalo para presentar esta referencia el día del evento.</div>
              </div>

              <div class="card">
                <div class="eyebrow">Estado actual</div>
                <div class="strong">${escapeHtml(statusMeta.label)}</div>
                <div class="muted">${escapeHtml(statusMeta.description)}</div>
              </div>

              <div class="card">
                <div class="eyebrow">Modalidad</div>
                <div class="strong">${escapeHtml(eventData?.eventType === 'tables' ? 'Mesas / Boxes' : 'Lista / Entradas')}</div>
                <div class="muted">${escapeHtml(tableName || seatsText ? `${tableName}${tableName && seatsText ? ' · ' : ''}${seatsText}` : 'Acceso general')}</div>
              </div>


            </div>

<div class="status">
  <div class="eyebrow" style="color:${statusMeta.color};">Estado actual</div>
  <div class="strong" style="font-size:18px; color:${statusMeta.color};">
    ${escapeHtml(qrGuide.title)}
  </div>
  <div class="muted" style="margin-top:8px; color:${statusMeta.color};">
    ${escapeHtml(qrGuide.text)}
  </div>
</div>

            <div class="code-box">
              <div class="code-label">Código de acceso / reserva</div>
              <div class="code-value">${escapeHtml(code)}</div>
            </div>

${
  qrSrc
    ? `
      <div class="qr">
        <img src="${qrSrc}" alt="QR de acceso" />
        <div class="muted" style="margin-top:8px; max-width:520px; margin-left:auto; margin-right:auto;">
          ${escapeHtml(qrGuide.text)}
        </div>
      </div>
    `
    : `
      <div class="card" style="margin-top:18px; background:#f8fafc;">
        <div class="eyebrow">QR de acceso</div>
        <div class="muted" style="margin-top:8px;">
          Este documento ya guarda tu código de referencia. Cuando el backend entregue el QR visual, esta constancia lo va a mostrar automáticamente.
        </div>
      </div>
    `
}

            <div style="margin-top:20px;">
              <div class="eyebrow">Datos cargados</div>
              <div class="rows">
                ${attendeesHtml}
              </div>
            </div>

            <div class="footer-cta">
              <div class="eyebrow" style="color:#f9a8d4;">Creado con Mi Fiesta</div>
              <div style="margin-top:8px; font-size:18px; font-weight:900;">Organizá tu propio evento y vendé accesos online</div>
              <div style="margin-top:6px; font-size:13px; line-height:1.7; color:#cbd5e1;">
                Listas, validación de pagos, puerta, personal y seguimiento desde el celular.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export default function Buyer({ raffleIdFromUrl }: { raffleIdFromUrl?: string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const actualId = raffleIdFromUrl || id;
  const sellerId = searchParams.get('vendedor');

  const [eventData, setEventData] = useState<any>(null);
  const [legacyTickets, setLegacyTickets] = useState<any[]>([]);
  const [sellerInfo, setSellerInfo] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('transfer');

  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [attendees, setAttendees] = useState<AttendeeForm[]>([createEmptyAttendee()]);

  const [selectedTableId, setSelectedTableId] = useState<string | number | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<Array<string | number>>([]);

  const [lastPurchase, setLastPurchase] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const theme = useMemo(() => getRaffleTheme(eventData), [eventData]);
  const isFinished = eventData?.status === 'finished';
  const eventType = useMemo(() => getEventType(eventData), [eventData]);
  const enabledPaymentMethods = useMemo(() => getEnabledPaymentMethods(eventData), [eventData]);
  const tables = useMemo(() => resolveTables(eventData), [eventData]);

  const selectedTable = useMemo(() => {
    return tables.find((table) => String(table.id) === String(selectedTableId)) || null;
  }, [tables, selectedTableId]);

  const generalAvailableCount = useMemo(() => {
    return getGeneralAvailability(eventData, legacyTickets);
  }, [eventData, legacyTickets]);

  const pendingCount = useMemo(() => {
    return getGeneralPending(eventData, legacyTickets);
  }, [eventData, legacyTickets]);

  const confirmedCount = useMemo(() => {
    return getGeneralConfirmed(eventData, legacyTickets);
  }, [eventData, legacyTickets]);

  const totalCapacity = useMemo(() => {
    if (eventType === 'tables') {
      if (tables.length) return tables.length;
      return toInt(eventData?.tableCount, 0);
    }

    return (
      toInt(eventData?.maxCapacity, 0) ||
      toInt(eventData?.totalNumbers, 0) ||
      toInt(eventData?.totalTickets, 0) ||
      legacyTickets.length ||
      0
    );
  }, [eventType, eventData, legacyTickets.length, tables.length]);

  const availableTablesCount = useMemo(() => {
    if (eventType !== 'tables') return 0;
    return tables.filter((table) => getAvailableSeatCount(table, eventData) > 0).length;
  }, [eventType, tables, eventData]);

  const occupiedTablesCount = useMemo(() => {
    if (eventType !== 'tables') return 0;
    return Math.max(tables.length - availableTablesCount, 0);
  }, [eventType, tables.length, availableTablesCount]);

  const progressPercent = useMemo(() => {
    if (eventType === 'tables') {
      if (!totalCapacity) return 0;
      return Math.round((occupiedTablesCount / totalCapacity) * 100);
    }

    if (!totalCapacity) return 0;
    return Math.round((confirmedCount / totalCapacity) * 100);
  }, [eventType, totalCapacity, occupiedTablesCount, confirmedCount]);

  const shareLink = useMemo(
    () => buildShareRaffleLink(actualId, sellerId),
    [actualId, sellerId],
  );

  const shareMessage = useMemo(() => {
    return getPublicRaffleShareText(shareLink, eventData?.title);
  }, [shareLink, eventData?.title]);

  const winners = useMemo(() => {
    if (!eventData?.prizes?.length) return [];
    return [...eventData.prizes]
      .filter((p: any) => p.winningTicketNumber || p.winnerName)
      .sort((a: any, b: any) => (a.drawOrder ?? 9999) - (b.drawOrder ?? 9999));
  }, [eventData]);

  const heroSubtitle = useMemo(() => {
    if (isFinished) return 'Este evento ya finalizó.';
    if (sellerInfo) return `Estás entrando desde el link de ${sellerInfo?.seller?.firstName || sellerInfo?.firstName || 'un RRPP'}.`;
    return eventType === 'tables'
      ? 'Elegí tu mesa, completá los datos y asegurá tu lugar.'
      : 'Elegí cuántas entradas querés, cargá los datos y confirmá tu acceso.';
  }, [isFinished, sellerInfo, eventType]);

  const selectedUnitsCount = useMemo(() => {
    if (eventType === 'general') {
      return purchaseQuantity;
    }

    if (!selectedTable) return 0;

    if (Array.isArray(selectedTable.seats) && selectedTable.seats.length) {
      return selectedSeatIds.length;
    }

    return getTableCapacity(selectedTable, eventData);
  }, [eventType, purchaseQuantity, selectedTable, selectedSeatIds, eventData]);

  const unitPrice = useMemo(() => {
    if (eventType === 'tables' && selectedTable?.price != null) {
      return toMoney(selectedTable.price);
    }
    return toMoney(eventData?.ticketPrice);
  }, [eventType, selectedTable, eventData]);

  const totalAmount = useMemo(() => {
    if (eventType === 'tables' && selectedTable?.price != null) {
      return toMoney(selectedTable.price);
    }

    return unitPrice * Math.max(selectedUnitsCount, 1);
  }, [eventType, selectedTable, unitPrice, selectedUnitsCount]);

  const tourSteps = [
    {
      target: '[data-tour="buyer-hero"]',
      title: 'Bienvenido al evento',
      content:
        'Acá ves fecha, modalidad y el estado general de ocupación.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="buyer-highlights"]',
      title: 'Qué incluye tu acceso',
      content:
        'En esta parte el organizador muestra promos, lineup, beneficios o cualquier detalle importante.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="buyer-purchase-panel"]',
      title: 'Comprá sin vueltas',
      content:
        eventType === 'tables'
          ? 'Elegí visualmente la mesa o los asientos y cargá los datos de las personas.'
          : 'Primero elegís cantidad y después completás los datos de cada entrada.',
      placement: 'top',
    },
    {
      target: '[data-tour="buyer-my-access"]',
      title: 'Tu código queda guardado',
      content:
        'Después de comprar, esta sección te muestra tu código, el estado real y te deja descargar la constancia en PDF.',
      placement: 'top',
    },
    {
      target: '[data-tour="buyer-share"]',
      title: 'Compartí el evento',
      content:
        'Mandás este evento por WhatsApp con un solo toque.',
      placement: 'left',
    },
  ] satisfies Step[];

  const syncAttendeesLength = (targetLength: number) => {
    const safeLength = Math.max(0, targetLength);

    setAttendees((prev) => {
      const next = [...prev];

      if (next.length < safeLength) {
        while (next.length < safeLength) {
          next.push(createEmptyAttendee());
        }
      } else if (next.length > safeLength) {
        next.length = safeLength;
      }

      return next;
    });
  };

  const persistLastPurchase = (purchase: any) => {
    if (!actualId) return;

    const enriched = {
      ...purchase,
      __eventId: actualId,
      __savedAt: Date.now(),
    };

    setLastPurchase(enriched);
    localStorage.setItem(getPurchaseStorageKey(actualId), JSON.stringify(enriched));
  };

  const updateAttendee = (
    index: number,
    field: keyof AttendeeForm,
    value: string,
  ) => {
    setAttendees((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const loadEventData = async () => {
    if (!actualId) return;

    try {
      const res = await api.get(`/raffles/${actualId}`);
      const loadedEvent = res.data;

      setEventData(loadedEvent);
      setLegacyTickets(Array.isArray(loadedEvent?.tickets) ? loadedEvent.tickets : []);
      setSellerInfo(resolveSellerInfo(loadedEvent, sellerId));
      setSelectedPaymentMethod(getDefaultPaymentMethod(loadedEvent));
    } catch (error) {
      console.error('Error cargando evento:', error);
      Swal.fire('Ups', 'No pudimos encontrar este evento.', 'error');
    }
  };

  useEffect(() => {
    loadEventData();
  }, [actualId, sellerId]);

  useEffect(() => {
    if (!actualId) return;

    const raw = localStorage.getItem(getPurchaseStorageKey(actualId));
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.__eventId === actualId) {
        setLastPurchase(parsed);
      }
    } catch {
      //
    }
  }, [actualId]);

  useEffect(() => {
  if (!lastPurchase?.id) return;

  let cancelled = false;

  const syncPurchase = async () => {
    try {
      const response = await api.get(`/raffle-purchases/${lastPurchase.id}`);
      if (!cancelled) {
        persistLastPurchase(response.data);
      }
    } catch (error) {
      console.error('No pudimos sincronizar el estado del acceso', error);
    }
  };

  syncPurchase();

  if (!isPendingPurchase(lastPurchase?.status)) {
    return () => {
      cancelled = true;
    };
  }

  const interval = window.setInterval(syncPurchase, 15000);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}, [lastPurchase?.id, lastPurchase?.status]);

  useEffect(() => {
    if (!eventData) return;

    if (eventType === 'general') {
      syncAttendeesLength(purchaseQuantity);
      return;
    }

    if (!selectedTable) {
      syncAttendeesLength(0);
      return;
    }

    if (Array.isArray(selectedTable.seats) && selectedTable.seats.length) {
      syncAttendeesLength(selectedSeatIds.length);
      return;
    }

    syncAttendeesLength(getTableCapacity(selectedTable, eventData));
  }, [eventType, purchaseQuantity, selectedTable, selectedSeatIds, eventData]);

  useEffect(() => {
    if (!actualId || !eventData) return;

    const cleanup1 = runAfterTourAndIdle(
      () => {
        promptShare(`buyer-${actualId}`, {
          title: getSellerShareTitle(eventData.title),
          text: shareMessage,
          url: shareLink,
        });
      },
      { minDelayMs: 36000, idleMs: 18000, timeoutMs: 240000 },
    );

    const cleanup2 = runAfterTourAndIdle(
      () => {
        promptAppShare(`buyer-app-${actualId}`, window.location.origin);
      },
      { minDelayMs: 78000, idleMs: 24000, timeoutMs: 300000 },
    );

    return () => {
      cleanup1();
      cleanup2();
    };
  }, [actualId, eventData, shareLink, shareMessage]);

  useEffect(() => {
    if (!actualId) return;

    const onUpdate = async () => {
      await loadEventData();
    };

const onPurchaseUpdate = async (data: any) => {
  const incomingPurchaseId = String(data?.purchaseId || data?.id || '');

  if (lastPurchase?.id && incomingPurchaseId === String(lastPurchase.id)) {
    try {
      const refreshed = await api.get(`/raffle-purchases/${incomingPurchaseId}`);
      persistLastPurchase(refreshed.data);
    } catch (error) {
      console.error('No pudimos refrescar la compra actual', error);
    }
  }

  await loadEventData();
};

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

    socket.on(`raffle-${actualId}-update`, onUpdate);
    socket.on(`raffle-${actualId}-purchase-update`, onPurchaseUpdate);
    socket.on(`raffle-${actualId}-fomo`, onFomo);

    return () => {
      socket.off(`raffle-${actualId}-update`, onUpdate);
      socket.off(`raffle-${actualId}-purchase-update`, onPurchaseUpdate);
      socket.off(`raffle-${actualId}-fomo`, onFomo);
    };
  }, [actualId, isFinished, lastPurchase]);

  const handleCopyAlias = async () => {
    if (!eventData?.transferAlias) return;

    const ok = await copyTextToClipboard(eventData.transferAlias);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: ok ? 'success' : 'error',
      title: ok ? '¡Alias copiado!' : 'No pudimos copiar el alias',
      showConfirmButton: false,
      timer: 1800,
      background: '#ffffff',
      color: '#111827',
    });
  };

  const toggleSeatSelection = (seat: SeatLike) => {
    if (!isSeatSelectable(seat)) return;

    setSelectedSeatIds((prev) => {
      const seatId = String(seat.id);
      const exists = prev.some((current) => String(current) === seatId);

      if (exists) {
        return prev.filter((current) => String(current) !== seatId);
      }

      return [...prev, seat.id];
    });
  };

  const handleSelectTable = (table: TableLike) => {
    const tableAvailable = getAvailableSeatCount(table, eventData);

    if (tableAvailable <= 0) return;

    setSelectedTableId(table.id);
    setSelectedSeatIds([]);
  };

  const handleDownloadReservationPdf = (purchase: any) => {
    const html = buildPrintablePurchaseHtml({
      eventData,
      purchase,
      theme,
      type: 'reservation',
    });
    openPrintWindow(html);
  };

  const handleDownloadEventPdf = (purchase: any) => {
    const html = buildPrintablePurchaseHtml({
      eventData,
      purchase,
      theme,
      type: 'event',
    });
    openPrintWindow(html);
  };

const openAccessSummaryModal = async (
  purchase: any,
  uploadMeta?: {
    sourceKind: 'image' | 'pdf';
    originalSize: number;
    finalSize: number;
  },
) => {
  const accessCode = resolveAccessCode(purchase);
  const statusMeta = getPurchaseStatusMeta(purchase?.status);
  const qrGuide = getQrCustomerGuide(purchase?.status);
  const qrSrc = purchase?.qrBase64 || purchase?.qrUrl || '';
  const waText = buildBuyerAccessWhatsAppText(eventData, purchase);

  await Swal.fire({
    title: statusMeta.title,
    width: 760,
    background: '#ffffff',
    color: '#111827',
    confirmButtonColor: theme.secondaryColor || '#3483fa',
    confirmButtonText: 'Entendido',
    html: `
      <div style="text-align:left;">
        <div style="border:1px solid ${statusMeta.border}; background:${statusMeta.bg}; color:${statusMeta.color}; border-radius:18px; padding:16px;">
          <div style="font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;">
            Estado actual
          </div>
          <div style="margin-top:8px; font-size:22px; font-weight:900; line-height:1.15;">
            ${escapeHtml(statusMeta.label)}
          </div>
          <div style="margin-top:8px; font-size:13px; line-height:1.7;">
            ${escapeHtml(statusMeta.description)}
          </div>
        </div>

        <div style="margin-top:14px; border:2px dashed #cbd5e1; border-radius:20px; background:#f8fafc; padding:18px; text-align:center;">
          <div style="font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">
            Tu código de acceso / reserva
          </div>
          <div style="margin-top:8px; font-size:30px; font-weight:900; letter-spacing:.08em; color:#0f172a;">
            ${escapeHtml(accessCode)}
          </div>
          <div style="margin-top:8px; font-size:12px; line-height:1.7; color:#64748b;">
            Guardalo. Te sirve para consultar tu estado y presentarlo el día del evento.
          </div>
        </div>

        ${
          qrSrc
            ? `
              <div style="margin-top:14px; text-align:center; border:1px solid #e2e8f0; border-radius:18px; padding:16px; background:#ffffff;">
                <div style="font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">
                  Tu QR de acceso
                </div>
                <img src="${qrSrc}" alt="QR acceso" style="margin-top:10px; width:170px; height:170px; object-fit:contain; border-radius:16px; border:1px solid #e2e8f0; padding:8px; background:#fff;" />
                <div style="margin-top:10px; font-size:12px; font-weight:800; color:#0f172a;">
                  ${escapeHtml(qrGuide.badge)}
                </div>
                <div style="margin-top:6px; font-size:12px; line-height:1.7; color:#64748b; max-width:520px; margin-left:auto; margin-right:auto;">
                  ${escapeHtml(qrGuide.text)}
                </div>
              </div>
            `
            : `
              <div style="margin-top:14px; border:1px solid #e2e8f0; border-radius:18px; padding:16px; background:#ffffff;">
                <div style="font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">
                  QR de acceso
                </div>
                <div style="margin-top:8px; font-size:13px; line-height:1.7; color:#475569;">
                  Tu operación quedó registrada. Cuando el backend entregue el QR visual, esta pantalla lo va a mostrar automáticamente.
                </div>
              </div>
            `
        }

        <div style="margin-top:14px; border:1px solid #dbeafe; background:#eff6ff; border-radius:18px; padding:16px;">
          <div style="font-size:11px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#1d4ed8;">
            ¿Cómo funciona tu QR?
          </div>
          <div style="margin-top:8px; font-size:13px; line-height:1.75; color:#334155;">
            Tu QR ya quedó generado. En la entrada del evento lo escanean y ahí mismo se valida si tu acceso está aprobado, pendiente o rechazado.
          </div>
        </div>

        ${buildUploadOptimizationHtml(uploadMeta)}

        <div style="margin-top:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">
          <button id="copy-code-btn" type="button" style="border:none; border-radius:14px; padding:13px 14px; font-weight:900; background:#eaf2ff; color:#2563eb; cursor:pointer;">
            Copiar código
          </button>

          <button id="share-code-btn" type="button" style="border:none; border-radius:14px; padding:13px 14px; font-weight:900; background:#dcfce7; color:#166534; cursor:pointer;">
            Compartir por WhatsApp
          </button>

          <button id="download-request-btn" type="button" style="border:none; border-radius:14px; padding:13px 14px; font-weight:900; background:#0f172a; color:#ffffff; cursor:pointer;">
            Descargar constancia
          </button>

          <button id="download-event-btn" type="button" style="border:none; border-radius:14px; padding:13px 14px; font-weight:900; background:#f8fafc; color:#0f172a; border:1px solid #cbd5e1; cursor:pointer;">
            Descargar ficha del evento
          </button>
        </div>

        <div style="margin-top:18px; border:1px solid #dbeafe; background:#eff6ff; border-radius:18px; padding:14px;">
          <div style="font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; color:#1d4ed8;">
            ¿Organizás fiestas o eventos?
          </div>
          <div style="margin-top:6px; font-size:13px; line-height:1.8; color:#334155;">
            Creá tu propio evento, gestioná lista, pagos y acceso en puerta desde el celular.
          </div>
          <div style="margin-top:10px;">
            <a
              href="${window.location.origin}/"
              style="display:inline-block; padding:10px 14px; border-radius:12px; background:#ffffff; color:#2563eb; font-weight:900; text-decoration:none; border:1px solid #bfdbfe;"
            >
              Crear mi evento
            </a>
          </div>
        </div>
      </div>
    `,
    didOpen: () => {
      const copyBtn = document.getElementById('copy-code-btn');
      const shareBtn = document.getElementById('share-code-btn');
      const downloadRequestBtn = document.getElementById('download-request-btn');
      const downloadEventBtn = document.getElementById('download-event-btn');

      copyBtn?.addEventListener('click', async () => {
        const ok = await copyTextToClipboard(accessCode);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: ok ? 'success' : 'error',
          title: ok ? 'Código copiado' : 'No pudimos copiar el código',
          showConfirmButton: false,
          timer: 1600,
          background: '#ffffff',
          color: '#111827',
        });
      });

      shareBtn?.addEventListener('click', () => {
        openWhatsAppShare(waText);
      });

      downloadRequestBtn?.addEventListener('click', () => {
        handleDownloadReservationPdf(purchase);
      });

      downloadEventBtn?.addEventListener('click', () => {
        handleDownloadEventPdf(purchase);
      });
    },
  });
};

  const openProofModal = async (purchase: any) => {
    const alias = eventData?.transferAlias || null;
    const safeAlias = escapeHtml(alias);
    const amount = toMoney(
      purchase?.totalAmount ?? purchase?.amount ?? totalAmount ?? eventData?.ticketPrice ?? 0,
    );
    const accessCode = resolveAccessCode(purchase);

    const result = await Swal.fire({
      title: '¡Ya casi tenés tu acceso!',
      width: 720,
      background: '#ffffff',
      color: '#0f172a',
      confirmButtonText: 'Enviar comprobante',
      denyButtonText: 'Lo envío más tarde',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: theme.secondaryColor || '#3483fa',
      showDenyButton: true,
      showCancelButton: true,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      html: `
        <div style="text-align:left; color:#0f172a;">
          <p style="margin-top:0; margin-bottom:16px; font-size:14px; color:#475569;">
            Transferí el dinero al organizador y subí el comprobante para terminar de asegurar tu acceso.
          </p>

          <div style="display:grid; gap:12px;">
            <div style="border:1px solid #dbe2ea; background:#ffffff; border-radius:18px; padding:16px;">
              <div style="display:flex; align-items:start; justify-content:space-between; gap:10px;">
                <div style="min-width:0;">
                  <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#64748b;">Alias o CBU para transferir</div>
                  <div style="margin-top:6px; font-size:22px; line-height:1.15; font-weight:800; color:#0f172a; word-break:break-word;">
                    ${safeAlias || 'No configurado'}
                  </div>
                </div>
                ${
                  alias
                    ? `
                      <button
                        id="copy-alias-btn"
                        type="button"
                        style="border:none; background:#eaf2ff; color:#2563eb; border-radius:12px; padding:10px 12px; font-weight:800; cursor:pointer; white-space:nowrap;"
                      >
                        Copiar
                      </button>
                    `
                    : ''
                }
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div style="border:1px solid #dbe2ea; background:#ffffff; border-radius:16px; padding:14px;">
                <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Código generado</div>
                <div style="margin-top:6px; font-size:20px; font-weight:800; color:#0f172a;">
                  ${escapeHtml(accessCode)}
                </div>
              </div>

              <div style="border:1px solid #dbe2ea; background:#ffffff; border-radius:16px; padding:14px;">
                <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">Información de acceso</div>
                <div style="margin-top:6px; font-size:14px; color:#0f172a;">
                  Consultá con el organizador para completar tu reserva.
                </div>
              </div>
            </div>

            <div style="border:1px solid #dbe2ea; background:#f8fafc; border-radius:16px; padding:14px;">
              <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#64748b;">⏳ Vencimiento de tu reserva</div>
              <div style="margin-top:6px; font-size:14px; font-weight:700; color:#dc2626;">
                ${formatDateTime(purchase?.expiresAt)}
              </div>
            </div>

            <div>
              <input
                id="proof-file"
                type="file"
                accept="image/*,.pdf,application/pdf"
                style="display:none;"
              />

              <label
                for="proof-file"
                id="proof-file-trigger"
                style="
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  gap:10px;
                  width:100%;
                  border:2px dashed #cbd5e1;
                  border-radius:18px;
                  padding:16px;
                  background:#f8fafc;
                  cursor:pointer;
                  font-weight:800;
                  color:#0f172a;
                  transition:all .15s ease;
                "
              >
                <span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:12px; background:#eaf2ff; color:#2563eb;">
                  📸
                </span>
                <span id="proof-file-label-text">Subir imagen o PDF</span>
              </label>

              <div
                id="proof-file-name"
                style="
                  margin-top:10px;
                  min-height:56px;
                  border:1px solid #dbe2ea;
                  border-radius:14px;
                  background:#ffffff;
                  padding:12px 14px;
                  font-size:13px;
                  line-height:1.6;
                  color:#475569;
                  display:flex;
                  align-items:center;
                "
              >
                Subí una captura clara del pago. Aceptamos imágenes y archivos PDF.
              </div>

              <div style="margin-top:10px; font-size:12px; line-height:1.7; color:#64748b;">
                <strong>💡 Tip rápido:</strong> asegurate de que se lea bien el valor, la fecha y el destino. Así te validan más rápido.
              </div>
            </div>
          </div>
        </div>
      `,
      didOpen: () => {
        const fileInput = document.getElementById('proof-file') as HTMLInputElement | null;
        const fileNameBox = document.getElementById('proof-file-name');
        const fileLabelText = document.getElementById('proof-file-label-text');
        const copyAliasBtn = document.getElementById('copy-alias-btn');

        if (copyAliasBtn && alias) {
          copyAliasBtn.addEventListener('click', async () => {
            const ok = await copyTextToClipboard(alias);
            copyAliasBtn.textContent = ok ? '¡Copiado!' : 'Error';
            (copyAliasBtn as HTMLButtonElement).style.background = ok
              ? '#dcfce7'
              : '#fee2e2';
            (copyAliasBtn as HTMLButtonElement).style.color = ok
              ? '#166534'
              : '#991b1b';
          });
        }

        if (fileInput && fileNameBox && fileLabelText) {
          fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];

            if (!file) {
              fileLabelText.textContent = 'Subir imagen o PDF';
              fileNameBox.innerHTML =
                'Subí una captura clara del pago. Aceptamos imágenes y archivos PDF.';
              return;
            }

            const typeLabel = isPdfFile(file)
              ? '📄 PDF cargado'
              : isImageFile(file)
                ? '🖼️ Imagen cargada'
                : '📁 Archivo cargado';

            fileLabelText.textContent = 'Cambiar archivo';
            fileNameBox.innerHTML = `
              <div style="width:100%;">
                <div style="font-weight:800; color:#0f172a; word-break:break-word;">
                  ${escapeHtml(file.name)}
                </div>
                <div style="margin-top:4px; font-size:12px; color:#64748b;">
                  ${typeLabel} · Peso: ${escapeHtml(formatBytes(file.size))}
                </div>
              </div>
            `;
          });
        }
      },
      preConfirm: async () => {
        const input = document.getElementById('proof-file') as HTMLInputElement | null;
        const file = input?.files?.[0];
        const fileNameBox = document.getElementById('proof-file-name');

        if (!file) {
          Swal.showValidationMessage('Necesitamos que subas una imagen o PDF para confirmar el pago.');
          return;
        }

        try {
          if (fileNameBox) {
            fileNameBox.innerHTML = `
              <div style="width:100%;">
                <div style="font-weight:800; color:#0f172a;">⏳ Preparando archivo...</div>
                <div style="margin-top:4px; font-size:12px; color:#64748b;">
                  Lo estamos optimizando para un envío seguro.
                </div>
              </div>
            `;
          }

          const prepared = await prepareProofFile(file);

          if (fileNameBox) {
            fileNameBox.innerHTML = `
              <div style="width:100%;">
                <div style="font-weight:800; color:#0f172a; word-break:break-word;">
                  ${escapeHtml(prepared.file.name)}
                </div>
                <div style="margin-top:4px; font-size:12px; color:#16a34a;">
                  ✅ Listo para subir · ${formatBytes(prepared.finalSize)}
                  ${prepared.sourceKind === 'pdf' ? ' · convertido desde PDF' : ''}
                </div>
              </div>
            `;
          }

          const fileBase64 = await readFileAsDataUrl(prepared.file);

          const response = await api.post(`/raffle-purchases/${purchase.id}/proof`, {
            fileBase64,
            fileName: prepared.file.name,
            fileMimeType: prepared.file.type || 'image/jpeg',
            rawExtractedText: '',
          });

          return {
            purchaseResponse: response.data,
            uploadMeta: {
              sourceKind: prepared.sourceKind,
              originalSize: prepared.originalSize,
              finalSize: prepared.finalSize,
            },
          };
        } catch (error: any) {
          console.error('ERROR SUBIENDO COMPROBANTE', error);

          const msg =
            error?.response?.data?.message ||
            error?.message ||
            'Ocurrió un error inesperado al subir tu comprobante.';

          Swal.showValidationMessage(
            !error?.response
              ? 'Tuvimos un corte en la conexión. Por favor intentá subir el archivo nuevamente.'
              : String(msg),
          );

          return;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      const purchaseResult = result.value?.purchaseResponse || purchase;
      const uploadMeta = result.value?.uploadMeta;
      persistLastPurchase({ ...purchase, ...purchaseResult });
      await loadEventData();
      await openAccessSummaryModal({ ...purchase, ...purchaseResult }, uploadMeta);
      return;
    }

    if (result.isDenied) {
      persistLastPurchase(purchase);

      await Swal.fire({
        title: 'Reserva guardada',
        html: `
          <p>Tu reserva quedó creada con el código <b>${escapeHtml(accessCode)}</b>.</p>
          <p>Podés volver cuando quieras para subir el comprobante antes de que venza.</p>
        `,
        icon: 'info',
        confirmButtonColor: theme.secondaryColor || '#3483fa',
        background: '#ffffff',
        color: '#111827',
      });

      await openAccessSummaryModal(purchase);
    }
  };

  const validateBeforeSubmit = () => {
    if (isFinished) {
      Swal.fire('Evento finalizado', 'La lista ya está cerrada.', 'info');
      return false;
    }

    if (eventType === 'general') {
      if (purchaseQuantity <= 0) {
        Swal.fire('Aviso', 'Elegí al menos una entrada.', 'warning');
        return false;
      }

      if (purchaseQuantity > generalAvailableCount) {
        Swal.fire(
          'Sin disponibilidad',
          'No hay suficientes lugares disponibles para esa cantidad.',
          'warning',
        );
        return false;
      }
    }

    if (eventType === 'tables') {
      if (!selectedTable) {
        Swal.fire('Aviso', 'Primero elegí una mesa.', 'warning');
        return false;
      }

      if (Array.isArray(selectedTable.seats) && selectedTable.seats.length && selectedSeatIds.length <= 0) {
        Swal.fire('Aviso', 'Elegí al menos un asiento.', 'warning');
        return false;
      }
    }

    if (eventData?.ticketPrice > 0 && !selectedPaymentMethod) {
      Swal.fire('Aviso', 'Elegí cómo vas a pagar.', 'warning');
      return false;
    }

    if (
      selectedPaymentMethod === 'transfer' &&
      eventData?.ticketPrice > 0 &&
      !eventData?.transferAlias
    ) {
      Swal.fire(
        'Sin alias configurado',
        'El organizador todavía no cargó el alias o CBU de cobro.',
        'warning',
      );
      return false;
    }

    if (!attendees.length) {
      Swal.fire('Aviso', 'Completá al menos una persona para continuar.', 'warning');
      return false;
    }

    for (let i = 0; i < attendees.length; i++) {
      const current = attendees[i];

      if (!current?.fullName?.trim() || !current?.phone?.trim()) {
        Swal.fire(
          'Datos incompletos',
          `Completá nombre y WhatsApp en la entrada ${i + 1}.`,
          'warning',
        );
        return false;
      }
    }

    return true;
  };

  const handleReserve = async () => {
    if (!validateBeforeSubmit()) return;
    if (!actualId) return;

    try {
      setIsSubmitting(true);

      Swal.fire({
        title: 'Procesando tu solicitud...',
        didOpen: () => Swal.showLoading(),
        background: '#ffffff',
        color: '#111827',
        allowOutsideClick: false,
      });

      const payload = {
        raffleId: actualId,
        sellerId: sellerId || undefined,
        paymentMethod:
          eventData?.ticketPrice > 0 ? selectedPaymentMethod : ('cash' as PaymentMethod),
        quantity: selectedUnitsCount,
        attendees: attendees.map((att) => ({
          fullName: att.fullName.trim(),
          phone: att.phone.trim(),
          email: att.email.trim() || undefined,
        })),
        eventType,
        tableId: eventType === 'tables' ? selectedTableId || undefined : undefined,
        seatIds:
          eventType === 'tables' && selectedSeatIds.length
            ? selectedSeatIds
            : undefined,
      };

      const response = await api.post('/raffle-purchases/reserve', payload);
      const purchase = response.data;

      Swal.close();

      persistLastPurchase(purchase);
      await loadEventData();

      if (
        (eventData?.ticketPrice || 0) > 0 &&
        selectedPaymentMethod === 'transfer'
      ) {
        await openProofModal(purchase);
        return;
      }

      await openAccessSummaryModal(purchase);

      if (eventType === 'general') {
        setPurchaseQuantity(1);
        setAttendees([createEmptyAttendee()]);
      } else {
        setSelectedTableId(null);
        setSelectedSeatIds([]);
        setAttendees([]);
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'No pudimos completar la reserva. Probá de nuevo en unos segundos.';

      Swal.fire('Error', String(msg), 'error');
      await loadEventData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendProof = async () => {
    if (!lastPurchase) return;
    await openProofModal(lastPurchase);
  };

  if (!eventData) {
    return (
      <>
        <main className="page-fade px-3 pt-1">
          <AppHeader
            title="Mi Fiesta"
            subtitle="Obteniendo la información..."
            showBack
            onBack={() => window.history.back()}
          />

          <div className="mp-card p-6 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#3483fa]"></div>
            <p className="text-[14px] font-bold text-slate-700">Cargando el evento...</p>
          </div>
        </main>

        <BottomNav
          items={[
            { label: 'Volver', icon: 'fa-arrow-left', onClick: () => window.history.back() },
            { label: 'Inicio', icon: 'fa-home', onClick: () => navigate('/') },
            {
              label: 'Ayuda',
              icon: 'fa-headset',
              onClick: () =>
                openHelpModal(
                  'Ayuda de conexión',
                  '<p>Si se queda cargando, probá recargar la página o verificá tu conexión a internet.</p>',
                ),
            },
          ]}
        />
      </>
    );
  }

  return (
    <>
      <GuidedTour storageKey={`tour_buyer_${actualId}_v20`} steps={tourSteps} />

      <main className="page-fade px-3 md:px-6 lg:px-8 pt-2 pb-24 bg-slate-50 min-h-screen">
        <div className="mx-auto max-w-7xl w-full">
          <AppHeader
            title={eventData.title}
            subtitle={heroSubtitle}
            showBack
            onBack={() => window.history.back()}
            rightSlot={
              <button
                data-tour="buyer-share"
                type="button"
                onClick={() => openWhatsAppShare(shareMessage)}
                className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-[18px] bg-[#25D366] text-white shadow-sm border border-[#25D366] hover:scale-105 transition-transform"
              >
                <i className="fab fa-whatsapp text-[15px] lg:text-[18px]"></i>
              </button>
            }
          />

          <div className="mt-4 lg:mt-6 flex flex-col lg:flex-row gap-5 lg:gap-8 items-stretch">
            
            {/* === COLUMNA IZQUIERDA: INFORMACIÓN DEL EVENTO === */}
            <div className="flex-1 w-full space-y-4 lg:space-y-6">
              
              <motion.section
                data-tour="buyer-hero"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-[22px] lg:rounded-[2rem] shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                style={{
                  background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`,
                  color: theme.textColor,
                }}
              >
                {eventData.coverImageBase64 ? (
                  <img
                    src={eventData.coverImageBase64}
                    alt={eventData.title}
                    className="h-44 lg:h-64 w-full object-cover"
                  />
                ) : null}

                <div className="p-4 lg:p-6">
                  <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-[11px] font-black uppercase tracking-wide shadow-sm"
                      style={{
                        backgroundColor: theme.cardColor,
                        color: theme.textColor,
                      }}
                    >
                      {isFinished ? 'Evento finalizado' : 'Evento activo'}
                    </span>

                    {sellerInfo && (
                      <span
                        className="rounded-full px-2.5 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-[11px] font-black uppercase tracking-wide shadow-sm"
                        style={{
                          backgroundColor: theme.accentColor,
                          color: '#ffffff',
                        }}
                      >
                        Link de RRPP / vendedor
                      </span>
                    )}

                    {!isFinished && eventData.ticketPrice > 0 && (
                      <span
                        className="rounded-full px-2.5 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-[11px] font-black uppercase tracking-wide shadow-sm"
                        style={{
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                        }}
                      >
                        Acepta {getPaymentMethodsText(eventData)}
                      </span>
                    )}

                    <span
                      className="rounded-full px-2.5 py-1 lg:px-3 lg:py-1.5 text-[10px] lg:text-[11px] font-black uppercase tracking-wide shadow-sm"
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                      }}
                    >
                      {eventType === 'tables' ? 'Mesas / boxes' : 'Lista general'}
                    </span>
                  </div>

                  <h2 className="mt-3 text-[24px] lg:text-[32px] leading-[1.08] font-black">
                    {eventData.title}
                  </h2>

                  <p className="mt-2 lg:mt-3 text-[13px] lg:text-[15px] leading-6 opacity-95 max-w-2xl">
                    {eventData.description || 'Asegurá tu lugar de forma fácil y 100% online.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 lg:gap-3">
                    <span
                      className="rounded-full px-3 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-black shadow-sm"
                      style={{
                        backgroundColor: theme.cardColor,
                        color: theme.textColor,
                      }}
                    >
                      {eventData.ticketPrice > 0
                        ? `$${toMoney(eventData.ticketPrice).toLocaleString('es-AR')} por ${getEntryUnitLabel(eventData)}`
                        : 'Acceso gratuito'}
                    </span>

                    <span
                      className="rounded-full px-3 py-1.5 lg:px-4 lg:py-2 text-[11px] lg:text-[13px] font-black shadow-sm"
                      style={{
                        backgroundColor: theme.accentColor,
                        color: '#ffffff',
                      }}
                    >
                      <i className="far fa-calendar-alt mr-1.5"></i>
                      {formatDateTime(isFinished ? eventData.finishedAt || eventData.drawDate : eventData.drawDate)}
                    </span>
                  </div>
                </div>
              </motion.section>

              {sellerInfo && !isFinished && (
                <section className="rounded-[18px] lg:rounded-[24px] border border-slate-200 bg-white p-4 lg:p-5 shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                  <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-wide text-slate-500">
                    Ingreso desde link comercial
                  </p>
                  <p className="mt-1 text-[13px] lg:text-[15px] leading-6 text-slate-700">
                    Tu compra va a quedar asociada a{' '}
                    <b className="text-slate-900">
                      {sellerInfo?.seller?.firstName ||
                        sellerInfo?.firstName ||
                        sellerInfo?.name ||
                        'este RRPP'}
                    </b>
                    .
                  </p>
                </section>
              )}

              {isFinished && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[22px] lg:rounded-[24px] border border-emerald-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                >
                  <div className="bg-emerald-50 px-4 py-4 lg:p-6">
                    <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      Aviso importante
                    </p>
                    <h2 className="text-[22px] lg:text-[26px] leading-[1.08] font-black text-slate-900 mt-1">
                      Este evento ya pasó
                    </h2>
                    <p className="mt-1.5 text-[13px] lg:text-[14px] leading-6 text-slate-700">
                      Fecha de finalización: <b>{formatDateTime(eventData.finishedAt || eventData.drawDate)}</b>
                    </p>
                  </div>

                  <div className="p-3 lg:p-5">
                    <div className="rounded-[18px] lg:rounded-[20px] border border-slate-200 bg-[#f8f8f8] p-4 lg:p-5">
                      <p className="text-[14px] lg:text-[16px] font-black text-slate-900">¿Qué significa esto?</p>
                      <p className="mt-1 text-[13px] lg:text-[14px] leading-6 text-slate-700">
                        La lista ya fue cerrada y no se permiten nuevas compras o reservas.
                      </p>
                    </div>
                  </div>
                </motion.section>
              )}

              {eventData.prizes?.length > 0 && (
                <section data-tour="buyer-highlights" className="mp-card overflow-hidden lg:rounded-[2rem]">
                  <div className="border-b border-slate-100 bg-white px-4 py-4 lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Información adicional
                        </p>
                        <h2 className="text-[20px] lg:text-[24px] font-black text-slate-900 mt-1">
                          {isFinished ? 'Resumen del evento' : 'Destacados del evento'}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openHelpModal(
                            'Sobre este bloque',
                            isFinished
                              ? `
                                <p>Acá ves un resumen de lo que fue el evento y cualquier beneficio destacado.</p>
                              `
                              : `
                                <p>En esta sección el organizador puede mostrar promos, artistas, consumiciones o detalles importantes.</p>
                                <p>Si hay un video, podés reproducirlo acá mismo.</p>
                              `,
                          )
                        }
                        className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 lg:px-4 lg:py-3 text-[#3483fa] hover:bg-[#d8e6fa] transition"
                      >
                        <i className="fas fa-question-circle text-[14px] lg:text-[16px]"></i>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 lg:space-y-4 p-4 lg:p-6">
                    {eventData.prizes.map((p: any) => (
                      <div
                        key={p.id}
                        className="rounded-[20px] lg:rounded-[24px] border border-slate-200 bg-[#f8f8f8] p-4 lg:p-5"
                      >
                        <div className="flex gap-3 lg:gap-4">
                          {p.imageBase64 ? (
                            <img
                              src={p.imageBase64}
                              alt={p.title}
                              className="h-16 w-16 lg:h-20 lg:w-20 shrink-0 rounded-[16px] object-cover border border-slate-200 bg-white shadow-sm"
                            />
                          ) : (
                            <div className="flex h-16 w-16 lg:h-20 lg:w-20 shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white shadow-sm">
                              <i
                                className="fas fa-star text-xl lg:text-2xl"
                                style={{ color: theme.secondaryColor }}
                              ></i>
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <span
                              className="inline-block rounded-full px-2.5 py-1 text-[10px] lg:text-[11px] font-black uppercase tracking-wide shadow-sm"
                              style={{
                                backgroundColor: theme.primaryColor,
                                color: theme.textColor,
                              }}
                            >
                              Destacado {p.drawOrder ? `#${p.drawOrder}` : ''}
                            </span>

                            <h4 className="mt-2 text-[15px] lg:text-[17px] font-black text-slate-900 leading-tight">{p.title}</h4>
                            <p className="mt-1.5 text-[13px] lg:text-[14px] leading-relaxed text-slate-600 max-w-lg">
                              {p.description}
                            </p>

                            {isFinished && p.winningTicketNumber && (
                              <div className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">
                                  Resultado destacado
                                </p>
                                <p className="mt-1 text-[14px] font-black text-slate-900">
                                  Código ganador: Nº {p.winningTicketNumber}
                                </p>
                                <p className="text-[12px] text-slate-700">
                                  Ganó: <b>{p.winnerName || 'Participante registrado'}</b>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {p.youtubeLink && getYoutubeId(p.youtubeLink) && (
                          <div className="video-container mt-4 border border-slate-200 rounded-[16px] overflow-hidden shadow-sm">
                            <iframe
                              src={`https://www.youtube.com/embed/${getYoutubeId(p.youtubeLink)}`}
                              allowFullScreen
                              title={`Video ${p.title}`}
                            ></iframe>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 gap-4 lg:gap-5 sm:grid-cols-2">
                <div data-tour="buyer-payment-info" className="mp-card p-4 lg:p-6 lg:rounded-[2rem]">
                  <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Información de acceso
                  </p>
                  <p className="mt-2 text-[30px] lg:text-[36px] font-black text-slate-900 leading-none">
                    {eventData.ticketPrice > 0
                      ? `$${toMoney(eventData.ticketPrice).toLocaleString('es-AR')}`
                      : 'Gratis'}
                  </p>

                  <div className="mt-4 space-y-2 lg:space-y-3">
                    {eventData.ticketPrice > 0 ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf2ff] px-3.5 py-1.5 text-[12px] lg:text-[13px] font-black text-[#3483fa]">
                        <i className="fas fa-wallet"></i>
                        Acepta {getPaymentMethodsText(eventData)}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-[12px] lg:text-[13px] font-black text-emerald-700 border border-emerald-200">
                        <i className="fas fa-check-circle"></i>
                        Lista sin cargo
                      </div>
                    )}

                    {eventData.allowTransfer && eventData.transferAlias && (
                      <div className="rounded-[16px] lg:rounded-[18px] border border-slate-200 bg-[#f8fafc] p-3 lg:p-4 transition hover:bg-slate-50">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] lg:text-[11px] font-black uppercase tracking-wide text-slate-500">
                              Alias / CBU de cobro
                            </p>
                            <p className="mt-1 text-[13px] lg:text-[15px] font-black break-all text-slate-900">
                              {eventData.transferAlias}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleCopyAlias}
                            className="shrink-0 rounded-[14px] bg-[#eaf2ff] px-4 py-2.5 text-[12px] font-black text-[#2563eb] hover:bg-[#d8e6fa] transition"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-[12px] lg:text-[13px] leading-5 text-slate-500 font-medium">
                    <i className="far fa-clock mr-1"></i> Día del evento: {formatDateTime(eventData.drawDate)}
                  </p>
                </div>

                <div className="mp-card p-4 lg:p-6 lg:rounded-[2rem]">
                  <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Capacidad y movimiento
                  </p>

                  <div className="mt-4 space-y-2 lg:space-y-3 text-[13px] lg:text-[14px] font-medium text-slate-700">
                    {eventType === 'tables' ? (
                      <>
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <span>Mesas disponibles</span>
                          <strong className="text-slate-900 text-[15px]">{availableTablesCount}</strong>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <span>Mesas ocupadas</span>
                          <strong className="text-slate-900 text-[15px]">{occupiedTablesCount}</strong>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <span>Total mesas</span>
                          <strong className="text-slate-900 text-[15px]">{totalCapacity}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <span>Disponibles</span>
                          <strong className="text-slate-900 text-[15px]">{generalAvailableCount}</strong>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <span>En validación</span>
                          <strong className="text-slate-900 text-[15px]">{pendingCount}</strong>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                          <span>Confirmados</span>
                          <strong className="text-slate-900 text-[15px]">{confirmedCount}</strong>
                        </div>
                      </>
                    )}

                    {isFinished && (
                      <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                        <span>Estado</span>
                        <strong className="text-emerald-700">Completado</strong>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] lg:text-[13px] font-bold text-slate-600">Ocupación general</span>
                      <span className="text-[12px] lg:text-[13px] font-black text-slate-900">{progressPercent}%</span>
                    </div>
                    <div className="h-2 lg:h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: theme.secondaryColor,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!isFinished && (
                <section className="rounded-[20px] lg:rounded-[2rem] border border-slate-200 bg-white p-5 lg:p-6 shadow-sm">
                  <p className="text-[12px] lg:text-[14px] font-black uppercase tracking-wide text-slate-500">
                    Compra segura y transparente
                  </p>
                  <p className="mt-2 text-[13px] lg:text-[15px] leading-relaxed text-slate-700 max-w-3xl">
                    La plataforma evita sobreventa, respeta la capacidad real del evento y deja registrada tu operación con código único, estado y constancia descargable en PDF al instante.
                  </p>
                </section>
              )}

              <section className="overflow-hidden rounded-[24px] lg:rounded-[2rem] border border-[#dbeafe] bg-white shadow-sm">
                <div className="bg-gradient-to-r from-[#eff6ff] to-[#dbeafe] px-5 py-5 lg:p-6">
                  <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-[#2563eb]">
                    ¿Organizás eventos?
                  </p>
                  <h2 className="text-[22px] lg:text-[26px] leading-[1.08] font-black text-slate-900 mt-1">
                    Vos también podés armar algo así
                  </h2>
                  <p className="mt-2 text-[13px] lg:text-[15px] leading-6 text-slate-700">
                    Listas, cobros, validación, control de puerta, equipo de ventas y seguimiento desde el celular.
                  </p>
                </div>

                <div className="p-4 lg:p-6">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full lg:w-auto rounded-[18px] bg-[#2563eb] px-6 py-4 text-[14px] lg:text-[16px] font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
                  >
                    <i className="fas fa-rocket mr-2"></i>
                    Crear mi propio evento
                  </button>
                </div>
              </section>
            </div>

            {/* === COLUMNA DERECHA: FORMULARIO DE COMPRA Y TICKET STICKY EN PC === */}
            <div className="w-full lg:w-[420px] xl:w-[480px] shrink-0">
              <div className="lg:sticky lg:top-[100px] flex flex-col gap-4 lg:gap-5 pb-6 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar lg:pr-1">

                {!isFinished && (
                  <section className="hidden lg:block rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[12px] font-black uppercase tracking-wide text-slate-500">
                      Comprar es simple
                    </p>
                    <div className="mt-3 flex gap-3 text-[12px] text-slate-700 leading-tight font-medium">
                      <div className="flex-1 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100">
                        <strong className="block text-slate-900 mb-0.5">1. Elegí</strong>
                        {eventType === 'tables' ? 'Tu mesa' : 'Cantidad'}
                      </div>
                      <div className="flex-1 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100">
                        <strong className="block text-slate-900 mb-0.5">2. Cargá</strong>
                        Nombres
                      </div>
                      <div className="flex-1 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100">
                        <strong className="block text-slate-900 mb-0.5">3. Guardá</strong>
                        Tu ticket
                      </div>
                    </div>
                  </section>
                )}
                
                {lastPurchase && (
                  <section data-tour="buyer-my-access" className="mp-card overflow-hidden lg:rounded-[24px]">
                    <div className="border-b border-slate-100 bg-white px-4 py-4 lg:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Mi acceso
                          </p>
                          <h2 className="text-[20px] lg:text-[22px] font-black text-slate-900 leading-tight mt-1">
                            Tu último movimiento en este evento
                          </h2>
                        </div>

                        <button
                          type="button"
                          onClick={() => openAccessSummaryModal(lastPurchase)}
                          className="rounded-[16px] bg-[#eaf2ff] px-3 py-2 text-[#3483fa] hover:bg-[#d8e6fa] transition"
                        >
                          <i className="fas fa-expand-arrows-alt text-[14px]"></i>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 lg:p-5">
                      <div
                        className="rounded-[20px] border p-4 lg:p-5"
                        style={{
                          borderColor: getPurchaseStatusMeta(lastPurchase?.status).border,
                          background: getPurchaseStatusMeta(lastPurchase?.status).bg,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em]"
                              style={{ color: getPurchaseStatusMeta(lastPurchase?.status).color }}
                            >
                              Estado actual
                            </p>
                            <h3
                              className="mt-1 text-[20px] lg:text-[24px] font-black leading-none"
                              style={{ color: getPurchaseStatusMeta(lastPurchase?.status).color }}
                            >
                              {getPurchaseStatusMeta(lastPurchase?.status).label}
                            </h3>
                            <p
                              className="mt-2 text-[13px] lg:text-[14px] leading-snug"
                              style={{ color: getPurchaseStatusMeta(lastPurchase?.status).color }}
                            >
                              {getPurchaseStatusMeta(lastPurchase?.status).description}
                            </p>
                          </div>

                          <div className="rounded-[16px] bg-white px-3 py-2 lg:px-4 lg:py-3 text-right border border-black/5 shadow-sm shrink-0">
                            <p className="text-[10px] lg:text-[11px] font-black uppercase tracking-wide text-slate-500">
                              Código
                            </p>
                            <p className="mt-1 text-[16px] lg:text-[18px] font-black text-slate-900 tracking-wider">
                              {resolveAccessCode(lastPurchase)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-[16px] border border-slate-200 bg-[#f8fafc] p-3 lg:p-4">
  <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
    Cómo funciona tu QR
  </p>
  <p className="mt-2 text-[13px] lg:text-[14px] leading-6 text-slate-700">
    {getQrCustomerGuide(lastPurchase?.status).text}
  </p>
</div>

                      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => openAccessSummaryModal(lastPurchase)}
                          className="rounded-[16px] border border-slate-200 bg-white py-3 lg:py-3.5 text-[13px] lg:text-[14px] font-black text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                          <i className="fas fa-eye mr-2"></i>
                          Ver detalle
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openWhatsAppShare(buildBuyerAccessWhatsAppText(eventData, lastPurchase))
                          }
                          className="rounded-[16px] bg-[#25D366] py-3 lg:py-3.5 text-[13px] lg:text-[14px] font-black text-white hover:bg-[#20ba56] transition shadow-sm"
                        >
                          <i className="fab fa-whatsapp mr-2"></i>
                          Compartir
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadReservationPdf(lastPurchase)}
                          className="rounded-[16px] bg-slate-900 py-3 lg:py-3.5 text-[13px] lg:text-[14px] font-black text-white hover:bg-slate-800 transition shadow-sm"
                        >
                          <i className="fas fa-file-pdf mr-2"></i>
                          Descargar PDF
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadEventPdf(lastPurchase)}
                          className="rounded-[16px] border border-slate-200 bg-white py-3 lg:py-3.5 text-[13px] lg:text-[14px] font-black text-slate-700 hover:bg-slate-50 transition shadow-sm"
                        >
                          <i className="fas fa-ticket-alt mr-2 text-slate-400"></i>
                          Ficha del evento
                        </button>

                        {(lastPurchase?.status === 'reserved' ||
                          lastPurchase?.status === 'pending_proof') &&
                          eventData?.ticketPrice > 0 &&
                          (lastPurchase?.paymentMethod === 'transfer' || selectedPaymentMethod === 'transfer') && (
                            <button
                              type="button"
                              onClick={handleResendProof}
                              className="sm:col-span-2 rounded-[16px] border border-[#bfdbfe] bg-[#eff6ff] py-3.5 text-[13px] lg:text-[14px] font-black text-[#2563eb] hover:bg-[#e0efff] transition"
                            >
                              <i className="fas fa-upload mr-2"></i>
                              Cargar o reenviar comprobante
                            </button>
                          )}
                      </div>
                    </div>
                  </section>
                )}

                {!isFinished && (
                  <section data-tour="buyer-purchase-panel" className="mp-card p-4 lg:p-6 lg:rounded-[2rem]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Comprar acceso
                        </p>
                        <h2 className="text-[19px] lg:text-[22px] font-black text-slate-900 mt-1 leading-tight">
                          {eventType === 'tables' ? 'Elegí tu ubicación' : 'Asegurá tu lugar'}
                        </h2>
                      </div>
                    </div>

                    {eventType === 'general' ? (
                      <div className="space-y-5">
                        <div className="rounded-[20px] border border-slate-200 bg-[#f8fafc] p-4 lg:p-5">
                          <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wide text-slate-500 text-center mb-3">
                            Cantidad de entradas
                          </p>

                          <div className="flex items-center justify-center gap-6">
                            <button
                              type="button"
                              onClick={() => setPurchaseQuantity((prev) => Math.max(1, prev - 1))}
                              className="flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95"
                            >
                              <i className="fas fa-minus"></i>
                            </button>

                            <div className="text-center min-w-[60px]">
                              <div className="text-[36px] lg:text-[44px] font-black text-slate-900 leading-none">{purchaseQuantity}</div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setPurchaseQuantity((prev) =>
                                  Math.min(Math.max(1, generalAvailableCount), prev + 1),
                                )
                              }
                              className="flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
                              disabled={purchaseQuantity >= Math.max(1, generalAvailableCount)}
                            >
                              <i className="fas fa-plus"></i>
                            </button>
                          </div>

                          <p className="mt-4 text-center text-[12px] lg:text-[13px] text-slate-500 font-medium">
                            Disponibles ahora: <b className="text-slate-700">{generalAvailableCount}</b>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-[20px] border border-slate-200 bg-[#f8fafc] p-4 lg:p-5">
                          <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wide text-slate-500">
                            Elegí visualmente tu mesa
                          </p>
                          <p className="mt-1.5 text-[13px] lg:text-[14px] leading-relaxed text-slate-600">
                            Tocá una mesa disponible. Si el organizador configuró asientos, después podés elegir exactamente dónde querés sentarte.
                          </p>

                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
                            {tables.map((table) => {
                              const available = getAvailableSeatCount(table, eventData);
                              const selected = String(selectedTableId) === String(table.id);

                              return (
                                <button
                                  key={table.id}
                                  type="button"
                                  onClick={() => handleSelectTable(table)}
                                  disabled={available <= 0}
                                  className={`rounded-[18px] border p-4 text-left transition ${
                                    selected
                                      ? 'border-[#3483fa] bg-[#eef6ff] shadow-[0_4px_12px_rgba(52,131,250,0.15)] ring-1 ring-[#3483fa]'
                                      : available > 0
                                        ? 'border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-sm'
                                        : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-70'
                                  }`}
                                >
                                  <div className="flex flex-col gap-2">
                                    <div className="min-w-0">
                                      <p className="text-[15px] lg:text-[16px] font-black text-slate-900 truncate">
                                        {getTableName(table)}
                                      </p>
                                      <p className="text-[12px] text-slate-500 mt-0.5">
                                        Capacidad: {getTableCapacity(table, eventData)}
                                      </p>
                                    </div>

                                    <div
                                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] lg:text-[11px] font-black ${
                                        available > 0
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-slate-200 text-slate-500'
                                      }`}
                                    >
                                      {available > 0 ? `${available} libres` : 'Ocupada'}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {selectedTable && Array.isArray(selectedTable.seats) && selectedTable.seats.length > 0 && (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-4 lg:p-5 shadow-sm">
                            <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wide text-slate-500">
                              Asientos de {getTableName(selectedTable)}
                            </p>
                            <p className="mt-1 text-[13px] lg:text-[14px] leading-relaxed text-slate-600">
                              Elegí exactamente qué lugares querés ocupar.
                            </p>

                            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                              {selectedTable.seats.map((seat: SeatLike) => {
                                const selectable = isSeatSelectable(seat);
                                const isSelected = selectedSeatIds.some(
                                  (current) => String(current) === String(seat.id),
                                );
                                const seatLabel =
                                  seat.label || seat.name || String(seat.number || seat.id);

                                return (
                                  <button
                                    key={seat.id}
                                    type="button"
                                    onClick={() => toggleSeatSelection(seat)}
                                    disabled={!selectable}
                                    className={`flex h-12 lg:h-14 items-center justify-center rounded-[14px] lg:rounded-[16px] border text-[12px] lg:text-[13px] font-black transition ${
                                      isSelected
                                        ? 'border-[#3483fa] bg-[#3483fa] text-white shadow-md'
                                        : selectable
                                          ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:border-[#3483fa] hover:text-[#3483fa]'
                                          : 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                                    }`}
                                  >
                                    {seatLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedUnitsCount > 0 && (
                      <div className="mt-5 space-y-4">
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4 lg:p-5 shadow-sm">
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                              <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wide text-slate-500">
                                Datos por acceso
                              </p>
                            </div>

                            <div className="rounded-full bg-[#eaf2ff] px-3 py-1.5 text-[11px] lg:text-[12px] font-black text-[#2563eb]">
                              {selectedUnitsCount} {selectedUnitsCount === 1 ? getEntryUnitLabel(eventData) : getEntryUnitLabelPlural(eventData)}
                            </div>
                          </div>

                          <div className="space-y-3 lg:space-y-4">
                            {attendees.map((attendee, index) => (
                              <div
                                key={index}
                                className="rounded-[16px] lg:rounded-[18px] border border-slate-100 bg-[#f8fafc] p-3 lg:p-4"
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <p className="text-[13px] lg:text-[14px] font-black text-slate-900">
                                    <i className="fas fa-user-circle mr-1.5 text-slate-400"></i>
                                    {eventType === 'tables'
                                      ? `Lugar ${index + 1}`
                                      : `Entrada ${index + 1}`}
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <input
                                    type="text"
                                    value={attendee.fullName}
                                    onChange={(e) => updateAttendee(index, 'fullName', e.target.value)}
                                    placeholder="Nombre completo *"
                                    className="mp-input !text-[14px] lg:!text-[15px] bg-white lg:py-3.5"
                                  />

                                  <input
                                    type="tel"
                                    value={attendee.phone}
                                    onChange={(e) => updateAttendee(index, 'phone', e.target.value)}
                                    placeholder="WhatsApp *"
                                    className="mp-input !text-[14px] lg:!text-[15px] bg-white lg:py-3.5"
                                  />

                                  <div className="sm:col-span-2">
                                    <input
                                      type="email"
                                      value={attendee.email}
                                      onChange={(e) => updateAttendee(index, 'email', e.target.value)}
                                      placeholder="Correo electrónico (opcional)"
                                      className="mp-input !text-[14px] lg:!text-[15px] bg-white lg:py-3.5"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[20px] border border-slate-200 bg-white p-4 lg:p-5 shadow-sm">
                          <p className="text-[12px] lg:text-[13px] font-black uppercase tracking-wide text-slate-500 mb-3">
                            Forma de pago
                          </p>

                          {eventData.ticketPrice > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {enabledPaymentMethods.includes('transfer') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPaymentMethod('transfer')}
                                  className={`rounded-[16px] lg:rounded-[18px] border p-3.5 lg:p-4 text-left transition relative overflow-hidden ${
                                    selectedPaymentMethod === 'transfer'
                                      ? 'border-[#2563eb] bg-[#eff6ff] ring-1 ring-[#2563eb]'
                                      : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedPaymentMethod === 'transfer'
                                          ? 'border-[#2563eb] bg-[#2563eb]'
                                          : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {selectedPaymentMethod === 'transfer' && <div className="h-2 w-2 bg-white rounded-full"></div>}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-[14px] lg:text-[15px] font-black text-slate-900">
                                        Transferencia
                                      </p>
                                      <p className="mt-0.5 text-[12px] leading-tight text-slate-500">
                                        Alias: <span className="font-bold text-[#2563eb]">{eventData.transferAlias}</span>
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              )}

                              {enabledPaymentMethods.includes('cash') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPaymentMethod('cash')}
                                  className={`rounded-[16px] lg:rounded-[18px] border p-3.5 lg:p-4 text-left transition relative overflow-hidden ${
                                    selectedPaymentMethod === 'cash'
                                      ? 'border-[#16a34a] bg-[#f0fdf4] ring-1 ring-[#16a34a]'
                                      : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                                        selectedPaymentMethod === 'cash'
                                          ? 'border-[#16a34a] bg-[#16a34a]'
                                          : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {selectedPaymentMethod === 'cash' && <div className="h-2 w-2 bg-white rounded-full"></div>}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-[14px] lg:text-[15px] font-black text-slate-900">
                                        Efectivo
                                      </p>
                                      <p className="mt-0.5 text-[12px] leading-tight text-slate-500">
                                        Abonás en puerta o al RRPP.
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                              <i className="fas fa-gift text-emerald-600 text-xl"></i>
                              <div>
                                <p className="text-[14px] font-black text-emerald-800">
                                  Evento sin cargo
                                </p>
                                <p className="mt-0.5 text-[13px] text-emerald-700">
                                  Solo cargás los datos y asegurás tu lugar.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-[#0f172a] p-5 lg:p-6 text-white shadow-xl relative overflow-hidden">
                          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                          
                          <p className="text-[11px] lg:text-[12px] font-black uppercase tracking-[0.16em] text-slate-400 mb-4">
                            Resumen de compra
                          </p>

                          <div className="grid grid-cols-2 gap-4 text-[13px] lg:text-[14px] relative z-10">
                            <div>
                              <p className="text-slate-400 font-medium">Modalidad</p>
                              <p className="mt-1 font-black">
                                {eventType === 'tables' ? 'Mesas / boxes' : 'Lista general'}
                              </p>
                            </div>

                            <div>
                              <p className="text-slate-400 font-medium">Cantidad</p>
                              <p className="mt-1 font-black text-[#60a5fa]">
                                {selectedUnitsCount} {selectedUnitsCount === 1 ? getEntryUnitLabel(eventData) : getEntryUnitLabelPlural(eventData)}
                              </p>
                            </div>

                            {selectedTable && (
                              <div className="col-span-2 border-t border-white/10 pt-3">
                                <p className="text-slate-400 font-medium">Ubicación elegida</p>
                                <p className="mt-1 font-black text-white bg-white/10 inline-block px-3 py-1 rounded-lg">
                                  {getTableName(selectedTable)}
                                  {selectedSeatIds.length > 0
                                    ? ` · Asientos ${selectedSeatIds.join(', ')}`
                                    : ''}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-5 relative z-10">
                            <div className="w-full sm:w-auto text-left">
                              <p className="text-[12px] lg:text-[13px] text-slate-400 uppercase tracking-wider font-bold">
                                Total a pagar
                              </p>
                              <p className="text-[32px] lg:text-[36px] font-black leading-none mt-1">
                                {eventData.ticketPrice > 0
                                  ? `$${toMoney(totalAmount).toLocaleString('es-AR')}`
                                  : 'Gratis'}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={handleReserve}
                              disabled={isSubmitting}
                              className="w-full sm:w-auto rounded-[16px] lg:rounded-[20px] bg-[#3483fa] hover:bg-blue-500 text-white px-6 py-4 text-[15px] lg:text-[16px] font-black shadow-[0_8px_20px_rgba(52,131,250,0.3)] disabled:opacity-50 disabled:hover:bg-[#3483fa] transition-all hover:scale-105"
                            >
                              {eventData.ticketPrice > 0
                                ? selectedPaymentMethod === 'transfer'
                                  ? 'Abonar y subir pago'
                                  : 'Reservar lugar'
                                : 'Anotarme gratis'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Ocultamos BottomNav en PC */}
      <div className="block lg:hidden">
        <BottomNav
          items={[
            {
              label: 'Atrás',
              icon: 'fa-arrow-left',
              onClick: () => window.history.back(),
            },
            {
              label: 'Compartir',
              icon: 'fab fa-whatsapp',
              onClick: () => openWhatsAppShare(shareMessage),
            },
            {
              label: 'Ayuda',
              icon: 'fa-headset',
              onClick: () =>
                openHelpModal(
                  'Asistencia al invitado',
                  isFinished
                    ? `
                      <p>La lista de este evento ya está cerrada.</p>
                      <p>Podés revisar el resumen del evento y guardar cualquier constancia que hayas recibido.</p>
                    `
                    : `
                      <p><b>1.</b> Revisá la fecha, modalidad y cómo se confirma el lugar.</p>
                      <p><b>2.</b> Elegí cantidad o mesa, según el tipo de evento.</p>
                      <p><b>3.</b> Completá los datos de cada acceso.</p>
                      <p><b>4.</b> Guardá tu código y descargá tu constancia en PDF.</p>
                      <p>💡 Si pagás por transferencia, podés subir el comprobante acá mismo y se optimiza automáticamente para que llegue rápido.</p>
                    `,
                ),
            },
          ]}
        />
      </div>
    </>
  );
}