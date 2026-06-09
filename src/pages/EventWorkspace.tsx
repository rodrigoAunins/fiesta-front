import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type SetStateAction,
} from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import { listWorkspaceGuests, reviewWorkspaceGuest, saveWorkspaceGuests } from '../services/invitation.service';

type GuestStatus = 'confirmed' | 'pending' | 'present' | 'absent';
type GuestGender = 'female' | 'male' | 'other';
type GuestAgeGroup = 'child' | 'adult' | 'senior';
type GuestRegistrationSource = 'manual' | 'import' | 'public';
type GuestReviewStatus = 'approved' | 'pending_review' | 'rejected';
type ChecklistStatus = 'pending' | 'in_progress' | 'done';
type ProviderStatus = 'active' | 'inactive';
type LayoutElementType = 'roundTable' | 'squareTable' | 'rectTable' | 'vipTable' | 'danceFloor' | 'entrance' | 'stage' | 'bar' | 'bathroom';
type ModuleKey = 'overview' | 'guests' | 'seating' | 'providers' | 'website' | 'checklist' | 'itinerary' | 'checkin' | 'services' | 'settings';

type Guest = {
  id: string;
  name: string;
  status: GuestStatus;
  gender: GuestGender;
  food: string;
  age?: number | null;
  ageGroup: GuestAgeGroup;
  companions: number;
  companionsData: GuestCompanion[];
  table: string;
  tableId?: string;
  seatIndex?: number | null;
  phone: string;
  email?: string;
  inviteCode: string;
  note?: string;
  side: 'left' | 'right';
  registrationSource: GuestRegistrationSource;
  reviewStatus: GuestReviewStatus;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  rejectionReason?: string;
};

type GuestCompanion = {
  id: string;
  name: string;
  status?: GuestStatus;
  gender: GuestGender;
  food: string;
  age?: number | null;
  ageGroup: GuestAgeGroup;
  tableId?: string;
  seatIndex?: number | null;
  email?: string;
  phone?: string;
};

type SeatOccupant = {
  id: string;
  guestId: string;
  companionId?: string;
  name: string;
  tableId?: string;
  tableLabel?: string;
  seatIndex?: number | null;
  kind: 'guest' | 'companion';
  virtualSeat?: boolean;
};

type ChecklistItem = {
  id: string;
  task: string;
  owner: string;
  status: ChecklistStatus;
};

type ItineraryItem = {
  id: string;
  time: string;
  activity: string;
  place: string;
  owner: string;
};

type Provider = {
  id: string;
  name: string;
  category: string;
  status: ProviderStatus;
  phone: string;
  whatsapp?: string;
  imageUrl?: string;
  description?: string;
};

type ManagedUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  role?: string;
};

type WebSectionLayout = 'cover' | 'split' | 'gallery';
type WebSectionAlign = 'left' | 'center' | 'right';
type WebsiteViewport = 'desktop' | 'tablet' | 'mobile';
type WebsiteEditorTab = 'content' | 'style' | 'media' | 'canvas' | 'page';
type CanvasItemType = 'text' | 'image' | 'shape' | 'button';

type WebSection = {
  id: string;
  type: 'hero' | 'countdown' | 'details' | 'rsvp' | 'map' | 'message' | 'seatingMap';
  visible: boolean;
  eyebrow: string;
  title: string;
  content: string;
  ctaLabel: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  imageUrl: string;
  secondaryImageUrl: string;
  layout: WebSectionLayout;
  align: WebSectionAlign;
  fontFamily: string;
  titleSize: number;
  bodySize: number;
  mediaRatio: 'portrait' | 'landscape' | 'square';
  minHeight: number;
};

type CanvasItem = {
  id: string;
  type: CanvasItemType;
  label: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  background: string;
  backgroundOpacity: number;
  borderColor: string;
  borderWidth: number;
  fontFamily: string;
  fontSize: number;
  radius: number;
  rotate: number;
  opacity: number;
  zIndex: number;
  imageUrl?: string;
  visible: boolean;
};

type EventInfo = {
  name: string;
  type: string;
  date: string;
  venue: string;
};

type LayoutElement = {
  id: string;
  type: LayoutElementType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  seats?: number;
};

type WorkspaceState = {
  eventInfo: EventInfo;
  guests: Guest[];
  checklist: ChecklistItem[];
  itinerary: ItineraryItem[];
  providers: Provider[];
  layout: LayoutElement[];
  webSections: WebSection[];
  canvasItems: CanvasItem[];
  websiteBackgroundUrl: string;
  rsvpConfirmed: number;
  rsvpPending: number;
};

const STORAGE_KEY = 'rt_event_workspace_v2';
const CANVAS_CONTENT_PREFIX = 'canvas-editable-';
const LEGACY_CANVAS_CONTENT_PREFIX = 'canvas-content-';
const BOARD_W = 760;
const BOARD_H = 540;

const SEATING_BOARD_THEMES = [
  {
    value: 'classic',
    label: 'Salon clasico',
    backgroundImage:
      'radial-gradient(circle at top,rgba(244,114,182,.08),transparent 28%),linear-gradient(#ece6ef 1px,transparent 1px),linear-gradient(90deg,#ece6ef 1px,transparent 1px),linear-gradient(180deg,#fff,#fdf8ff)',
  },
  {
    value: 'garden',
    label: 'Jardin',
    backgroundImage:
      'radial-gradient(circle at top,rgba(52,211,153,.12),transparent 34%),linear-gradient(#dceee3 1px,transparent 1px),linear-gradient(90deg,#dceee3 1px,transparent 1px),linear-gradient(180deg,#f3fff8,#ecfff6)',
  },
  {
    value: 'night',
    label: 'Nocturno',
    backgroundImage:
      'radial-gradient(circle at top,rgba(99,102,241,.18),transparent 30%),linear-gradient(rgba(148,163,184,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.18) 1px,transparent 1px),linear-gradient(180deg,#0f172a,#1e1b4b)',
  },
  {
    value: 'beach',
    label: 'Costero',
    backgroundImage:
      'radial-gradient(circle at top,rgba(56,189,248,.16),transparent 30%),linear-gradient(#dbeafe 1px,transparent 1px),linear-gradient(90deg,#dbeafe 1px,transparent 1px),linear-gradient(180deg,#fffdf3,#eefbff)',
  },
];

const WEBSITE_BACKGROUND_PRESETS = [
  {
    label: 'Romantico',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Gala',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Jardin',
    url: 'https://images.unsplash.com/photo-1519167758481-83f29c8f0d1b?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Brunch',
    url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Nocturna',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Fiesta',
    url: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Salon',
    url: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Brindis',
    url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Luces',
    url: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Mesa',
    url: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Flores',
    url: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=1400&q=80',
  },
  {
    label: 'Pista',
    url: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1400&q=80',
  },
];

const WEBSITE_QUICK_PRESETS: Array<{
  label: string;
  description: string;
  backgroundUrl: string;
  content: Partial<Record<WebSection['type'], { title: string; content: string; visible?: boolean }>>;
}> = [
  {
    label: '15 / Cumple',
    description: 'Invitacion emocional con RSVP y mapa visibles.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[0].url,
    content: {
      hero: {
        title: 'Te esperamos para celebrar',
        content: 'Una noche especial con recepcion, cena, brindis y mucho baile.',
        visible: true,
      },
      details: {
        title: 'Lo importante',
        content: 'Dress code elegante · Llegar 15 min antes · Tu presencia es el mejor regalo.',
        visible: true,
      },
      rsvp: {
        title: 'Confirmame si venis',
        content: 'Hace click en confirmar para reservar tu lugar y ayudarnos a planificar mejor la mesa y el catering.',
        visible: true,
      },
      map: {
        title: 'Ubicacion y acceso',
        content: 'Salon principal · acceso por la entrada lateral · estacionamiento incluido.',
        visible: true,
      },
      seatingMap: {
        title: 'Plano de mesas',
        content: 'Muestra donde se ubica cada mesa y ayuda a cada invitado a encontrar su lugar.',
        visible: true,
      },
    },
  },
  {
    label: 'Boda',
    description: 'Mensaje más formal, cálido y elegante.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[2].url,
    content: {
      hero: {
        title: 'Nos encantaria compartir este dia con vos',
        content: 'Ceremonia, recepcion y fiesta en un mismo lugar, rodeados de la gente que queremos.',
        visible: true,
      },
      details: {
        title: 'Ceremonia y recepcion',
        content: 'Llegada 18:30 · Ceremonia 19:00 · Cena 21:00 · Fiesta hasta la madrugada.',
        visible: true,
      },
      message: {
        title: 'Un mensaje para vos',
        content: 'Gracias por acompañarnos en este momento tan importante. Nos hace felices celebrarlo juntos.',
        visible: true,
      },
      rsvp: {
        title: 'Confirmanos asistencia',
        content: 'Tu respuesta nos ayuda a cerrar la organización, las mesas y los detalles de la noche.',
        visible: true,
      },
      seatingMap: {
        title: 'Distribucion de invitados',
        content: 'Activa esta seccion si queres publicar la disposicion general del salon y las mesas.',
        visible: false,
      },
    },
  },
  {
    label: 'Evento social',
    description: 'Más directo, moderno y simple de compartir.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[5].url,
    content: {
      hero: {
        title: 'La previa arranca aca',
        content: 'Ubicacion, horario, dress code y confirmacion en una sola invitacion fácil de pasar por WhatsApp.',
        visible: true,
      },
      details: {
        title: 'Datos rapidos',
        content: 'Ingreso con lista · barra abierta hasta las 2 AM · cupos limitados.',
        visible: true,
      },
      rsvp: {
        title: 'Reservá tu lugar',
        content: 'Confirmá cuanto antes para entrar en lista y recibir toda la info final del evento.',
        visible: true,
      },
      map: {
        title: 'Como llegar',
        content: 'Te pasamos el punto exacto, referencias de acceso y recomendaciones de llegada.',
        visible: true,
      },
      seatingMap: {
        title: 'Sectorizacion del evento',
        content: 'Ideal para eventos con mesas, boxes o zonas lounge que conviene mostrar antes del ingreso.',
        visible: false,
      },
    },
  },
];

const WEBSITE_TEMPLATE_PRESETS: Array<{
  label: string;
  description: string;
  backgroundUrl: string;
  eventInfo: EventInfo;
  theme: {
    fontFamily: string;
    surfaceColor: string;
    heroColor: string;
    textColor: string;
    accentColor: string;
  };
  content: Partial<Record<WebSection['type'], { title: string; content: string; visible?: boolean }>>;
}> = [
  {
    label: '15 años',
    description: 'Portada fuerte, cuenta regresiva, detalles, RSVP y mapa.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[5].url,
    eventInfo: { name: '15 Años de Camila', type: '15 años', date: '2026-07-24', venue: 'Salon Las Rosas' },
    theme: { fontFamily: "Georgia, 'Times New Roman', serif", surfaceColor: '#fff7fb', heroColor: '#160816', textColor: '#ffffff', accentColor: '#ec4899' },
    content: {
      hero: { title: '15 Años de Camila', content: 'Una noche especial con recepcion, cena, brindis y mucho baile.', visible: true },
      countdown: { title: 'Falta muy poco', content: 'Dias para celebrar una noche que no te podes perder.', visible: true },
      details: { title: 'Lo importante', content: 'Dress code elegante. Llegar 15 min antes. Tu presencia es el mejor regalo.', visible: true },
      rsvp: { title: 'Confirmame si venis', content: 'Hace click en confirmar para reservar tu lugar y ayudarnos a planificar mejor la mesa y el catering.', visible: true },
      map: { title: 'Ubicacion y acceso', content: 'Salon principal. Acceso por la entrada lateral. Estacionamiento incluido.', visible: true },
      seatingMap: { title: 'Plano de mesas', content: 'Muestra donde se ubica cada mesa y ayuda a cada invitado a encontrar su lugar.', visible: true },
    },
  },
  {
    label: '18 años',
    description: 'Mas fiesta, pista, luces, RSVP y datos rapidos.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[11].url,
    eventInfo: { name: '18 Años de Mateo', type: '18 años', date: '2026-09-12', venue: 'Club Central' },
    theme: { fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif", surfaceColor: '#f8fbff', heroColor: '#0f172a', textColor: '#f8fafc', accentColor: '#38bdf8' },
    content: {
      hero: { title: '18 Años de Mateo', content: 'La noche arranca con amigos, musica, barra y pista hasta tarde.', visible: true },
      countdown: { title: 'Cuenta regresiva', content: 'Cada dia falta menos para festejar como corresponde.', visible: true },
      details: { title: 'Datos rapidos', content: 'Ingreso con lista. Barra disponible. Venite comodo para bailar.', visible: true },
      rsvp: { title: 'Reservar lugar', content: 'Confirmame cuanto antes asi dejamos tu nombre en lista.', visible: true },
      map: { title: 'Como llegar', content: 'Te esperamos en Club Central. La entrada principal abre desde las 21:00.', visible: true },
      message: { title: 'Trae buena energia', content: 'No hace falta nada mas que ganas de pasarla bien.', visible: true },
      seatingMap: { title: 'Sectores', content: 'Usalo si queres mostrar mesas, boxes o zonas del salon.', visible: false },
    },
  },
  {
    label: 'Casamiento',
    description: 'Elegante, romantico, con ceremonia, mensaje y confirmacion.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[2].url,
    eventInfo: { name: 'Sofia & Tomas', type: 'Casamiento', date: '2026-11-21', venue: 'Estancia Los Olivos' },
    theme: { fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", surfaceColor: '#f7fff8', heroColor: '#eefaf0', textColor: '#183126', accentColor: '#0f766e' },
    content: {
      hero: { title: 'Sofia & Tomas', content: 'Ceremonia, recepcion y fiesta en un mismo lugar, rodeados de la gente que queremos.', visible: true },
      countdown: { title: 'Nos falta poquito', content: 'Dias para encontrarnos y brindar juntos.', visible: true },
      details: { title: 'Ceremonia y recepcion', content: 'Llegada 18:30. Ceremonia 19:00. Cena 21:00. Fiesta hasta la madrugada.', visible: true },
      message: { title: 'Un mensaje para vos', content: 'Gracias por acompanarnos en este momento tan importante. Nos hace felices celebrarlo juntos.', visible: true },
      rsvp: { title: 'Confirmanos asistencia', content: 'Tu respuesta nos ayuda a cerrar la organizacion, las mesas y los detalles de la noche.', visible: true },
      map: { title: 'Llegada y acceso', content: 'Estancia Los Olivos. Habra estacionamiento y recepcion desde las 18:30.', visible: true },
      seatingMap: { title: 'Distribucion de invitados', content: 'Activa esta seccion si queres publicar la disposicion general del salon y las mesas.', visible: false },
    },
  },
  {
    label: 'Evento privado',
    description: 'Simple y moderno para cumple, egreso, reunion o fiesta privada.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[1].url,
    eventInfo: { name: 'Fiesta Privada', type: 'Evento privado', date: '2026-08-08', venue: 'Terraza Norte' },
    theme: { fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif", surfaceColor: '#fffaf5', heroColor: '#fff3e8', textColor: '#25140a', accentColor: '#f97316' },
    content: {
      hero: { title: 'La previa arranca aca', content: 'Ubicacion, horario, dress code y confirmacion en una sola invitacion facil de pasar por WhatsApp.', visible: true },
      countdown: { title: 'Se viene', content: 'Dias para encontrarnos.', visible: true },
      details: { title: 'Datos rapidos', content: 'Ingreso con lista. Barra abierta hasta las 2 AM. Cupos limitados.', visible: true },
      rsvp: { title: 'Reserva tu lugar', content: 'Confirma cuanto antes para entrar en lista y recibir toda la info final del evento.', visible: true },
      map: { title: 'Como llegar', content: 'Te pasamos el punto exacto, referencias de acceso y recomendaciones de llegada.', visible: true },
      seatingMap: { title: 'Sectorizacion del evento', content: 'Ideal para eventos con mesas, boxes o zonas lounge que conviene mostrar antes del ingreso.', visible: false },
    },
  },
];

const GUEST_FOOD_PRESETS = [
  'Sin restriccion',
  'Vegetariana',
  'Vegana',
  'Sin TACC',
  'Sin lactosa',
  'Kosher',
  'Infantil',
];

const GUEST_GENDER_OPTIONS: Array<{ value: GuestGender; label: string; icon: string }> = [
  { value: 'female', label: 'Mujer', icon: 'fa-venus' },
  { value: 'male', label: 'Hombre', icon: 'fa-mars' },
  { value: 'other', label: 'Otro', icon: 'fa-user' },
];

const GUEST_AGE_GROUP_OPTIONS: Array<{ value: GuestAgeGroup; label: string }> = [
  { value: 'child', label: 'Niño' },
  { value: 'adult', label: 'Adulto' },
  { value: 'senior', label: 'Mayor' },
];

const FONT_OPTIONS = [
  { label: 'Editorial serif', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Clasica elegante', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif" },
  { label: 'Moderna limpia', value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Impacto premium', value: "Verdana, Geneva, sans-serif" },
  { label: 'Romantica suave', value: "'Gill Sans', 'Trebuchet MS', sans-serif" },
];

const MEDIA_RATIO_OPTIONS: Array<{ value: WebSection['mediaRatio']; label: string }> = [
  { value: 'portrait', label: 'Vertical' },
  { value: 'landscape', label: 'Horizontal' },
  { value: 'square', label: 'Cuadrada' },
];

const WEBSITE_VIEWPORT_OPTIONS: Array<{ value: WebsiteViewport; label: string; icon: string }> = [
  { value: 'desktop', label: 'Escritorio', icon: 'fa-desktop' },
  { value: 'tablet', label: 'Tablet', icon: 'fa-tablet-screen-button' },
  { value: 'mobile', label: 'Vertical', icon: 'fa-mobile-screen-button' },
];

const WEBSITE_EDITOR_TABS: Array<{ value: WebsiteEditorTab; label: string; icon: string }> = [
  { value: 'content', label: 'Contenido', icon: 'fa-pen-to-square' },
  { value: 'style', label: 'Estilo', icon: 'fa-swatchbook' },
  { value: 'media', label: 'Imagenes', icon: 'fa-images' },
  { value: 'canvas', label: 'Lienzo', icon: 'fa-object-group' },
  { value: 'page', label: 'Pagina', icon: 'fa-wand-magic-sparkles' },
];

const WEBSITE_SECTION_OPTIONS: Array<{ type: WebSection['type']; label: string; icon: string }> = [
  { type: 'hero', label: 'Portada', icon: 'fa-sparkles' },
  { type: 'countdown', label: 'Cuenta regresiva', icon: 'fa-hourglass-half' },
  { type: 'details', label: 'Detalles', icon: 'fa-circle-info' },
  { type: 'rsvp', label: 'RSVP', icon: 'fa-check-to-slot' },
  { type: 'map', label: 'Ubicacion', icon: 'fa-location-dot' },
  { type: 'message', label: 'Mensaje', icon: 'fa-envelope-open-text' },
  { type: 'seatingMap', label: 'Plano', icon: 'fa-table-cells-large' },
];

const WEBSITE_QUICK_ACCENT_COLORS = ['#f43f5e', '#ec4899', '#8b5cf6', '#2563eb', '#0f766e', '#f59e0b', '#111827'];

const WEBSITE_STYLE_THEMES = [
  {
    value: 'editorial-rose',
    label: 'Editorial Rose',
    description: 'Serif romantica con base clara y acento rosado.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[0].url,
    fontFamily: FONT_OPTIONS[0].value,
    surfaceColor: '#fff8fb',
    heroColor: '#fff1f7',
    textColor: '#21131d',
    accentColor: '#f43f5e',
  },
  {
    value: 'modern-night',
    label: 'Modern Night',
    description: 'Contraste elegante para fiesta nocturna o gala.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[4].url,
    fontFamily: FONT_OPTIONS[2].value,
    surfaceColor: '#f8f7ff',
    heroColor: '#eef2ff',
    textColor: '#16163a',
    accentColor: '#4f46e5',
  },
  {
    value: 'garden-day',
    label: 'Garden Day',
    description: 'Paleta aireada para bodas, brunch o jardin.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[2].url,
    fontFamily: FONT_OPTIONS[1].value,
    surfaceColor: '#f6fff8',
    heroColor: '#edfdf2',
    textColor: '#183126',
    accentColor: '#0f766e',
  },
  {
    value: 'golden-party',
    label: 'Golden Party',
    description: 'Mas brillante, ideal para quince o cumple premium.',
    backgroundUrl: WEBSITE_BACKGROUND_PRESETS[5].url,
    fontFamily: FONT_OPTIONS[4].value,
    surfaceColor: '#fffaf0',
    heroColor: '#fff5d8',
    textColor: '#34230f',
    accentColor: '#d97706',
  },
];

const SECTION_STYLE_DEFAULTS: Record<
  WebSection['type'],
  Pick<
    WebSection,
    | 'backgroundColor'
    | 'textColor'
    | 'accentColor'
    | 'imageUrl'
    | 'secondaryImageUrl'
    | 'layout'
    | 'align'
    | 'fontFamily'
    | 'titleSize'
    | 'bodySize'
    | 'mediaRatio'
  >
> = {
  hero: {
    backgroundColor: '#fff7fb',
    textColor: '#1f1530',
    accentColor: '#f43f5e',
    imageUrl: WEBSITE_BACKGROUND_PRESETS[0].url,
    secondaryImageUrl: WEBSITE_BACKGROUND_PRESETS[1].url,
    layout: 'cover',
    align: 'center',
    fontFamily: FONT_OPTIONS[0].value,
    titleSize: 76,
    bodySize: 20,
    mediaRatio: 'landscape',
  },
  countdown: {
    backgroundColor: '#190a1f',
    textColor: '#ffffff',
    accentColor: '#f472b6',
    imageUrl: WEBSITE_BACKGROUND_PRESETS[4].url,
    secondaryImageUrl: '',
    layout: 'cover',
    align: 'center',
    fontFamily: FONT_OPTIONS[2].value,
    titleSize: 64,
    bodySize: 22,
    mediaRatio: 'landscape',
  },
  details: {
    backgroundColor: '#fff9f4',
    textColor: '#22161b',
    accentColor: '#f97316',
    imageUrl: WEBSITE_BACKGROUND_PRESETS[5].url,
    secondaryImageUrl: WEBSITE_BACKGROUND_PRESETS[3].url,
    layout: 'split',
    align: 'left',
    fontFamily: FONT_OPTIONS[0].value,
    titleSize: 54,
    bodySize: 18,
    mediaRatio: 'portrait',
  },
  rsvp: {
    backgroundColor: '#ffffff',
    textColor: '#241522',
    accentColor: '#8b5cf6',
    imageUrl: WEBSITE_BACKGROUND_PRESETS[2].url,
    secondaryImageUrl: WEBSITE_BACKGROUND_PRESETS[0].url,
    layout: 'split',
    align: 'center',
    fontFamily: FONT_OPTIONS[2].value,
    titleSize: 48,
    bodySize: 18,
    mediaRatio: 'portrait',
  },
  map: {
    backgroundColor: '#fffaf0',
    textColor: '#231815',
    accentColor: '#14b8a6',
    imageUrl: WEBSITE_BACKGROUND_PRESETS[2].url,
    secondaryImageUrl: WEBSITE_BACKGROUND_PRESETS[3].url,
    layout: 'gallery',
    align: 'left',
    fontFamily: FONT_OPTIONS[1].value,
    titleSize: 42,
    bodySize: 18,
    mediaRatio: 'landscape',
  },
  message: {
    backgroundColor: '#fff7ed',
    textColor: '#2d1c18',
    accentColor: '#ec4899',
    imageUrl: WEBSITE_BACKGROUND_PRESETS[3].url,
    secondaryImageUrl: WEBSITE_BACKGROUND_PRESETS[0].url,
    layout: 'gallery',
    align: 'center',
    fontFamily: FONT_OPTIONS[1].value,
    titleSize: 44,
    bodySize: 18,
    mediaRatio: 'portrait',
  },
  seatingMap: {
    backgroundColor: '#fff8fb',
    textColor: '#22161b',
    accentColor: '#14b8a6',
    imageUrl: '',
    secondaryImageUrl: '',
    layout: 'gallery',
    align: 'left',
    fontFamily: FONT_OPTIONS[2].value,
    titleSize: 44,
    bodySize: 18,
    mediaRatio: 'landscape',
  },
};

const SECTION_EXAMPLES: Record<WebSection['type'], { title: string; content: string }> = {
  hero: {
    title: 'Una noche para celebrar juntos',
    content: 'Guardá la fecha, preparate para una noche especial y encontrá toda la info importante en esta invitacion.',
  },
  countdown: {
    title: 'Falta muy poco',
    content: 'Activá la cuenta regresiva para generar expectativa y hacer que la invitacion se sienta viva.',
  },
  details: {
    title: 'Todo lo que tenes que saber',
    content: 'Horario de llegada, dress code, estacionamiento, ingreso y cualquier detalle que te ahorre preguntas por WhatsApp.',
  },
  rsvp: {
    title: 'Confirmame asistencia',
    content: 'Con un click nos ayudas a cerrar mesa, comida, personal y toda la organizacion del evento.',
  },
  map: {
    title: 'Llegada y acceso',
    content: 'Incluí referencias de ingreso, punto de recepción, estacionamiento o cualquier aclaración útil para tus invitados.',
  },
  message: {
    title: 'Un mensaje especial',
    content: 'Podés dejar una dedicatoria, aclarar el tipo de regalo o cerrar la invitacion con un tono más personal.',
  },
  seatingMap: {
    title: 'Plano del sitio',
    content: 'Publicá la disposicion general de mesas y sectores solo si queres mostrarla a tus invitados.',
  },
};

function getWebsiteSectionLabel(type: WebSection['type']) {
  return WEBSITE_SECTION_OPTIONS.find((option) => option.type === type)?.label || type;
}

function createWebsiteSection(type: WebSection['type']): WebSection {
  const example = SECTION_EXAMPLES[type];
  return normalizeWebSection(
    {
      id: nextId('web-section'),
      type,
      title: example.title,
      content: example.content,
      visible: true,
    },
    0,
  );
}

type WorkspaceMenuGroup = {
  title?: string;
  items: Array<{ key: ModuleKey; label: string; icon: string }>;
};

const menuGroups: WorkspaceMenuGroup[] = [
  {
    items: [
      { key: 'overview', label: 'Inicio', icon: 'fa-house' },
      { key: 'guests', label: 'Invitados', icon: 'fa-users' },
    ],
  },
  {
    title: 'Lugar y proveedores',
    items: [
      { key: 'seating', label: 'Planos y mesas', icon: 'fa-table-cells-large' },
      { key: 'providers', label: 'Proveedores', icon: 'fa-briefcase' },
    ],
  },
  {
    title: 'Herramientas',
    items: [
      { key: 'website', label: 'Invitacion digital', icon: 'fa-envelope-open-text' },
      { key: 'itinerary', label: 'Cronograma', icon: 'fa-clock' },
      { key: 'checkin', label: 'Control de entrada', icon: 'fa-qrcode' },
    ],
  },
  {
    items: [{ key: 'settings', label: 'Configuracion', icon: 'fa-gear' }],
  },
];

const palette: Array<{ type: LayoutElementType; icon: string; label: string }> = [
  { type: 'roundTable', label: 'Mesa redonda', icon: 'fa-circle' },
  { type: 'squareTable', label: 'Mesa cuadrada', icon: 'fa-square' },
  { type: 'rectTable', label: 'Mesa rectangular', icon: 'fa-table' },
  { type: 'vipTable', label: 'Mesa VIP', icon: 'fa-star' },
  { type: 'danceFloor', label: 'Pista', icon: 'fa-record-vinyl' },
  { type: 'entrance', label: 'Entrada', icon: 'fa-door-open' },
  { type: 'stage', label: 'Escenario', icon: 'fa-microphone' },
  { type: 'bar', label: 'Barra', icon: 'fa-martini-glass' },
  { type: 'bathroom', label: 'Banos', icon: 'fa-restroom' },
];

const elementConfig: Record<
  LayoutElementType,
  {
    label: string;
    icon: string;
    gradient: string;
    textColor: string;
    borderRadius: string;
    defaultWidth: number;
    defaultHeight: number;
    defaultSeats?: number;
  }
> = {
  roundTable: {
    label: 'Mesa redonda',
    icon: 'fa-circle',
    gradient: 'linear-gradient(135deg,#fb7185,#ec4899)',
    textColor: '#fff',
    borderRadius: '999px',
    defaultWidth: 96,
    defaultHeight: 96,
    defaultSeats: 8,
  },
  squareTable: {
    label: 'Mesa cuadrada',
    icon: 'fa-square',
    gradient: 'linear-gradient(135deg,#818cf8,#4f46e5)',
    textColor: '#fff',
    borderRadius: '18px',
    defaultWidth: 112,
    defaultHeight: 96,
    defaultSeats: 10,
  },
  rectTable: {
    label: 'Mesa rectangular',
    icon: 'fa-table',
    gradient: 'linear-gradient(135deg,#38bdf8,#0891b2)',
    textColor: '#fff',
    borderRadius: '16px',
    defaultWidth: 160,
    defaultHeight: 76,
    defaultSeats: 12,
  },
  vipTable: {
    label: 'Mesa VIP',
    icon: 'fa-star',
    gradient: 'linear-gradient(135deg,#fde68a,#f59e0b)',
    textColor: '#2a1702',
    borderRadius: '999px',
    defaultWidth: 110,
    defaultHeight: 110,
    defaultSeats: 6,
  },
  danceFloor: {
    label: 'Pista',
    icon: 'fa-record-vinyl',
    gradient: 'linear-gradient(135deg,#7c3aed,#ec4899,#f43f5e)',
    textColor: '#fff',
    borderRadius: '999px',
    defaultWidth: 165,
    defaultHeight: 165,
  },
  entrance: {
    label: 'Entrada',
    icon: 'fa-door-open',
    gradient: 'linear-gradient(135deg,#34d399,#0f766e)',
    textColor: '#fff',
    borderRadius: '16px',
    defaultWidth: 124,
    defaultHeight: 54,
  },
  stage: {
    label: 'Escenario',
    icon: 'fa-microphone',
    gradient: 'linear-gradient(135deg,#8b5cf6,#5b21b6)',
    textColor: '#fff',
    borderRadius: '18px',
    defaultWidth: 185,
    defaultHeight: 64,
  },
  bar: {
    label: 'Barra',
    icon: 'fa-martini-glass',
    gradient: 'linear-gradient(135deg,#fb923c,#ea580c)',
    textColor: '#fff',
    borderRadius: '16px',
    defaultWidth: 145,
    defaultHeight: 56,
  },
  bathroom: {
    label: 'Banos',
    icon: 'fa-restroom',
    gradient: 'linear-gradient(135deg,#94a3b8,#475569)',
    textColor: '#fff',
    borderRadius: '16px',
    defaultWidth: 106,
    defaultHeight: 54,
  },
};

function toast(title: string, icon: 'success' | 'info' | 'warning' = 'success') {
  void Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true,
    icon,
    title,
    background: '#180816',
    color: '#fff',
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function nextId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function createInviteCode(source: string) {
  return `${slugify(source || 'invitado') || 'invitado'}-${Math.random().toString(36).slice(2, 6)}`;
}

function getWorkspaceStorageKey(workspaceId?: string | null) {
  return workspaceId ? `${STORAGE_KEY}:${workspaceId}` : STORAGE_KEY;
}

function getInvitationUrl(workspaceId?: string | null, guestId?: string | null) {
  const eventId = workspaceId || 'demo';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const suffix = guestId ? `?guest=${encodeURIComponent(guestId)}` : '';
  return `${origin}/invitation/${eventId}${suffix}`;
}

function copyText(value: string, successMessage: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value);
    toast(successMessage, 'info');
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  toast(successMessage, 'info');
}

function normalizeImportedGuestStatus(raw: unknown): GuestStatus {
  const value = String(raw || '').trim().toLowerCase();
  if (['confirmado', 'confirmed', 'si', 'sí', 'yes'].includes(value)) return 'confirmed';
  if (['presente', 'present'].includes(value)) return 'present';
  if (['ausente', 'absent', 'no'].includes(value)) return 'absent';
  return 'pending';
}

function normalizeGuestGender(raw: unknown): GuestGender {
  const value = String(raw || '').trim().toLowerCase();
  if (['mujer', 'female', 'femenino', 'f'].includes(value)) return 'female';
  if (['hombre', 'male', 'masculino', 'm'].includes(value)) return 'male';
  return 'other';
}

function normalizeGuestAge(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 130) return null;
  return Math.round(value);
}

function normalizeSeatIndex(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 500) return null;
  return value;
}

function normalizeGuestAgeGroup(raw: unknown): GuestAgeGroup {
  const value = String(raw || '').trim().toLowerCase();
  if (['child', 'niño', 'nino', 'menor'].includes(value)) return 'child';
  if (['senior', 'mayor', 'adulto mayor'].includes(value)) return 'senior';
  return 'adult';
}

function normalizeRegistrationSource(raw: unknown): GuestRegistrationSource {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'public' || value === 'import') return value;
  return 'manual';
}

function normalizeReviewStatus(raw: unknown): GuestReviewStatus {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'pending_review' || value === 'pending-review') return 'pending_review';
  if (value === 'rejected') return 'rejected';
  return 'approved';
}

function normalizeCompanion(raw: Partial<GuestCompanion>, index: number): GuestCompanion {
  const name = String(raw.name || `Acompañante ${index + 1}`).trim() || `Acompañante ${index + 1}`;

  return {
    id: String(raw.id || nextId('companion')),
    name,
    status: normalizeImportedGuestStatus(raw.status),
    gender: normalizeGuestGender(raw.gender),
    food: String(raw.food || 'Sin restriccion').trim() || 'Sin restriccion',
    age: normalizeGuestAge(raw.age),
    ageGroup: normalizeGuestAgeGroup(raw.ageGroup),
    tableId: String(raw.tableId || '').trim() || undefined,
    seatIndex: normalizeSeatIndex(raw.seatIndex),
    email: String(raw.email || '').trim() || undefined,
    phone: String(raw.phone || '').trim() || undefined,
  };
}

function normalizeCompanionsData(raw: Partial<Guest>): GuestCompanion[] {
  const data = Array.isArray(raw.companionsData)
    ? raw.companionsData
        .filter((item) => String(item?.name || '').trim())
        .map((item, index) => normalizeCompanion(item, index))
    : [];

  if (data.length) return data;

  const count = clamp(Number(raw.companions ?? 0), 0, 20);
  return Array.from({ length: count }, (_, index) => normalizeCompanion({ name: `Acompañante ${index + 1}` }, index));
}

function getGuestStatusLabel(status: GuestStatus) {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'present') return 'Presente';
  if (status === 'absent') return 'Ausente';
  return 'Pendiente';
}

function getGuestGenderLabel(gender: GuestGender) {
  if (gender === 'female') return 'Mujer';
  if (gender === 'male') return 'Hombre';
  return 'Otro';
}

function getGuestAgeGroupLabel(ageGroup: GuestAgeGroup) {
  if (ageGroup === 'child') return 'Niño';
  if (ageGroup === 'senior') return 'Mayor';
  return 'Adulto';
}

function getReviewStatusLabel(reviewStatus: GuestReviewStatus) {
  if (reviewStatus === 'pending_review') return 'Revisión pendiente';
  if (reviewStatus === 'rejected') return 'Rechazado';
  return 'Aprobado';
}

function getGuestGenderIcon(gender: GuestGender) {
  if (gender === 'female') return 'fa-venus';
  if (gender === 'male') return 'fa-mars';
  return 'fa-user';
}

function getSideLabel(side: Guest['side']) {
  return side === 'left' ? 'Lado A' : 'Lado B';
}

function getSectionAlignClass(align: WebSectionAlign) {
  if (align === 'left') return 'items-start text-left';
  if (align === 'right') return 'items-end text-right';
  return 'items-center text-center';
}

function getMediaRatioClass(ratio: WebSection['mediaRatio'], isMobile: boolean) {
  if (ratio === 'portrait') return 'aspect-[3/4]';
  if (ratio === 'square') return 'aspect-square';
  return isMobile ? 'aspect-[4/3]' : 'aspect-[16/10]';
}

function normalizeWebSection(raw: Partial<WebSection> | undefined, index: number): WebSection {
  const type = raw?.type || (['hero', 'countdown', 'details', 'rsvp', 'map', 'message', 'seatingMap'][index] as WebSection['type']) || 'message';
  const defaults = SECTION_STYLE_DEFAULTS[type];

  return {
    id: String(raw?.id || `${type}-${index + 1}`),
    type,
    visible: raw?.visible !== false,
    eyebrow: String(raw?.eyebrow || getWebsiteSectionLabel(type)).trim(),
    title: String(raw?.title || '').trim(),
    content: String(raw?.content || '').trim(),
    ctaLabel: String(raw?.ctaLabel || (type === 'rsvp' ? 'Confirmar asistencia' : '')).trim(),
    backgroundColor: String(raw?.backgroundColor || defaults.backgroundColor),
    textColor: String(raw?.textColor || defaults.textColor),
    accentColor: String(raw?.accentColor || defaults.accentColor),
    imageUrl: String(raw?.imageUrl || defaults.imageUrl),
    secondaryImageUrl: String(raw?.secondaryImageUrl || defaults.secondaryImageUrl),
    layout: raw?.layout === 'split' || raw?.layout === 'gallery' ? raw.layout : defaults.layout,
    align: raw?.align === 'left' || raw?.align === 'right' ? raw.align : defaults.align,
    fontFamily: String(raw?.fontFamily || defaults.fontFamily),
    titleSize: clamp(Number(raw?.titleSize || defaults.titleSize), 24, 120),
    bodySize: clamp(Number(raw?.bodySize || defaults.bodySize), 12, 36),
    mediaRatio: raw?.mediaRatio === 'portrait' || raw?.mediaRatio === 'square' ? raw.mediaRatio : defaults.mediaRatio,
    minHeight: clamp(Number(raw?.minHeight || (type === 'hero' ? 72 : type === 'seatingMap' ? 62 : 44)), 32, 110),
  };
}

function hexToRgba(hex: string, opacity: number) {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return hex;
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${clamp(opacity, 0, 1)})`;
}

function normalizeCanvasItem(raw: Partial<CanvasItem> | undefined, index: number): CanvasItem {
  const type = raw?.type === 'image' || raw?.type === 'shape' || raw?.type === 'button' ? raw.type : 'text';
  const label = String(raw?.label || (type === 'image' ? 'Imagen libre' : type === 'shape' ? 'Forma' : type === 'button' ? 'Boton RSVP' : 'Texto libre')).trim();

  return {
    id: String(raw?.id || nextId('canvas')),
    type,
    label,
    text: String(raw?.text || (type === 'button' ? 'Confirmar asistencia' : type === 'shape' ? '' : 'Nuevo texto')).trim(),
    x: clamp(Number(raw?.x ?? 18 + index * 8), 0, 92),
    y: clamp(Number(raw?.y ?? 18 + index * 7), 0, 92),
    w: clamp(Number(raw?.w ?? (type === 'image' ? 24 : type === 'shape' ? 18 : type === 'button' ? 18 : 30)), 8, type === 'button' ? 34 : 92),
    h: clamp(Number(raw?.h ?? (type === 'image' ? 22 : type === 'shape' ? 12 : type === 'button' ? 3.5 : 10)), 2.5, type === 'button' ? 6 : 80),
    color: String(raw?.color || (type === 'button' ? '#ffffff' : '#1f1321')),
    background: String(raw?.background || (type === 'button' ? '#ec4899' : type === 'shape' ? '#ec4899' : '#ffffff')),
    backgroundOpacity: clamp(Number(raw?.backgroundOpacity ?? (type === 'text' ? 0.72 : 1)), 0, 1),
    borderColor: String(raw?.borderColor || (type === 'button' ? '#ffffff' : '#ffffff')),
    borderWidth: clamp(Number(raw?.borderWidth ?? 1), 0, 12),
    fontFamily: String(raw?.fontFamily || FONT_OPTIONS[2]?.value || 'Inter, system-ui, sans-serif'),
    fontSize: clamp(Number(raw?.fontSize || (type === 'button' ? 16 : 28)), 10, 96),
    radius: clamp(Number(raw?.radius ?? (type === 'shape' ? 999 : 20)), 0, 999),
    rotate: clamp(Number(raw?.rotate ?? 0), -180, 180),
    opacity: clamp(Number(raw?.opacity ?? 1), 0.05, 1),
    zIndex: clamp(Number(raw?.zIndex ?? 40 + index), 1, 200),
    imageUrl: String(raw?.imageUrl || ''),
    visible: raw?.visible !== false,
  };
}

function buildDefaultCanvasItems(): CanvasItem[] {
  return [];
}

function isGeneratedCanvasItem(id: string) {
  return id.startsWith(CANVAS_CONTENT_PREFIX) || id.startsWith(LEGACY_CANVAS_CONTENT_PREFIX);
}

function buildCanvasItemsFromInvitation(eventInfo: EventInfo, webSections: WebSection[]): CanvasItem[] {
  const items: CanvasItem[] = [];

  webSections.filter((section) => section.visible).forEach((section, index) => {
    const split = section.layout === 'split';
    const textX = section.type === 'hero' ? 15 : section.align === 'right' ? 50 : section.align === 'left' ? 8 : split ? 8 : 20;
    const textW = section.type === 'hero' ? 70 : section.align === 'center' ? 58 : split ? 42 : 56;
    const titleText = section.type === 'hero' ? eventInfo.name : section.title || SECTION_EXAMPLES[section.type].title;
    const eyebrowText = section.type === 'hero' ? eventInfo.type : section.eyebrow || getWebsiteSectionLabel(section.type);
    const bodyText = section.content || (section.type === 'countdown' ? `dias para encontrarnos en ${eventInfo.venue}` : '');

    const addItem = (raw: Partial<CanvasItem>) => {
      items.push(normalizeCanvasItem(raw, items.length));
    };

    addItem({
      id: `${CANVAS_CONTENT_PREFIX}${section.id}-eyebrow`,
      type: 'text',
      label: `${getWebsiteSectionLabel(section.type)} etiqueta`,
      text: eyebrowText,
      x: textX,
      y: section.type === 'hero' ? 9 : 14,
      w: Math.min(textW, 44),
      h: 6,
      color: section.accentColor,
      backgroundOpacity: 0,
      borderWidth: 0,
      fontFamily: section.fontFamily,
      fontSize: section.type === 'hero' ? 16 : 12,
      zIndex: 62 + index * 8,
    });

    addItem({
      id: `${CANVAS_CONTENT_PREFIX}${section.id}-title`,
      type: 'text',
      label: `${getWebsiteSectionLabel(section.type)} titulo`,
      text: titleText,
      x: textX,
      y: section.type === 'hero' ? 18 : 22,
      w: textW,
      h: section.type === 'hero' ? 20 : 17,
      color: section.textColor,
      backgroundOpacity: 0,
      borderWidth: 0,
      fontFamily: section.fontFamily,
      fontSize: Math.round(section.titleSize * (section.type === 'hero' ? 0.78 : 0.64)),
      zIndex: 63 + index * 8,
    });

    if (section.type === 'hero') {
      addItem({
        id: `${CANVAS_CONTENT_PREFIX}${section.id}-date`,
        type: 'text',
        label: 'Fecha',
        text: eventInfo.date,
        x: textX + 7,
        y: 43,
        w: 19,
        h: 7,
        color: '#ffffff',
        background: section.accentColor,
        backgroundOpacity: 0.9,
        borderColor: '#ffffff',
        borderWidth: 1,
        radius: 999,
        fontFamily: section.fontFamily,
        fontSize: 13,
        zIndex: 64 + index * 8,
      });
      addItem({
        id: `${CANVAS_CONTENT_PREFIX}${section.id}-venue`,
        type: 'text',
        label: 'Lugar',
        text: eventInfo.venue,
        x: textX + 30,
        y: 43,
        w: 26,
        h: 7,
        color: '#ffffff',
        background: section.accentColor,
        backgroundOpacity: 0.9,
        borderColor: '#ffffff',
        borderWidth: 1,
        radius: 999,
        fontFamily: section.fontFamily,
        fontSize: 13,
        zIndex: 65 + index * 8,
      });
      return;
    }

    if (section.type === 'countdown') {
      const days = Math.max(0, Math.ceil((new Date(eventInfo.date).getTime() - Date.now()) / 86400000));
      addItem({
        id: `${CANVAS_CONTENT_PREFIX}${section.id}-days`,
        type: 'text',
        label: 'Numero cuenta regresiva',
        text: String(days),
        x: textX,
        y: 42,
        w: 20,
        h: 16,
        color: section.textColor,
        backgroundOpacity: 0,
        borderWidth: 0,
        fontFamily: section.fontFamily,
        fontSize: 58,
        zIndex: 64 + index * 8,
      });
    }

    if (bodyText) {
      addItem({
        id: `${CANVAS_CONTENT_PREFIX}${section.id}-body`,
        type: 'text',
        label: `${getWebsiteSectionLabel(section.type)} texto`,
        text: bodyText,
        x: textX,
        y: section.type === 'countdown' ? 64 : 48,
        w: textW,
        h: 14,
        color: section.textColor,
        backgroundOpacity: 0,
        borderWidth: 0,
        fontFamily: section.fontFamily,
        fontSize: Math.min(section.bodySize, 18),
        zIndex: 66 + index * 8,
      });
    }

    if (section.type === 'rsvp') {
      addItem({
        id: `${CANVAS_CONTENT_PREFIX}${section.id}-button`,
        type: 'button',
        label: 'Boton RSVP',
        text: section.ctaLabel || 'Confirmar asistencia',
        x: textX + 10,
        y: 76,
        w: 25,
        h: 8,
        color: '#ffffff',
        background: section.accentColor,
        backgroundOpacity: 1,
        borderColor: '#ffffff',
        borderWidth: 1,
        radius: 18,
        fontFamily: section.fontFamily,
        fontSize: 14,
        zIndex: 72 + index * 8,
      });
    }

    if (section.layout === 'split' || section.layout === 'gallery' || section.secondaryImageUrl) {
      [
        { id: 'image', url: section.imageUrl, x: split ? 54 : 8, y: split ? 14 : 64, w: split ? 38 : 38, h: split ? 64 : 28 },
        { id: 'secondary-image', url: section.secondaryImageUrl, x: split ? 54 : 52, y: split ? 14 : 64, w: 38, h: split ? 64 : 28 },
      ].forEach((image, imageIndex) => {
        if (imageIndex > 0 && section.layout !== 'gallery' && !section.secondaryImageUrl) return;
        addItem({
          id: `${CANVAS_CONTENT_PREFIX}${section.id}-${image.id}`,
          type: 'image',
          label: imageIndex === 0 ? 'Imagen principal' : 'Imagen secundaria',
          imageUrl: image.url,
          x: image.x,
          y: image.y,
          w: image.w,
          h: image.h,
          background: '#ffffff',
          backgroundOpacity: 0.18,
          borderColor: '#ffffff',
          borderWidth: 1,
          radius: 22,
          zIndex: 58 + index * 8 + imageIndex,
        });
      });
    }
  });

  return items;
}

function getChecklistStatusLabel(status: ChecklistStatus) {
  if (status === 'done') return 'Listo';
  if (status === 'in_progress') return 'En curso';
  return 'Pendiente';
}

function getProviderStatusLabel(status: ProviderStatus) {
  if (status === 'active') return 'Activo';
  return 'Oculto';
}

function getRsvpSummary(guests: Guest[]) {
  return {
    confirmed: guests.filter((guest) => guest.status === 'confirmed' || guest.status === 'present').length,
    pending: guests.filter((guest) => guest.status === 'pending').length,
  };
}

function normalizeGuest(raw: Partial<Guest>, index: number): Guest {
  const name = String(raw.name || `Invitado ${index + 1}`).trim();
  const companionsData = normalizeCompanionsData(raw);
  const seatIndex = normalizeSeatIndex(raw.seatIndex);
  return {
    id: String(raw.id || nextId('guest')),
    name,
    status: normalizeImportedGuestStatus(raw.status),
    gender: normalizeGuestGender(raw.gender),
    food: String(raw.food || 'Sin restriccion').trim() || 'Sin restriccion',
    age: normalizeGuestAge(raw.age),
    ageGroup: normalizeGuestAgeGroup(raw.ageGroup),
    companions: companionsData.length,
    companionsData,
    table: String(raw.table || 'Sin mesa').trim() || 'Sin mesa',
    tableId: String(raw.tableId || '').trim() || undefined,
    seatIndex,
    phone: String(raw.phone || '-').trim() || '-',
    email: String(raw.email || '').trim() || undefined,
    inviteCode: String(raw.inviteCode || createInviteCode(name)).trim(),
    note: String(raw.note || '').trim() || undefined,
    side: raw.side === 'right' ? 'right' : 'left',
    registrationSource: normalizeRegistrationSource(raw.registrationSource),
    reviewStatus: normalizeReviewStatus(raw.reviewStatus),
    reviewedAt: raw.reviewedAt || null,
    reviewedByUserId: raw.reviewedByUserId || null,
    rejectionReason: String(raw.rejectionReason || '').trim() || undefined,
  };
}

function buildDefaultWorkspaceState(): WorkspaceState {
  const guestSeeds: Partial<Guest>[] = [
    {
      id: 'guest-1',
      name: 'Camila Torres',
      status: 'confirmed',
      gender: 'female',
      food: 'Vegetariana',
      companions: 2,
      table: 'Mesa 1',
      phone: '+5491155550001',
      email: 'camila@example.com',
      inviteCode: 'camila-torres-a1',
      side: 'left' as const,
    },
    {
      id: 'guest-2',
      name: 'Lucas Rivas',
      status: 'pending',
      gender: 'male',
      food: 'Sin TACC',
      companions: 1,
      table: 'Mesa 2',
      phone: '+5491155550002',
      email: 'lucas@example.com',
      inviteCode: 'lucas-rivas-b2',
      side: 'right' as const,
    },
    {
      id: 'guest-3',
      name: 'Martina Lopez',
      status: 'present',
      gender: 'female',
      food: 'Sin restriccion',
      companions: 0,
      table: 'Mesa 1',
      phone: '+5491155550003',
      email: 'martina@example.com',
      inviteCode: 'martina-lopez-c3',
      side: 'left' as const,
    },
    {
      id: 'guest-4',
      name: 'Sofia Mendez',
      status: 'absent',
      gender: 'female',
      food: 'Vegana',
      companions: 3,
      table: 'Mesa 3',
      phone: '+5491155550004',
      email: 'sofia@example.com',
      inviteCode: 'sofia-mendez-d4',
      side: 'right' as const,
    },
  ];

  const guests = guestSeeds.map((guest, index) => normalizeGuest(guest, index));

  const rsvpSummary = getRsvpSummary(guests);

  return {
    eventInfo: {
      name: '15 Años de Camila',
      type: '15 años',
      date: '2026-07-24',
      venue: 'Salon Las Rosas',
    },
    guests,
    checklist: [
      { id: 'task-1', task: 'Confirmar salon', status: 'done', owner: 'Organizador' },
      { id: 'task-2', task: 'Cargar lista inicial', status: 'in_progress', owner: 'Organizador' },
      { id: 'task-3', task: 'Asignar mesas', status: 'pending', owner: 'Organizador' },
      { id: 'task-4', task: 'Enviar invitacion digital', status: 'pending', owner: 'Organizador' },
      { id: 'task-5', task: 'Definir personal de puerta', status: 'pending', owner: 'Master / Organizador' },
      { id: 'task-6', task: 'Revisar restricciones alimentarias', status: 'pending', owner: 'Catering' },
    ],
    itinerary: [
      { id: 'it-1', time: '18:30', activity: 'Apertura de puertas', place: 'Recepcion', owner: 'Equipo de puerta' },
      { id: 'it-2', time: '19:00', activity: 'Recepcion de invitados', place: 'Recepcion', owner: 'Organizador' },
      { id: 'it-3', time: '20:30', activity: 'Cena principal', place: 'Salon', owner: 'Catering' },
      { id: 'it-4', time: '22:00', activity: 'Brindis y palabras', place: 'Escenario', owner: 'Familia' },
      { id: 'it-5', time: '22:30', activity: 'Baile / DJ', place: 'Pista', owner: 'DJ' },
      { id: 'it-6', time: '00:00', activity: 'Mesa dulce', place: 'Salon', owner: 'Catering' },
    ],
    providers: [
      { id: 'provider-1', name: 'Salon Las Rosas', category: 'Lugar', status: 'active', phone: '+5491155550010' },
      { id: 'provider-2', name: 'DJ Nova', category: 'Musica', status: 'active', phone: '+5491155550011' },
      { id: 'provider-3', name: 'Foto Luz', category: 'Fotografia', status: 'active', phone: '+5491155550012' },
      { id: 'provider-4', name: 'Catering Sur', category: 'Catering', status: 'active', phone: '+5491155550013' },
    ],
    layout: [
      { id: 'entrance-1', type: 'entrance', label: 'Entrada', x: 24, y: 28, w: 124, h: 54 },
      { id: 'stage-1', type: 'stage', label: 'Escenario', x: 550, y: 24, w: 185, h: 64 },
      { id: 'dance-1', type: 'danceFloor', label: 'Pista', x: 285, y: 230, w: 165, h: 165 },
      { id: 'round-1', type: 'roundTable', label: 'Mesa 1', x: 88, y: 142, w: 96, h: 96, seats: 8 },
      { id: 'round-2', type: 'roundTable', label: 'Mesa 2', x: 215, y: 142, w: 96, h: 96, seats: 8 },
      { id: 'vip-1', type: 'vipTable', label: 'Mesa honor', x: 334, y: 90, w: 110, h: 110, seats: 6 },
      { id: 'square-1', type: 'squareTable', label: 'Mesa 3', x: 490, y: 150, w: 112, h: 96, seats: 10 },
      { id: 'rect-1', type: 'rectTable', label: 'Mesa buffet', x: 575, y: 330, w: 160, h: 76, seats: 12 },
      { id: 'bar-1', type: 'bar', label: 'Barra', x: 46, y: 430, w: 145, h: 56 },
    ],
    webSections: [
      normalizeWebSection({ id: 'hero', type: 'hero', visible: true, title: 'Te esperamos para celebrar', content: '24 de julio de 2026 · Salon Las Rosas · 19:00 hs', layout: 'cover', align: 'center' }, 0),
      normalizeWebSection({ id: 'countdown', type: 'countdown', visible: true, title: 'Cuenta regresiva', content: 'Falta muy poco para encontrarnos y abrir la pista juntos.', layout: 'cover', align: 'center' }, 1),
      normalizeWebSection({ id: 'details', type: 'details', visible: true, title: 'Detalles del evento', content: 'Dress code formal · Estacionamiento disponible · Confirmar antes del 30/06', layout: 'split', align: 'left' }, 2),
      normalizeWebSection({ id: 'rsvp', type: 'rsvp', visible: true, title: 'Confirmar asistencia', content: 'Confirma tu asistencia y acompananos en una noche unica.', layout: 'split', align: 'center' }, 3),
      normalizeWebSection({ id: 'map', type: 'map', visible: true, title: 'Como llegar', content: 'Av. Callao 1234, Buenos Aires', layout: 'gallery', align: 'left' }, 4),
      normalizeWebSection({ id: 'message', type: 'message', visible: false, title: 'Mensaje especial', content: 'Tu presencia es el mejor regalo. Gracias por acompanarnos.', layout: 'gallery', align: 'center' }, 5),
      normalizeWebSection({ id: 'seating-map', type: 'seatingMap', visible: false, title: 'Plano del sitio', content: 'Activalo si queres mostrar la distribucion de mesas y sectores dentro del evento.', layout: 'gallery', align: 'left' }, 6),
    ],
    canvasItems: buildDefaultCanvasItems(),
    websiteBackgroundUrl: WEBSITE_BACKGROUND_PRESETS[0].url,
    rsvpConfirmed: rsvpSummary.confirmed,
    rsvpPending: rsvpSummary.pending,
  };
}

function normalizeWorkspaceState(raw: unknown): WorkspaceState {
  const source = raw && typeof raw === 'object' ? (raw as Partial<WorkspaceState>) : {};
  const fallback = buildDefaultWorkspaceState();
  const guests = Array.isArray(source.guests)
    ? source.guests.map((guest: Partial<Guest>, index: number) => normalizeGuest(guest, index))
    : fallback.guests;
  const rsvpSummary = getRsvpSummary(guests);

  return {
    eventInfo: {
      ...fallback.eventInfo,
      ...(source.eventInfo || {}),
    },
    guests,
    checklist: Array.isArray(source.checklist) ? source.checklist : fallback.checklist,
    itinerary: Array.isArray(source.itinerary) ? source.itinerary : fallback.itinerary,
    providers: Array.isArray(source.providers) ? source.providers : fallback.providers,
    layout: Array.isArray(source.layout) ? source.layout : fallback.layout,
    webSections: Array.isArray(source.webSections)
      ? source.webSections.map((section: Partial<WebSection>, index: number) =>
          normalizeWebSection(
            {
              ...fallback.webSections[index],
              ...section,
            },
            index,
          ),
        )
      : fallback.webSections,
    canvasItems: Array.isArray(source.canvasItems)
      ? source.canvasItems
          .filter((item: Partial<CanvasItem>) => {
            const id = String(item?.id || '');
            return id !== 'canvas-title' && id !== 'canvas-rsvp' && !id.startsWith(LEGACY_CANVAS_CONTENT_PREFIX);
          })
          .map((item: Partial<CanvasItem>, index: number) => normalizeCanvasItem(item, index))
      : fallback.canvasItems,
    websiteBackgroundUrl: String(source.websiteBackgroundUrl || '').trim() || fallback.websiteBackgroundUrl,
    rsvpConfirmed: Number.isFinite(Number(source.rsvpConfirmed)) ? Number(source.rsvpConfirmed) : rsvpSummary.confirmed,
    rsvpPending: Number.isFinite(Number(source.rsvpPending)) ? Number(source.rsvpPending) : rsvpSummary.pending,
  };
}

function loadWorkspaceState(workspaceId?: string | null): WorkspaceState {
  try {
    const scopedRaw = localStorage.getItem(getWorkspaceStorageKey(workspaceId));
    const legacyRaw = localStorage.getItem(STORAGE_KEY);
    const raw = scopedRaw || legacyRaw;
    if (raw) {
      return normalizeWorkspaceState(JSON.parse(raw));
    }
  } catch {
    // ignore bad persisted state
  }

  return buildDefaultWorkspaceState();
}

function stripEmbeddedStorageAssets(state: WorkspaceState): WorkspaceState {
  const stripLargeUrl = (value?: string) => {
    const next = String(value || '');
    return next.startsWith('data:') ? '' : next;
  };

  return {
    ...state,
    websiteBackgroundUrl: stripLargeUrl(state.websiteBackgroundUrl),
    webSections: state.webSections.map((section) => ({
      ...section,
      imageUrl: stripLargeUrl(section.imageUrl),
      secondaryImageUrl: stripLargeUrl(section.secondaryImageUrl),
    })),
    canvasItems: state.canvasItems.map((item) => ({
      ...item,
      imageUrl: stripLargeUrl(item.imageUrl),
    })),
  };
}

function safeSetWorkspaceState(workspaceId: string | undefined | null, state: WorkspaceState) {
  if (typeof window === 'undefined') return;

  const scopedKey = getWorkspaceStorageKey(workspaceId);
  const serialized = JSON.stringify(state);

  try {
    localStorage.setItem(scopedKey, serialized);
    if (!workspaceId) localStorage.setItem(STORAGE_KEY, serialized);
    return;
  } catch (error) {
    console.warn('Workspace storage quota exceeded. Retrying without embedded images.', error);
  }

  const lightState = stripEmbeddedStorageAssets(state);
  const lightSerialized = JSON.stringify(lightState);

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(scopedKey, lightSerialized);
  } catch (error) {
    console.error('No se pudo guardar el workspace localmente.', error);
    toast('El navegador no tiene espacio para guardar mas cambios locales. La invitacion sigue abierta, pero libera espacio o quita imagenes pesadas.', 'warning');
  }
}

function isTableLayoutElement(item: LayoutElement) {
  return item.type === 'roundTable' || item.type === 'squareTable' || item.type === 'rectTable' || item.type === 'vipTable';
}

function getGuestPartySize(guest: Guest) {
  return 1 + Math.max(0, Number(guest.companionsData?.length || guest.companions || 0));
}

function getGuestSeatOccupants(guest: Guest): SeatOccupant[] {
  return [
    {
      id: `guest:${guest.id}`,
      guestId: guest.id,
      name: guest.name,
      tableId: guest.tableId,
      tableLabel: guest.table && guest.table !== 'Sin mesa' ? guest.table : undefined,
      seatIndex: guest.seatIndex,
      kind: 'guest',
    },
    ...(guest.companionsData || []).map((companion) => ({
      id: `companion:${guest.id}:${companion.id}`,
      guestId: guest.id,
      companionId: companion.id,
      name: companion.name,
      tableId: companion.tableId,
      tableLabel: companion.tableId ? undefined : guest.table && guest.table !== 'Sin mesa' ? guest.table : undefined,
      seatIndex: companion.seatIndex,
      kind: 'companion' as const,
    })),
  ];
}

function getSeatOccupants(guests: Guest[]): SeatOccupant[] {
  return guests.flatMap(getGuestSeatOccupants);
}

function getVisualSeatOccupants(layout: LayoutElement[], guests: Guest[]): SeatOccupant[] {
  const allOccupants = getSeatOccupants(guests);
  const visualOccupants: SeatOccupant[] = [];

  layout.filter(isTableLayoutElement).forEach((table) => {
    const seatCount = Math.max(0, Number(table.seats || 0));
    const usedSeats = new Set<number>();
    const exactOccupants = allOccupants.filter(
      (occupant) => occupant.tableId === table.id && occupant.seatIndex !== null && occupant.seatIndex !== undefined,
    );

    exactOccupants.forEach((occupant) => {
      const seatIndex = Number(occupant.seatIndex);
      usedSeats.add(seatIndex);
      visualOccupants.push(occupant);
    });

    const legacyOccupants = allOccupants.filter(
      (occupant) =>
        !(occupant.tableId && occupant.seatIndex !== null && occupant.seatIndex !== undefined) &&
        occupant.tableLabel === table.label,
    );

    legacyOccupants.forEach((occupant) => {
      const nextSeat = Array.from({ length: seatCount }).findIndex((_, index) => !usedSeats.has(index));
      if (nextSeat < 0) {
        visualOccupants.push({ ...occupant, tableId: table.id, seatIndex: null, virtualSeat: true });
        return;
      }
      usedSeats.add(nextSeat);
      visualOccupants.push({ ...occupant, tableId: table.id, seatIndex: nextSeat, virtualSeat: true });
    });
  });

  return visualOccupants;
}

function getSeatLocationLabel(layout: LayoutElement[], tableId?: string, seatIndex?: number | null, fallbackTable?: string) {
  if (tableId && seatIndex !== null && seatIndex !== undefined) {
    const table = layout.find((item) => item.id === tableId);
    return `${table?.label || fallbackTable || 'Mesa'} / asiento ${Number(seatIndex) + 1}`;
  }
  if (fallbackTable && fallbackTable !== 'Sin mesa') return fallbackTable;
  return 'Sin asiento';
}

function getTableSummaries(layout: LayoutElement[], guests: Guest[]) {
  const occupants = getSeatOccupants(guests);
  const layoutTables = layout.filter(isTableLayoutElement).map((item) => ({
    id: item.id,
    label: item.label,
    seats: Number(item.seats || 0),
  }));
  const missingGuestTables = Array.from(
    new Set(
      guests
        .map((guest) => guest.table)
        .filter((label) => label && !layoutTables.some((table) => table.label === label)),
    ),
  ).map((label, index) => ({
    id: `guest-table-${index}`,
    label,
    seats: 0,
  }));

  return [...layoutTables, ...missingGuestTables].map((table) => {
    const assignedGuests = guests.filter((guest) => guest.tableId === table.id || (!guest.tableId && guest.table === table.label));
    const tableOccupants = occupants.filter(
      (occupant) =>
        occupant.tableId === table.id ||
        (!occupant.tableId && occupant.tableLabel === table.label),
    );
    const assignedSeats = tableOccupants.length;
    return {
      ...table,
      assignedGuests,
      occupants: tableOccupants,
      assignedSeats,
      freeSeats: Math.max(0, table.seats - assignedSeats),
      overflow: table.seats > 0 ? assignedSeats > table.seats : false,
    };
  });
}

function getSeatOccupant(guests: Guest[], table: LayoutElement, seatIndex: number) {
  return getVisualSeatOccupants([table], guests).find((occupant) => occupant.tableId === table.id && occupant.seatIndex === seatIndex) || null;
}

function getSeatDots(item: LayoutElement) {
  if (!(item.type === 'roundTable' || item.type === 'squareTable' || item.type === 'rectTable' || item.type === 'vipTable') || !item.seats) {
    return [] as Array<{ left: number; top: number; labelSide: 'top' | 'right' | 'bottom' | 'left' }>;
  }

  const count = Math.min(item.seats, 14);

  if (item.type === 'roundTable' || item.type === 'vipTable') {
    const centerX = item.w / 2;
    const centerY = item.h / 2;
    const radius = Math.min(item.w, item.h) / 2 + 12;
    return Array.from({ length: count }).map((_, index) => {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const labelSide = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
        ? Math.cos(angle) > 0 ? 'right' : 'left'
        : Math.sin(angle) > 0 ? 'bottom' : 'top';
      return {
        left: centerX + Math.cos(angle) * radius,
        top: centerY + Math.sin(angle) * radius,
        labelSide,
      };
    });
  }

  const perimeter: Array<{ left: number; top: number; labelSide: 'top' | 'right' | 'bottom' | 'left' }> = [];
  const topCount = Math.ceil(count / 4);
  const rightCount = Math.ceil((count - topCount) / 3);
  const bottomCount = Math.ceil((count - topCount - rightCount) / 2);
  const leftCount = Math.max(0, count - topCount - rightCount - bottomCount);

  const pushSide = (sideCount: number, position: 'top' | 'right' | 'bottom' | 'left') => {
    for (let index = 0; index < sideCount; index += 1) {
      const ratio = (index + 1) / (sideCount + 1);
      if (position === 'top') perimeter.push({ left: ratio * item.w, top: -12, labelSide: 'top' });
      if (position === 'bottom') perimeter.push({ left: ratio * item.w, top: item.h + 12, labelSide: 'bottom' });
      if (position === 'left') perimeter.push({ left: -12, top: ratio * item.h, labelSide: 'left' });
      if (position === 'right') perimeter.push({ left: item.w + 12, top: ratio * item.h, labelSide: 'right' });
    }
  };

  pushSide(topCount, 'top');
  pushSide(rightCount, 'right');
  pushSide(bottomCount, 'bottom');
  pushSide(leftCount, 'left');

  return perimeter;
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === 'Listo' || value === 'Confirmado' || value === 'Presente'
      ? 'border-emerald-400/30 bg-emerald-400/12 text-emerald-100'
      : value === 'En curso' || value === 'Cotizando' || value === 'Pendiente'
        ? 'border-amber-400/30 bg-amber-400/12 text-amber-100'
        : 'border-pink-400/30 bg-pink-400/12 text-pink-100';

  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{value}</span>;
}

function SectionHeader({
  title,
  text,
  badge,
}: {
  title: string;
  text: string;
  badge?: string;
}) {
  return (
    <div className="mb-8 text-center">
      {badge ? (
        <span className="inline-flex rounded-full border border-pink-400/20 bg-pink-400/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-pink-200/80">
          {badge}
        </span>
      ) : null}
      <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-pink-100/68">{text}</p>
    </div>
  );
}

function Sidebar({
  active,
  setActive,
  eventName,
  menuGroups,
}: {
  active: ModuleKey;
  setActive: (key: ModuleKey) => void;
  eventName: string;
  menuGroups: WorkspaceMenuGroup[];
}) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[280px] border-r border-pink-300/10 bg-[#150714]/95 px-5 py-6 backdrop-blur xl:block">
      <Link to="/" className="mb-8 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#f97316)] shadow-[0_0_32px_rgba(251,113,133,.35)]">
          <i className="fas fa-calendar-days text-white"></i>
        </span>
        <div>
          <span className="block text-xs font-black uppercase tracking-[0.28em] text-pink-200/65">RifaTicket</span>
          <span className="text-lg font-black text-white">Event OS</span>
        </div>
      </Link>

      <div className="mb-6 rounded-[24px] border border-pink-300/14 bg-white/[0.035] p-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-pink-100/42">Evento activo</p>
        <p className="mt-2 text-lg font-black text-white">{eventName}</p>
        <p className="mt-1 text-sm text-pink-100/58">Panel operativo centralizado</p>
      </div>

      <nav className="space-y-6 text-sm">
        {menuGroups.map((group, index) => (
          <div key={group.title || index}>
            {group.title ? <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-pink-100/38">{group.title}</p> : null}
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActive(item.key)}
                  className={`flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left transition ${
                    active === item.key
                      ? 'bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] font-black text-white shadow-[0_18px_32px_rgba(139,92,246,.18)]'
                      : 'text-pink-100/74 hover:bg-white/[0.04]'
                  }`}
                >
                  <i className={`fas ${item.icon} w-4 text-center`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="absolute bottom-6 left-5 right-5 rounded-[24px] border border-pink-300/12 bg-[radial-gradient(circle_at_top,rgba(251,113,133,.18),transparent_40%),rgba(255,255,255,.04)] p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-400/14 text-pink-200">
            <i className="fas fa-route" />
          </span>
          <div>
            <p className="font-black text-white">Flujo guiado</p>
            <p className="mt-1 text-xs leading-5 text-pink-100/58">
              Usa Inicio para ver prioridades, luego completa Invitados, Web, Plano y Cronograma.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  activeLabel,
  onOpenGuide,
  onLogout,
}: {
  activeLabel: string;
  onOpenGuide: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-pink-300/10 bg-[#100311]/86 backdrop-blur xl:ml-[280px]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 text-white xl:px-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-100/42">Modulo activo</p>
          <p className="text-sm font-black">{activeLabel}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenGuide}
            className="rounded-[14px] border border-pink-300/18 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-pink-50"
          >
            Como se usa
          </button>
          <Link
            to="/"
            className="rounded-[14px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-2.5 text-sm font-black text-white"
          >
            Ver home
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-[14px] border border-pink-300/20 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-pink-50"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 px-4 py-8 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.98 }}
            className="mx-auto max-w-3xl rounded-[32px] border border-pink-300/14 bg-[#140714] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,.45)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-pink-100/46">Guia rapida</p>
                <h2 className="mt-2 text-3xl font-black">Flujo recomendado para dejar el evento listo</h2>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-pink-300/16 px-3 py-1.5 text-sm">
                Cerrar
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                '1. Configura nombre, fecha y venue en Configuracion.',
                '2. Carga o importa la lista de invitados y estados RSVP.',
                '3. Define la invitacion digital con vista desktop y vertical.',
                '4. Diseña el plano con mesas, sillas visibles y presets rápidos.',
                '5. Ordena cronograma para equipo, puerta y proveedores.',
                '6. Usa Control de entrada para validar presentes el dia del evento.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-pink-300/12 bg-white/[0.04] p-4 text-sm leading-6 text-pink-50/90">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function OverviewPanel({
  eventInfo,
  guests,
  itinerary,
  providers,
  onJump,
}: {
  eventInfo: EventInfo;
  guests: Guest[];
  itinerary: ItineraryItem[];
  providers: Provider[];
  onJump: (key: ModuleKey) => void;
}) {
  const confirmed = guests.filter((guest) => guest.status === 'confirmed' || guest.status === 'present').length;
  const present = guests.filter((guest) => guest.status === 'present').length;
  const pendingGuests = guests.filter((guest) => guest.status === 'pending').length;
  const plannerNodes: Array<{
    id: string;
    title: string;
    text: string;
    key: ModuleKey;
    badge: string;
    className: string;
  }> = [
    {
      id: 'node-brief',
      title: 'Base del evento',
      text: `${eventInfo.date || 'Definí fecha'} · ${eventInfo.venue || 'Venue pendiente'}`,
      key: 'settings',
      badge: 'Brief',
      className: 'left-[4%] top-[10%] w-[220px]',
    },
    {
      id: 'node-guests',
      title: 'Invitados y RSVP',
      text: `${guests.length} cargados · ${pendingGuests} pendientes`,
      key: 'guests',
      badge: 'Lista',
      className: 'left-[34%] top-[4%] w-[230px]',
    },
    {
      id: 'node-website',
      title: 'Sitio e invitacion',
      text: `${confirmed} respuestas listas para compartir`,
      key: 'website',
      badge: 'Web',
      className: 'right-[4%] top-[18%] w-[240px]',
    },
    {
      id: 'node-seating',
      title: 'Plano y mesas',
      text: 'Mesas, sillas visibles y sectores conectados',
      key: 'seating',
      badge: 'Plano',
      className: 'left-[16%] bottom-[12%] w-[240px]',
    },
    {
      id: 'node-checkin',
      title: 'Control final',
      text: `${present} presentes · ${providers.length} proveedores visibles`,
      key: 'checkin',
      badge: 'Puerta',
      className: 'right-[14%] bottom-[6%] w-[240px]',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl">
      <SectionHeader
        badge="Panel central"
        title="Todo el evento en un solo lugar"
        text={`Gestiona ${eventInfo.name}, corrige flujos incompletos y sigue un recorrido claro desde la carga de invitados hasta el control de acceso.`}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          [String(guests.length), 'Invitados cargados'],
          [String(confirmed), 'RSVP confirmados'],
          [String(present), 'Presentes'],
          [String(providers.length), 'Proveedores'],
        ].map(([value, label], index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-[28px] border border-pink-300/14 bg-white/[0.045] p-5"
          >
            <p className="text-4xl font-black text-white">{value}</p>
            <p className="mt-2 text-sm text-pink-100/58">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 rounded-[34px] border border-pink-300/12 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.08),transparent_36%),linear-gradient(135deg,rgba(20,7,20,.95),rgba(29,11,32,.92))] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-pink-100/42">Mapa operativo</p>
            <h2 className="mt-2 text-2xl font-black text-white">Planner visual con conexiones</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-pink-100/60">
              En lugar de una lista rígida, ves cómo se encadenan las partes clave del evento. Cada bloque te lleva directo al módulo correspondiente.
            </p>
          </div>
          <div className="rounded-full border border-pink-300/14 px-3 py-1 text-xs font-black text-pink-100/74">
            Premium flow
          </div>
        </div>

        <div className="mt-6 md:hidden">
          <div className="grid gap-3">
            {plannerNodes.map((node, index) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onJump(node.key)}
                className="rounded-[24px] border border-pink-300/12 bg-white/[0.04] p-4 text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-400/12 text-sm font-black text-pink-200">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-200/68">{node.badge}</p>
                    <p className="mt-1 font-black text-white">{node.title}</p>
                    <p className="mt-1 text-sm leading-6 text-pink-100/60">{node.text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-6 hidden h-[420px] md:block">
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 420" fill="none" preserveAspectRatio="none">
            <path d="M170 82 C 260 40, 320 42, 390 74" stroke="rgba(244,114,182,.55)" strokeWidth="2.5" strokeDasharray="6 8" />
            <path d="M555 82 C 660 78, 720 90, 815 120" stroke="rgba(168,85,247,.55)" strokeWidth="2.5" strokeDasharray="6 8" />
            <path d="M495 110 C 460 180, 400 232, 312 304" stroke="rgba(251,146,60,.48)" strokeWidth="2.5" strokeDasharray="6 8" />
            <path d="M635 156 C 690 208, 740 248, 772 310" stroke="rgba(244,114,182,.48)" strokeWidth="2.5" strokeDasharray="6 8" />
            <path d="M294 328 C 420 360, 566 362, 726 332" stroke="rgba(255,255,255,.26)" strokeWidth="2" strokeDasharray="5 10" />
          </svg>

          {plannerNodes.map((node, index) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onJump(node.key)}
              className={`absolute rounded-[28px] border border-pink-300/14 bg-[linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.04))] p-5 text-left shadow-[0_18px_40px_rgba(0,0,0,.22)] transition hover:-translate-y-1 hover:border-pink-300/28 hover:bg-white/[0.08] ${node.className}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-pink-200/68">{node.badge}</p>
                  <p className="mt-2 text-lg font-black text-white">{node.title}</p>
                  <p className="mt-2 text-sm leading-6 text-pink-100/60">{node.text}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-400/12 text-sm font-black text-pink-200">
                  {index + 1}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[30px] border border-pink-300/12 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,.18),transparent_34%),rgba(255,255,255,.04)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-pink-100/42">Flujo de trabajo</p>
              <h2 className="mt-2 text-2xl font-black text-white">Dejalo listo para entregar</h2>
            </div>
            <div className="rounded-full border border-pink-300/14 px-3 py-1 text-xs font-black text-pink-100/74">
              UX guiada
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ['Invitados', 'Importa, filtra y corrige estados RSVP.', 'guests'],
              ['Invitacion', 'Edita bloques, presets y preview real.', 'website'],
              ['Plano', 'Usa layouts rapidos, resize y sillas visibles.', 'seating'],
              ['Cronograma', 'Ordena responsables y horario del evento.', 'itinerary'],
            ].map(([title, text, key], index) => (
              <button
                key={title}
                type="button"
                onClick={() => onJump(key as ModuleKey)}
                className="group rounded-[24px] border border-pink-300/10 bg-black/15 p-4 text-left transition hover:border-pink-300/22 hover:bg-black/22"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-400/12 text-sm font-black text-pink-200">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-black text-white">{title}</p>
                      <span className="text-pink-200 transition group-hover:translate-x-1">→</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-pink-100/60">{text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-pink-300/12 bg-white/[0.04] p-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-100/42">Resumen operativo</p>
          <h2 className="mt-2 text-2xl font-black text-white">Lo proximo que deberias resolver</h2>
          <div className="mt-5 space-y-3">
            {[
              `${providers.length} proveedores cargados para consultar`,
              `${itinerary.length} bloques cargados en el cronograma`,
              `${guests.filter((guest) => guest.status === 'pending').length} invitados aun no respondieron`,
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-pink-300/10 bg-black/15 p-4 text-sm text-pink-50/88">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GuestsPanel({
  workspaceId,
  eventInfo,
  layout,
  guests,
  setGuests,
  onJump,
}: {
  workspaceId?: string | null;
  eventInfo: EventInfo;
  layout: LayoutElement[];
  guests: Guest[];
  setGuests: Dispatch<SetStateAction<Guest[]>>;
  onJump?: (key: ModuleKey) => void;
}) {
  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | GuestGender>('all');
  const [foodFilter, setFoodFilter] = useState<'all' | 'special' | 'none'>('all');
  const [sideFilter, setSideFilter] = useState<'all' | Guest['side']>('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState<'all' | 'with_link' | 'without_link'>('all');
  const [placementFilter, setPlacementFilter] = useState<'all' | 'assigned' | 'unassigned' | 'with_companions' | 'without_companions'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | GuestStatus>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | GuestReviewStatus>('all');
  const [viewMode, setViewMode] = useState<'list' | 'alphabetic' | 'tables'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'table' | 'created'>('name');
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkTable, setBulkTable] = useState('');
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [seatModalPersonId, setSeatModalPersonId] = useState('guest');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const invitationUrl = useMemo(() => getInvitationUrl(workspaceId), [workspaceId]);
  const invitationLabel = useMemo(() => {
    if (typeof window === 'undefined') return invitationUrl;
    return invitationUrl.replace(window.location.origin, '');
  }, [invitationUrl]);
  const tableSummaries = useMemo(() => getTableSummaries(layout, guests), [guests, layout]);
  const tableOptions = useMemo(() => tableSummaries.map((tableItem) => tableItem.label), [tableSummaries]);
  const createDraft = useCallback(
    () => ({
      name: '',
      email: '',
      phone: '',
      status: 'pending' as GuestStatus,
      gender: 'female' as GuestGender,
      food: 'Sin restriccion',
      age: '' as number | '',
      ageGroup: 'adult' as GuestAgeGroup,
      companions: 0,
      companionsData: [] as GuestCompanion[],
      table: tableOptions[0] || 'Sin mesa',
      tableId: undefined as string | undefined,
      seatIndex: null as number | null,
      side: 'left' as Guest['side'],
      note: '',
      reviewStatus: 'approved' as GuestReviewStatus,
      registrationSource: 'manual' as GuestRegistrationSource,
    }),
    [tableOptions],
  );
  const [draft, setDraft] = useState(createDraft);
  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = guests.filter((guest) => {
      if (statusFilter !== 'all' && guest.status !== statusFilter) return false;
      if (reviewFilter !== 'all' && guest.reviewStatus !== reviewFilter) return false;
      if (genderFilter !== 'all' && guest.gender !== genderFilter) return false;
      if (foodFilter === 'special' && guest.food.toLowerCase() === 'sin restriccion') return false;
      if (foodFilter === 'none' && guest.food.toLowerCase() !== 'sin restriccion') return false;
      if (sideFilter !== 'all' && guest.side !== sideFilter) return false;
      if (tableFilter !== 'all' && guest.table !== tableFilter) return false;
      if (linkFilter === 'with_link' && !guest.inviteCode) return false;
      if (linkFilter === 'without_link' && guest.inviteCode) return false;
      if (placementFilter === 'assigned' && guest.table === 'Sin mesa') return false;
      if (placementFilter === 'unassigned' && guest.table !== 'Sin mesa') return false;
      if (placementFilter === 'with_companions' && guest.companions <= 0) return false;
      if (placementFilter === 'without_companions' && guest.companions > 0) return false;
      if (!normalized) return true;
      return [
        guest.name,
        guest.email,
        guest.phone,
        guest.table,
        guest.food,
        getGuestAgeGroupLabel(guest.ageGroup),
        guest.companionsData.map((item) => `${item.name} ${item.food} ${getGuestAgeGroupLabel(item.ageGroup)}`).join(' '),
        String(guest.companions),
        getGuestStatusLabel(guest.status),
        getGuestGenderLabel(guest.gender),
        getReviewStatusLabel(guest.reviewStatus),
        getSideLabel(guest.side),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });

    if (sortBy === 'created') return base;

    const statusRank: Record<GuestStatus, number> = {
      pending: 0,
      confirmed: 1,
      present: 2,
      absent: 3,
    };

    return [...base].sort((a, b) => {
      if (sortBy === 'status') {
        const diff = statusRank[a.status] - statusRank[b.status];
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es');
      }
      if (sortBy === 'table') {
        const diff = a.table.localeCompare(b.table, 'es');
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es');
      }
      return a.name.localeCompare(b.name, 'es');
    });
  }, [foodFilter, genderFilter, guests, linkFilter, placementFilter, query, reviewFilter, sideFilter, sortBy, statusFilter, tableFilter]);
  const rsvpSummary = useMemo(() => getRsvpSummary(guests), [guests]);
  const specialMeals = useMemo(
    () => guests.filter((guest) => guest.food && guest.food.toLowerCase() !== 'sin restriccion').length,
    [guests],
  );
  const absentGuests = useMemo(() => guests.filter((guest) => guest.status === 'absent').length, [guests]);
  const totalCompanions = useMemo(() => guests.reduce((acc, guest) => acc + Number(guest.companionsData?.length || guest.companions || 0), 0), [guests]);
  const pendingReviewGuests = useMemo(() => guests.filter((guest) => guest.reviewStatus === 'pending_review').length, [guests]);
  const selectedGuest = useMemo(() => guests.find((guest) => guest.id === selectedGuestId) || null, [guests, selectedGuestId]);
  const selectedGuests = useMemo(() => guests.filter((guest) => selectedGuestIds.includes(guest.id)), [guests, selectedGuestIds]);
  const occupiedSeats = useMemo(() => tableSummaries.reduce((acc, tableItem) => acc + tableItem.assignedSeats, 0), [tableSummaries]);
  const totalSeats = useMemo(() => tableSummaries.reduce((acc, tableItem) => acc + Math.max(0, Number(tableItem.seats || 0)), 0), [tableSummaries]);
  const freeSeats = Math.max(0, totalSeats - occupiedSeats);
  const overflowTables = useMemo(() => tableSummaries.filter((tableItem) => tableItem.overflow).length, [tableSummaries]);
  const invitationsReady = useMemo(() => guests.filter((guest) => guest.inviteCode).length, [guests]);
  const activeFilterCount = [
    statusFilter !== 'all',
    reviewFilter !== 'all',
    genderFilter !== 'all',
    foodFilter !== 'all',
    sideFilter !== 'all',
    tableFilter !== 'all',
    linkFilter !== 'all',
    placementFilter !== 'all',
    query.trim().length > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    setSelectedGuestIds((prev) => prev.filter((id) => guests.some((guest) => guest.id === id)));
  }, [guests]);

  useEffect(() => {
    if (!selectedGuestId) return;
    if (!guests.some((guest) => guest.id === selectedGuestId)) {
      setSelectedGuestId('');
      if (drawerMode === 'edit') setDrawerMode(null);
    }
  }, [drawerMode, guests, selectedGuestId]);

  useEffect(() => {
    if (!tableOptions.length) return;
    setDraft((current) => {
      if (drawerMode === 'edit') return current;
      if (tableOptions.includes(current.table)) return current;
      return { ...current, table: tableOptions[0] };
    });
    if (bulkTable && !tableOptions.includes(bulkTable)) {
      setBulkTable('');
    }
  }, [bulkTable, drawerMode, tableOptions]);

  const guestsAlphabetic = useMemo(() => {
    const groups = new Map<string, Guest[]>();
    for (const guest of filteredGuests) {
      const key = (guest.name.trim().charAt(0) || '#').toUpperCase();
      groups.set(key, [...(groups.get(key) || []), guest]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredGuests]);

  const visibleTableSummaries = useMemo(
    () =>
      tableSummaries
        .map((tableItem) => ({
          ...tableItem,
          filteredGuests: filteredGuests.filter((guest) => guest.table === tableItem.label),
        }))
        .filter((tableItem) => tableItem.filteredGuests.length > 0 || tableItem.seats > 0),
    [filteredGuests, tableSummaries],
  );
  const draftSeatPeople = useMemo(
    () => [
      {
        id: 'guest',
        name: draft.name.trim() || 'Titular',
        kind: 'guest' as const,
        tableId: draft.tableId,
        seatIndex: draft.seatIndex,
      },
      ...draft.companionsData.map((companion, index) => ({
        id: `companion:${companion.id}`,
        companionId: companion.id,
        name: companion.name.trim() || `Acompañante ${index + 1}`,
        kind: 'companion' as const,
        tableId: companion.tableId,
        seatIndex: companion.seatIndex,
      })),
    ],
    [draft.companionsData, draft.name, draft.seatIndex, draft.tableId],
  );
  const selectedDraftSeatPerson = useMemo(
    () => draftSeatPeople.find((person) => person.id === seatModalPersonId) || draftSeatPeople[0],
    [draftSeatPeople, seatModalPersonId],
  );
  const externalSeatOccupants = useMemo(() => {
    const excludedGuestId = drawerMode === 'edit' ? selectedGuestId : '';
    return getSeatOccupants(guests).filter((occupant) => occupant.guestId !== excludedGuestId);
  }, [drawerMode, guests, selectedGuestId]);

  const getDraftSeatLocation = (person: { tableId?: string; seatIndex?: number | null }) =>
    getSeatLocationLabel(layout, person.tableId, person.seatIndex);

  const getDraftSeatOccupant = (tableId: string, seatIndex: number) =>
    draftSeatPeople.find((person) => person.tableId === tableId && person.seatIndex === seatIndex) || null;

  const getExternalSeatOccupant = (tableId: string, seatIndex: number) =>
    externalSeatOccupants.find((occupant) => occupant.tableId === tableId && occupant.seatIndex === seatIndex) || null;

  const clearDraftSeatPerson = (personId: string) => {
    setDraft((current) => {
      if (personId === 'guest') {
        return { ...current, table: 'Sin mesa', tableId: undefined, seatIndex: null };
      }

      const companionId = personId.replace('companion:', '');
      return {
        ...current,
        companionsData: current.companionsData.map((companion) =>
          companion.id === companionId ? { ...companion, tableId: undefined, seatIndex: null } : companion,
        ),
      };
    });
  };

  const assignDraftSeatPerson = (personId: string, table: LayoutElement, seatIndex: number) => {
    const externalOccupant = getExternalSeatOccupant(table.id, seatIndex);
    if (externalOccupant) {
      toast(`Ese asiento ya lo ocupa ${externalOccupant.name}`, 'warning');
      return;
    }

    setDraft((current) => {
      const clearSameSeatCompanions = current.companionsData.map((companion) => {
        const sameSeat = companion.tableId === table.id && companion.seatIndex === seatIndex;
        if (!sameSeat) return companion;
        return { ...companion, tableId: undefined, seatIndex: null };
      });

      if (personId === 'guest') {
        return {
          ...current,
          table: table.label,
          tableId: table.id,
          seatIndex,
          companionsData: clearSameSeatCompanions,
        };
      }

      const companionId = personId.replace('companion:', '');
      const guestWasInTargetSeat = current.tableId === table.id && current.seatIndex === seatIndex;
      return {
        ...current,
        table: guestWasInTargetSeat ? 'Sin mesa' : current.table,
        tableId: guestWasInTargetSeat ? undefined : current.tableId,
        seatIndex: guestWasInTargetSeat ? null : current.seatIndex,
        companionsData: clearSameSeatCompanions.map((companion) =>
          companion.id === companionId ? { ...companion, tableId: table.id, seatIndex } : companion,
        ),
      };
    });
    toast('Asiento asignado');
  };

  const updateGuest = (id: string, patch: Partial<Guest>) => {
    const placementPatch =
      Object.prototype.hasOwnProperty.call(patch, 'table') && !Object.prototype.hasOwnProperty.call(patch, 'tableId')
        ? { tableId: undefined, seatIndex: null }
        : {};
    setGuests((prev) => prev.map((guest) => (guest.id === id ? normalizeGuest({ ...guest, ...placementPatch, ...patch }, 0) : guest)));
  };

  const resizeDraftCompanions = (nextCount: number) => {
    setDraft((current) => {
      const count = clamp(nextCount, 0, 20);
      const currentCompanions = current.companionsData || [];
      const nextCompanions =
        count > currentCompanions.length
          ? [
              ...currentCompanions,
              ...Array.from({ length: count - currentCompanions.length }, (_, index) =>
                normalizeCompanion({ name: `Acompañante ${currentCompanions.length + index + 1}` }, currentCompanions.length + index),
              ),
            ]
          : currentCompanions.slice(0, count);

      return { ...current, companions: count, companionsData: nextCompanions };
    });
  };

  const updateDraftCompanion = (id: string, patch: Partial<GuestCompanion>) => {
    setDraft((current) => ({
      ...current,
      companionsData: (current.companionsData || []).map((item, index) =>
        item.id === id ? normalizeCompanion({ ...item, ...patch }, index) : item,
      ),
    }));
  };

  const cycleStatus = (id: string) => {
    const order: GuestStatus[] = ['pending', 'confirmed', 'present', 'absent'];
    setGuests((prev) =>
      prev.map((guest) => {
        if (guest.id !== id) return guest;
        const next = order[(order.indexOf(guest.status) + 1) % order.length];
        return { ...guest, status: next };
      }),
    );
  };

  const importGuests = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      let skippedRows = 0;

      const imported = rows
        .map((row, index) => {
          const nameValue = row.nombre || row.name || row.invitado || row.guest;
          const phoneValue = row.telefono || row.phone || row.celular;
          const emailValue = row.email || row.mail;
          if (!String(nameValue || '').trim() || !String(phoneValue || '').trim() || !String(emailValue || '').trim()) {
            skippedRows += 1;
            return null;
          }

          const companionCount = clamp(Number(row.acompanantes || row.acompañantes || row.acompanantes_opcional || row.companions || row.extra || 0), 0, 20);

          return normalizeGuest(
            {
              id: nextId('guest'),
              name: String(nameValue),
              phone: String(phoneValue),
              email: String(emailValue),
              gender: normalizeGuestGender(row.genero || row.genero_opcional || row.gender || row.sexo),
              age: normalizeGuestAge(row.edad || row.edad_opcional || row.age),
              ageGroup: normalizeGuestAgeGroup(row.grupoEdad || row.grupo_edad || row.grupo_edad_opcional || row.ageGroup || row.tipoEdad),
              table: String(row.mesa || row.mesa_opcional || row.table || 'Sin mesa'),
              food: String(row.comida || row.comida_opcional || row.food || row.restriccion || 'Sin restriccion'),
              companions: companionCount,
              status: normalizeImportedGuestStatus(row.estado || row.estado_opcional || row.status || row.rsvp),
              inviteCode: createInviteCode(`${nameValue}-${index}`),
              side: index % 2 === 0 ? 'left' : 'right',
              registrationSource: 'import',
              reviewStatus: 'approved',
            },
            index,
          );
        })
        .filter(Boolean) as Guest[];

      if (!imported.length) {
        toast('No encontramos filas validas en el archivo', 'warning');
        return;
      }

      setGuests((prev) => [...imported, ...prev]);
      toast(`${imported.length} invitados importados${skippedRows ? `, ${skippedRows} filas omitidas` : ''}`);
    } catch {
      toast('No pudimos leer el archivo de invitados', 'warning');
    } finally {
      event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        nombre: 'Ana Perez',
        telefono: '+5491112345678',
        email: 'ana@example.com',
        genero_opcional: 'female',
        edad_opcional: 32,
        grupo_edad_opcional: 'adult',
        mesa_opcional: 'Mesa 4',
        comida_opcional: 'Vegetariana',
        acompanantes_opcional: 2,
        estado_opcional: 'pending',
      },
      {
        nombre: 'Juan Gomez',
        telefono: '+5491199991111',
        email: 'juan@example.com',
        genero_opcional: 'male',
        edad_opcional: '',
        grupo_edad_opcional: 'adult',
        mesa_opcional: '',
        comida_opcional: '',
        acompanantes_opcional: 0,
        estado_opcional: '',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invitados');
    XLSX.writeFile(workbook, `${slugify(eventInfo.name) || 'evento'}-plantilla-invitados.xlsx`);
    toast('Plantilla descargada', 'info');
  };

  const copyGuestInvitation = (guest: Guest) => {
    copyText(getInvitationUrl(workspaceId, guest.id), `Link copiado para ${guest.name}`);
  };

  const exportGuestSubset = (items: Guest[], fileSuffix: string) => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(
      items.map((guest) => ({
        nombre: guest.name,
        telefono: guest.phone,
        email: guest.email || '',
        genero: guest.gender,
        edad: guest.age ?? '',
        grupo_edad: guest.ageGroup,
        mesa: guest.table,
        mesa_id: guest.tableId || '',
        asiento: guest.seatIndex !== null && guest.seatIndex !== undefined ? Number(guest.seatIndex) + 1 : '',
        comida: guest.food,
        acompanantes: guest.companions,
        acompanantes_detalle: guest.companionsData.map((item) => item.name).join(', '),
        acompanantes_ubicacion: guest.companionsData.map((item) => `${item.name}: ${getSeatLocationLabel(layout, item.tableId, item.seatIndex, guest.table)}`).join(' | '),
        estado: guest.status,
        revision: guest.reviewStatus,
        origen: guest.registrationSource,
        lado: guest.side,
      })),
    );
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invitados');
    XLSX.writeFile(workbook, `${slugify(eventInfo.name) || 'evento'}-${fileSuffix}.xlsx`);
    toast(`Exportaste ${items.length} invitado${items.length === 1 ? '' : 's'}`);
  };

  const exportGuests = () => {
    exportGuestSubset(guests, 'invitados');
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedGuestId('');
  };

  const openCreateDrawer = () => {
    setSelectedGuestId('');
    setDraft(createDraft());
    setDrawerMode('create');
  };

  const openEditDrawer = (guest: Guest) => {
    setSelectedGuestId(guest.id);
    setDraft({
      name: guest.name,
      email: guest.email || '',
      phone: guest.phone,
      status: guest.status,
      gender: guest.gender,
      food: guest.food,
      age: guest.age ?? '',
      ageGroup: guest.ageGroup,
      companions: guest.companions,
      companionsData: guest.companionsData,
      table: guest.table,
      tableId: guest.tableId,
      seatIndex: guest.seatIndex ?? null,
      side: guest.side,
      note: guest.note || '',
      reviewStatus: guest.reviewStatus,
      registrationSource: guest.registrationSource,
    });
    setDrawerMode('edit');
  };

  const saveDraft = (keepOpenForAnother = false) => {
    if (!draft.name.trim()) {
      toast('El nombre es obligatorio', 'warning');
      return;
    }

    if (drawerMode === 'edit' && selectedGuest) {
      updateGuest(selectedGuest.id, {
        name: draft.name.trim(),
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || '-',
        status: draft.status,
        gender: draft.gender,
        food: draft.food.trim() || 'Sin restriccion',
        age: normalizeGuestAge(draft.age),
        ageGroup: draft.ageGroup,
        companionsData: draft.companionsData,
        companions: draft.companionsData.length,
        table: draft.table.trim() || tableOptions[0] || 'Sin mesa',
        tableId: draft.tableId,
        seatIndex: draft.seatIndex,
        side: draft.side,
        note: draft.note.trim() || undefined,
        reviewStatus: draft.reviewStatus,
        registrationSource: draft.registrationSource,
      });
      toast('Invitado actualizado');
      closeDrawer();
      return;
    }

    const newId = nextId('guest');
    const payload = normalizeGuest(
      {
        id: newId,
        name: draft.name.trim(),
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || '-',
        status: draft.status,
        gender: draft.gender,
        table: draft.table.trim() || tableOptions[0] || 'Sin mesa',
        tableId: draft.tableId,
        seatIndex: draft.seatIndex,
        food: draft.food.trim() || 'Sin restriccion',
        age: normalizeGuestAge(draft.age),
        ageGroup: draft.ageGroup,
        companionsData: draft.companionsData,
        companions: draft.companionsData.length,
        inviteCode: createInviteCode(`${draft.name}-${draft.phone || draft.email || newId}`),
        side: draft.side,
        note: draft.note.trim() || undefined,
        reviewStatus: draft.reviewStatus,
        registrationSource: draft.registrationSource,
      },
      guests.length,
    );
    setGuests((prev) => [payload, ...prev]);
    setSelectedGuestId(payload.id);
    toast('Invitado agregado');

    if (keepOpenForAnother) {
      setDraft(createDraft());
      setDrawerMode('create');
      return;
    }

    closeDrawer();
  };

  const deleteGuest = async (guest: Guest) => {
    const result = await Swal.fire({
      title: 'Eliminar invitado',
      text: `Vas a quitar a ${guest.name} de la lista.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      background: '#fffafc',
    });

    if (!result.isConfirmed) return;

    setGuests((prev) => prev.filter((item) => item.id !== guest.id));
    setSelectedGuestIds((prev) => prev.filter((id) => id !== guest.id));
    if (selectedGuestId === guest.id) closeDrawer();
    toast('Invitado eliminado');
  };

  const reviewGuest = async (guest: Guest, reviewStatus: GuestReviewStatus) => {
    if (!['approved', 'rejected'].includes(reviewStatus)) return;

    const rejectionResult =
      reviewStatus === 'rejected'
        ? await Swal.fire({
            title: 'Rechazar solicitud',
            input: 'text',
            inputPlaceholder: 'Motivo opcional',
            showCancelButton: true,
            confirmButtonText: 'Rechazar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            background: '#fffafc',
          })
        : null;

    if (rejectionResult?.isDismissed) return;
    const rejectionReason = String(rejectionResult?.value || '');

    const patch: Partial<Guest> = {
      reviewStatus,
      rejectionReason: reviewStatus === 'rejected' ? rejectionReason || undefined : undefined,
      status: reviewStatus === 'rejected' ? 'absent' : guest.status,
    };

    updateGuest(guest.id, patch);

    if (workspaceId && !String(workspaceId).startsWith('draft-')) {
      try {
        const saved = await reviewWorkspaceGuest(workspaceId, guest.id, reviewStatus as 'approved' | 'rejected', rejectionReason);
        updateGuest(guest.id, saved as Guest);
      } catch (error) {
        console.error('Error reviewing guest:', error);
        toast('No pudimos guardar la revision en backend', 'warning');
      }
    }

    toast(reviewStatus === 'approved' ? 'Invitado aprobado' : 'Invitado rechazado');
  };

  const toggleGuestSelection = (guestId: string) => {
    setSelectedGuestIds((prev) => (prev.includes(guestId) ? prev.filter((id) => id !== guestId) : [...prev, guestId]));
  };

  const toggleAllVisible = () => {
    const visibleIds = filteredGuests.map((guest) => guest.id);
    if (!visibleIds.length) return;
    const everySelected = visibleIds.every((id) => selectedGuestIds.includes(id));
    setSelectedGuestIds((prev) => {
      if (everySelected) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const applyBulkAction = async (value: string) => {
    if (!value || !selectedGuestIds.length) {
      setBulkAction('');
      return;
    }

    const selectedIds = new Set(selectedGuestIds);

    if (value === 'delete') {
      const result = await Swal.fire({
        title: 'Eliminar seleccionados',
        text: `Se van a eliminar ${selectedGuestIds.length} invitados.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626',
        background: '#fffafc',
      });

      if (result.isConfirmed) {
        setGuests((prev) => prev.filter((guest) => !selectedIds.has(guest.id)));
        setSelectedGuestIds([]);
        toast('Selección eliminada');
      }
      setBulkAction('');
      return;
    }

    if (value === 'copy-links') {
      copyText(selectedGuests.map((guest) => `${guest.name}: ${getInvitationUrl(workspaceId, guest.id)}`).join('\n'), 'Links de invitación copiados');
      setBulkAction('');
      return;
    }

    if (value === 'export') {
      exportGuestSubset(selectedGuests, 'invitados-seleccionados');
      setBulkAction('');
      return;
    }

    if (value.startsWith('status:')) {
      const nextStatus = value.replace('status:', '') as GuestStatus;
      setGuests((prev) => prev.map((guest) => (selectedIds.has(guest.id) ? { ...guest, status: nextStatus } : guest)));
      toast('Estado actualizado');
    }

    if (value.startsWith('side:')) {
      const nextSide = value.replace('side:', '') as Guest['side'];
      setGuests((prev) => prev.map((guest) => (selectedIds.has(guest.id) ? { ...guest, side: nextSide } : guest)));
      toast('Lado actualizado');
    }

    setBulkAction('');
  };

  const applyBulkTable = () => {
    if (!bulkTable || !selectedGuestIds.length) return;
    const selectedIds = new Set(selectedGuestIds);
    setGuests((prev) => prev.map((guest) => (selectedIds.has(guest.id) ? { ...guest, table: bulkTable, tableId: undefined, seatIndex: null } : guest)));
    toast('Mesa asignada a la selección');
    setBulkTable('');
  };

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setGenderFilter('all');
    setFoodFilter('all');
    setSideFilter('all');
    setTableFilter('all');
    setLinkFilter('all');
    setPlacementFilter('all');
    setReviewFilter('all');
    setSortBy('name');
  };

  const getStatusClasses = (status: GuestStatus) => {
    if (status === 'confirmed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'present') return 'border-sky-200 bg-sky-50 text-sky-700';
    if (status === 'absent') return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-amber-200 bg-amber-50 text-amber-700';
  };

  const renderGuestRow = (guest: Guest) => {
    const guestTable = tableSummaries.find((tableItem) => tableItem.label === guest.table);
    const partySize = getGuestPartySize(guest);
    const hasSpecialMeal = guest.food.toLowerCase() !== 'sin restriccion';
    const isSelected = selectedGuestIds.includes(guest.id);
    const isActive = selectedGuestId === guest.id && drawerMode === 'edit';
    const missingContact = !guest.email && (!guest.phone || guest.phone === '-');

    return (
      <motion.article
        key={guest.id}
        layout
        onClick={() => openEditDrawer(guest)}
        className={`w-full cursor-pointer rounded-[24px] border px-4 py-4 text-left transition ${isActive ? 'border-[#d9a8be] bg-[#fff8fb] shadow-[0_18px_38px_rgba(190,97,134,.12)]' : 'border-[#eadfe7] bg-white hover:border-[#d9c2cf] hover:shadow-[0_16px_36px_rgba(15,23,42,.06)]'}`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleGuestSelection(guest.id);
              }}
              className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-transparent'}`}
              aria-label={isSelected ? 'Quitar de la selección' : 'Seleccionar invitado'}
            >
              <i className="fas fa-check text-[10px]"></i>
            </button>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] text-sm font-black ${guest.gender === 'female' ? 'bg-[#f7d7e4] text-[#9a3b68]' : guest.gender === 'male' ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#ede9fe] text-[#6d28d9]'}`}>
              {guest.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('') || 'IN'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-black text-slate-900">{guest.name}</p>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${getStatusClasses(guest.status)}`}>{getGuestStatusLabel(guest.status)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{guest.phone}{guest.email ? ` · ${guest.email}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{guest.table === 'Sin mesa' ? 'Sin ubicación' : guest.table}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{getSideLabel(guest.side)}</span>
                {guest.companions > 0 ? <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-[#2457a6]">+{guest.companions} acompañantes</span> : null}
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{getGuestAgeGroupLabel(guest.ageGroup)}{guest.age ? ` · ${guest.age}` : ''}</span>
                {hasSpecialMeal ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{guest.food}</span> : null}
                {guest.reviewStatus !== 'approved' ? <span className={`rounded-full px-3 py-1 ${guest.reviewStatus === 'pending_review' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{getReviewStatusLabel(guest.reviewStatus)}</span> : null}
                {guest.registrationSource === 'public' ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">Auto registro</span> : null}
                {guest.inviteCode ? <span className="rounded-full bg-[#f6f0ff] px-3 py-1 text-[#6c45b0]">Link listo</span> : null}
                {guestTable?.overflow ? <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Mesa excedida</span> : null}
                {missingContact ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Falta contacto</span> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">{partySize} lugar{partySize === 1 ? '' : 'es'}</span>
            {guest.reviewStatus === 'pending_review' ? (
              <>
                <button type="button" onClick={(event) => { event.stopPropagation(); void reviewGuest(guest, 'approved'); }} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-700">
                  Aprobar
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); void reviewGuest(guest, 'rejected'); }} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700">
                  Rechazar
                </button>
              </>
            ) : null}
            <button type="button" onClick={(event) => { event.stopPropagation(); cycleStatus(guest.id); }} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#e3d8e0] bg-white px-3 text-sm font-black text-slate-700">
              <i className="fas fa-repeat"></i>
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); copyGuestInvitation(guest); }} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#e3d8e0] bg-white px-3 text-sm font-black text-slate-700">
              <i className="fas fa-link"></i>
            </button>
            <button type="button" onClick={(event) => { event.stopPropagation(); openEditDrawer(guest); }} className="inline-flex h-10 items-center justify-center rounded-[14px] border border-[#e3d8e0] bg-white px-3 text-sm font-black text-slate-700">
              <i className="fas fa-pen"></i>
            </button>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <section className="mx-auto max-w-[1380px]">
      <div className="rounded-[34px] border border-[#e6d6df] bg-[linear-gradient(180deg,#fffdfd_0%,#fff7fa_100%)] p-6 shadow-[0_28px_70px_rgba(15,23,42,.08)] md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#ead7e1] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#8d5c72]">Gestión de invitados</span>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-4xl">Invitados</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
              La pantalla prioriza búsqueda, clasificación y acciones rápidas. La edición y la carga manual viven en un drawer lateral para no mezclar gestión con detalle.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-white px-3 py-1.5 font-black text-slate-700">{guests.length} invitados</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-black text-slate-700">{filteredGuests.length} visibles</span>
              <span className="rounded-full bg-white px-3 py-1.5 font-black text-slate-700">{totalSeats > 0 ? `${occupiedSeats}/${totalSeats} lugares ocupados` : 'Capacidad aún sin definir'}</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[360px]">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={openCreateDrawer} className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(15,23,42,.18)]"><i className="fas fa-user-plus"></i>Agregar invitado</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#ddc9d4] bg-white px-5 py-3 text-sm font-black text-slate-700"><i className="fas fa-file-import"></i>Carga masiva</button>
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#ddc9d4] bg-white px-5 py-3 text-sm font-black text-slate-700"><i className="fas fa-file-arrow-down"></i>Descargar plantilla</button>
              <button type="button" onClick={() => onJump?.('seating')} className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#ddc9d4] bg-white px-5 py-3 text-sm font-black text-slate-700"><i className="fas fa-table-cells-large"></i>Ver plano / modo visual</button>
            </div>

            <div className="rounded-[22px] border border-[#ead7e1] bg-white/90 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Link general</p>
                  <p className="mt-2 break-all text-sm font-black text-slate-900">{invitationLabel}</p>
                </div>
                <button type="button" onClick={() => copyText(invitationUrl, 'Link general de invitacion copiado')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e6d9e1] bg-slate-50 text-slate-700"><i className="fas fa-link"></i></button>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">El plano quedó como un modo separado para asignación visual. Desde acá administrás la lista sin ruido operativo.</p>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importGuests} />

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: 'Total invitados', value: String(guests.length), tone: 'text-slate-950', note: `${filteredGuests.length} visibles` },
            { label: 'Confirmados', value: String(rsvpSummary.confirmed), tone: 'text-emerald-700', note: `${rsvpSummary.pending} pendientes` },
            { label: 'Ausentes', value: String(absentGuests), tone: 'text-rose-700', note: `${totalCompanions} acompañantes` },
            { label: 'Capacidad', value: totalSeats > 0 ? `${occupiedSeats}/${totalSeats}` : 'Sin dato', tone: 'text-slate-950', note: totalSeats > 0 ? `${freeSeats} libres` : 'Cargala desde el plano' },
            { label: 'Revisión', value: String(pendingReviewGuests), tone: 'text-amber-700', note: 'auto-registros pendientes' },
            { label: 'Invitaciones', value: String(invitationsReady), tone: 'text-[#6c45b0]', note: overflowTables > 0 ? `${overflowTables} mesas excedidas` : `${specialMeals} menús especiales` },
          ].map((item) => (
            <div key={item.label} className="rounded-[22px] border border-[#eadfe7] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,.04)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className={`mt-3 text-3xl font-black tracking-[-0.04em] ${item.tone}`}>{item.value}</p>
              <p className="mt-2 text-sm text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[30px] border border-[#e6d6df] bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,.06)] md:p-6">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(180px,1fr))]">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Buscar</span>
            <div className="flex items-center rounded-[18px] border border-[#e4d7df] bg-[#fffafb] px-4">
              <i className="fas fa-search text-sm text-slate-400"></i>
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" placeholder="Buscar por nombre, apellido, email o teléfono" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | GuestStatus)} className="w-full rounded-[18px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmados</option>
              <option value="present">Presentes</option>
              <option value="absent">Ausentes</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Revisión</span>
            <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as 'all' | GuestReviewStatus)} className="w-full rounded-[18px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all">Todos</option>
              <option value="approved">Aprobados</option>
              <option value="pending_review">Revisión pendiente</option>
              <option value="rejected">Rechazados</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ordenar</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'name' | 'status' | 'table' | 'created')} className="w-full rounded-[18px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="name">Por nombre</option>
              <option value="status">Por estado</option>
              <option value="table">Por mesa</option>
              <option value="created">Por fecha de carga</option>
            </select>
          </label>

          <div>
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Vista</span>
            <div className="flex h-[50px] items-center rounded-[18px] border border-[#e4d7df] bg-[#fffafb] p-1">
              {[
                { value: 'list', label: 'Lista', icon: 'fa-list' },
                { value: 'alphabetic', label: 'Alfabético', icon: 'fa-arrow-down-a-z' },
                { value: 'tables', label: 'Por mesas', icon: 'fa-table-cells' },
              ].map((item) => (
                <button key={item.value} type="button" onClick={() => setViewMode(item.value as 'list' | 'alphabetic' | 'tables')} className={`flex h-full flex-1 items-center justify-center gap-2 rounded-[14px] text-sm font-black transition ${viewMode === item.value ? 'bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,.15)]' : 'text-slate-600'}`}>
                  <i className={`fas ${item.icon}`}></i>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Género</span>
            <select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value as 'all' | GuestGender)} className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all">Todos</option>
              <option value="female">Mujer</option>
              <option value="male">Hombre</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Alimentación</span>
            <select value={foodFilter} onChange={(event) => setFoodFilter(event.target.value as 'all' | 'special' | 'none')} className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all">Todas</option>
              <option value="special">Con restricción</option>
              <option value="none">Sin restricción</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mesa / fila</span>
            <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all">Todas</option>
              <option value="Sin mesa">Sin mesa</option>
              {tableOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Lado</span>
            <select value={sideFilter} onChange={(event) => setSideFilter(event.target.value as 'all' | Guest['side'])} className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all">Todos</option>
              <option value="left">Lado A</option>
              <option value="right">Lado B</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Más filtros</span>
            <select value={`${linkFilter}:${placementFilter}`} onChange={(event) => {
              const [nextLink, nextPlacement] = event.target.value.split(':');
              setLinkFilter(nextLink as 'all' | 'with_link' | 'without_link');
              setPlacementFilter(nextPlacement as 'all' | 'assigned' | 'unassigned' | 'with_companions' | 'without_companions');
            }} className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="all:all">Sin filtros extra</option>
              <option value="with_link:all">Con link generado</option>
              <option value="without_link:all">Sin link</option>
              <option value="all:assigned">Con ubicación</option>
              <option value="all:unassigned">Sin ubicación</option>
              <option value="all:with_companions">Con acompañantes</option>
              <option value="all:without_companions">Sin acompañantes</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[22px] border border-[#efe4ea] bg-[#fffafb] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-slate-700">{filteredGuests.length} resultados</span>
            {activeFilterCount > 0 ? <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#8d5c72]">{activeFilterCount} filtros activos</span> : null}
            <button type="button" onClick={clearFilters} className="rounded-full border border-[#e3d8e0] bg-white px-3 py-1.5 text-sm font-black text-slate-600">Limpiar filtros</button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportGuests} className="rounded-[14px] border border-[#e3d8e0] bg-white px-4 py-2.5 text-sm font-black text-slate-700">Exportar</button>
            <button type="button" onClick={() => window.open(invitationUrl, '_blank', 'noopener,noreferrer')} className="rounded-[14px] border border-[#e3d8e0] bg-white px-4 py-2.5 text-sm font-black text-slate-700">Ver invitación</button>
            <button type="button" onClick={() => onJump?.('seating')} className="rounded-[14px] border border-[#e3d8e0] bg-white px-4 py-2.5 text-sm font-black text-slate-700">Ir al plano</button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[30px] border border-[#e6d6df] bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,.06)] md:p-6">
        <div className="flex flex-col gap-4 border-b border-[#f2e7ec] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Operación principal</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Listado de invitados</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Hacé foco en la lista. El detalle y la edición aparecen sólo cuando los necesitás.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={toggleAllVisible} className="rounded-[14px] border border-[#e3d8e0] bg-white px-4 py-2.5 text-sm font-black text-slate-700">{filteredGuests.length > 0 && filteredGuests.every((guest) => selectedGuestIds.includes(guest.id)) ? 'Quitar visibles' : 'Seleccionar visibles'}</button>
            {selectedGuestIds.length > 0 ? <span className="rounded-full bg-[#fff2f6] px-3 py-2 text-sm font-black text-[#9a3b68]">{selectedGuestIds.length} seleccionados</span> : null}
          </div>
        </div>

        {selectedGuestIds.length > 0 ? (
          <div className="mt-5 grid gap-3 rounded-[24px] border border-[#ecd9e2] bg-[#fff7fa] p-4 xl:grid-cols-[minmax(0,1.2fr)_240px_220px]">
            <div>
              <p className="text-sm font-black text-slate-900">Acciones masivas</p>
              <p className="mt-1 text-sm text-slate-500">Cambiá estado, lado, mesa o exportá la selección sin salir del listado.</p>
            </div>
            <select value={bulkAction} onChange={(event) => { setBulkAction(event.target.value); void applyBulkAction(event.target.value); }} className="rounded-[16px] border border-[#e1cfd8] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
              <option value="">Acción masiva</option>
              <option value="status:pending">Marcar pendientes</option>
              <option value="status:confirmed">Marcar confirmados</option>
              <option value="status:present">Marcar presentes</option>
              <option value="status:absent">Marcar ausentes</option>
              <option value="side:left">Mover a lado A</option>
              <option value="side:right">Mover a lado B</option>
              <option value="copy-links">Copiar links</option>
              <option value="export">Exportar selección</option>
              <option value="delete">Eliminar selección</option>
            </select>
            <div className="flex gap-2">
              <select value={bulkTable} onChange={(event) => setBulkTable(event.target.value)} className="min-w-0 flex-1 rounded-[16px] border border-[#e1cfd8] bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none">
                <option value="">Asignar mesa</option>
                <option value="Sin mesa">Sin mesa</option>
                {tableOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button type="button" onClick={applyBulkTable} className="rounded-[16px] bg-slate-950 px-4 py-3 text-sm font-black text-white">Aplicar</button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          {filteredGuests.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#decad4] bg-[#fffafb] px-6 py-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#9a3b68] shadow-[0_14px_30px_rgba(15,23,42,.06)]"><i className="fas fa-users text-xl"></i></div>
              <h3 className="mt-4 text-xl font-black text-slate-950">No hay invitados para esta combinación</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Ajustá filtros o sumá un nuevo invitado. La lista principal se mantiene limpia y el detalle aparece sólo al editar.</p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={clearFilters} className="rounded-[16px] border border-[#e3d8e0] bg-white px-4 py-3 text-sm font-black text-slate-700">Limpiar filtros</button>
                <button type="button" onClick={openCreateDrawer} className="rounded-[16px] bg-slate-950 px-4 py-3 text-sm font-black text-white">Agregar invitado</button>
              </div>
            </div>
          ) : null}

          {filteredGuests.length > 0 && viewMode === 'list' ? <div className="space-y-3">{filteredGuests.map(renderGuestRow)}</div> : null}

          {filteredGuests.length > 0 && viewMode === 'alphabetic' ? (
            <div className="space-y-4">
              {guestsAlphabetic.map(([letter, items]) => (
                <div key={letter} className="rounded-[26px] border border-[#ece2e8] bg-[#fffdfd] p-4">
                  <div className="flex items-center gap-3 border-b border-[#f2e7ec] pb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{letter}</span>
                    <div>
                      <p className="text-lg font-black text-slate-950">{items.length} invitado{items.length === 1 ? '' : 's'}</p>
                      <p className="text-sm text-slate-500">Agrupados alfabéticamente para escaneo rápido</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">{items.map(renderGuestRow)}</div>
                </div>
              ))}
            </div>
          ) : null}

          {filteredGuests.length > 0 && viewMode === 'tables' ? (
            <div className="space-y-4">
              {visibleTableSummaries.map((tableItem) => (
                <div key={tableItem.id} className={`rounded-[26px] border p-4 ${tableItem.overflow ? 'border-rose-200 bg-rose-50/70' : 'border-[#ece2e8] bg-[#fffdfd]'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f2e7ec] pb-4">
                    <div>
                      <p className="text-lg font-black text-slate-950">{tableItem.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{tableItem.assignedSeats} lugar{tableItem.assignedSeats === 1 ? '' : 'es'} asignado{tableItem.assignedSeats === 1 ? '' : 's'}{tableItem.seats > 0 ? ` · capacidad ${tableItem.seats}` : ' · sin capacidad configurada'}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${tableItem.overflow ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{tableItem.overflow ? 'Excedida' : `${tableItem.freeSeats} libres`}</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {tableItem.filteredGuests.length > 0 ? tableItem.filteredGuests.map(renderGuestRow) : <div className="rounded-[20px] border border-dashed border-[#d9c8d1] bg-white p-4 text-sm text-slate-500">No hay invitados asignados todavía.</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {drawerMode ? (
          <motion.div className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer}>
            <motion.aside initial={{ x: 420, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 420, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} onClick={(event) => event.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-y-auto border-l border-[#ead7e1] bg-[#fffdfd] p-6 shadow-[0_28px_80px_rgba(15,23,42,.16)] md:p-7">
              <div className="flex items-start justify-between gap-4 border-b border-[#f2e7ec] pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{drawerMode === 'create' ? 'Alta manual' : 'Detalle del invitado'}</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{drawerMode === 'create' ? 'Agregar invitado' : draft.name || 'Editar invitado'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{drawerMode === 'create' ? 'Cargá datos básicos primero y completá ubicación, estado y perfil sin salir del flujo principal.' : 'La edición está organizada por bloques para que puedas resolver cambios sin una ficha pesada.'}</p>
                </div>
                <button type="button" onClick={closeDrawer} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e3d8e0] bg-white text-slate-700"><i className="fas fa-xmark"></i></button>
              </div>

              <div className="mt-6 space-y-5">
                <section className="rounded-[24px] border border-[#ece2e8] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Datos básicos</p>
                  <div className="mt-4 grid gap-3">
                    <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-slate-900 outline-none" placeholder="Nombre y apellido" />
                    <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-slate-900 outline-none" placeholder="Email" />
                    <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-slate-900 outline-none" placeholder="Teléfono" />
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#ece2e8] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Estado e invitación</p>
                      <p className="mt-1 text-sm text-slate-500">Resolvé RSVP y link sin perder el foco del formulario.</p>
                    </div>
                    {drawerMode === 'edit' && selectedGuest ? <span className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(selectedGuest.status)}`}>{getGuestStatusLabel(selectedGuest.status)}</span> : null}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Estado</span>
                      <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as GuestStatus }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-sm font-black text-slate-700 outline-none">
                        <option value="pending">Pendiente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="present">Presente</option>
                        <option value="absent">Ausente</option>
                      </select>
                    </label>
                    <div className="rounded-[18px] border border-[#ece2e8] bg-[#fffafb] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Link de invitación</p>
                      {drawerMode === 'edit' && selectedGuest ? (
                        <>
                          <p className="mt-2 break-all text-sm font-black text-slate-900">{typeof window === 'undefined' ? getInvitationUrl(workspaceId, selectedGuest.id) : getInvitationUrl(workspaceId, selectedGuest.id).replace(window.location.origin, '')}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => copyGuestInvitation(selectedGuest)} className="rounded-[14px] border border-[#e3d8e0] bg-white px-3 py-2 text-sm font-black text-slate-700">Copiar link</button>
                            <button type="button" onClick={() => window.open(getInvitationUrl(workspaceId, selectedGuest.id), '_blank', 'noopener,noreferrer')} className="rounded-[14px] border border-[#e3d8e0] bg-white px-3 py-2 text-sm font-black text-slate-700">Abrir</button>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-slate-500">El link se genera automáticamente cuando guardás el invitado.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#ece2e8] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Ubicación en el evento</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-[#ece2e8] bg-[#fffafb] p-4 md:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Asientos del grupo</p>
                          <p className="mt-1 text-sm text-slate-500">Ubica titular y acompanantes silla por silla en el plano.</p>
                        </div>
                        <button type="button" onClick={() => { setSeatModalPersonId('guest'); setSeatModalOpen(true); }} className="rounded-[14px] bg-slate-950 px-4 py-2 text-sm font-black text-white">
                          Asignar en plano
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {draftSeatPeople.map((person) => (
                          <div key={person.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-[#eadfe7] bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">{person.name}</p>
                              <p className="text-xs font-semibold text-slate-500">{person.kind === 'guest' ? 'Titular' : 'Acompanante'}</p>
                            </div>
                            <span className={`max-w-[190px] truncate rounded-full px-3 py-1 text-xs font-black ${person.tableId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {getDraftSeatLocation(person)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Mesa / fila</span>
                      <select value={draft.table} onChange={(event) => setDraft((current) => ({ ...current, table: event.target.value, tableId: undefined, seatIndex: null }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-sm font-black text-slate-700 outline-none">
                        <option value="Sin mesa">Sin mesa</option>
                        {tableOptions.map((option) => {
                          const summary = tableSummaries.find((item) => item.label === option);
                          return <option key={option} value={option}>{summary ? `${summary.label} · ${summary.assignedSeats}/${summary.seats || 'libre'}` : option}</option>;
                        })}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Lado</span>
                      <select value={draft.side} onChange={(event) => setDraft((current) => ({ ...current, side: event.target.value as Guest['side'] }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-sm font-black text-slate-700 outline-none">
                        <option value="left">Lado A</option>
                        <option value="right">Lado B</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 rounded-[18px] border border-[#ece2e8] bg-[#fffafb] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Acompañantes</p>
                        <p className="mt-1 text-sm text-slate-500">Cada invitado ocupa {1 + draft.companions} lugar{1 + draft.companions === 1 ? '' : 'es'} contando su grupo.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => resizeDraftCompanions(draft.companions - 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3d8e0] bg-white text-slate-700">-</button>
                        <span className="min-w-[32px] text-center text-2xl font-black text-slate-950">{draft.companions}</span>
                        <button type="button" onClick={() => resizeDraftCompanions(draft.companions + 1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3d8e0] bg-white text-slate-700">+</button>
                      </div>
                    </div>
                    {draft.companionsData.length ? (
                      <div className="mt-4 grid gap-3">
                        {draft.companionsData.map((companion) => (
                          <div key={companion.id} className="grid gap-2 rounded-[16px] border border-[#eadfe7] bg-white p-3 md:grid-cols-2">
                            <input value={companion.name} onChange={(event) => updateDraftCompanion(companion.id, { name: event.target.value })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none" placeholder="Nombre acompañante" />
                            <input value={companion.email || ''} onChange={(event) => updateDraftCompanion(companion.id, { email: event.target.value })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none" placeholder="Email opcional" />
                            <input value={companion.phone || ''} onChange={(event) => updateDraftCompanion(companion.id, { phone: event.target.value })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none" placeholder="Teléfono opcional" />
                            <input type="number" min={0} max={130} value={companion.age ?? ''} onChange={(event) => updateDraftCompanion(companion.id, { age: normalizeGuestAge(event.target.value) })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none" placeholder="Edad" />
                            <select value={companion.gender} onChange={(event) => updateDraftCompanion(companion.id, { gender: event.target.value as GuestGender })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none">
                              {GUEST_GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select value={companion.ageGroup} onChange={(event) => updateDraftCompanion(companion.id, { ageGroup: event.target.value as GuestAgeGroup })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none">
                              {GUEST_AGE_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <input value={companion.food} onChange={(event) => updateDraftCompanion(companion.id, { food: event.target.value })} className="rounded-[12px] border border-[#e4d7df] px-3 py-2 text-sm outline-none md:col-span-2" placeholder="Preferencia de comida" />
                            <div className="rounded-[12px] bg-[#fff7fa] px-3 py-2 text-xs font-black text-slate-500 md:col-span-2">
                              Ubicacion: {getSeatLocationLabel(layout, companion.tableId, companion.seatIndex, draft.table)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 rounded-[18px] border border-[#ece2e8] bg-[#fffafb] p-4 text-sm leading-6 text-slate-600">
                    {(() => {
                      const summary = tableSummaries.find((item) => item.label === draft.table);
                      if (!summary) return 'Esta ubicación no existe en el plano actual. Podés crearla o ajustar nombres desde el módulo de plano.';
                      if (draft.table === 'Sin mesa') return 'Todavía no tiene ubicación asignada. Podés resolverlo después desde la vista visual.';
                      return summary.overflow
                        ? `La mesa ${summary.label} ya está excedida: ${summary.assignedSeats}/${summary.seats} lugares ocupados contando acompañantes.`
                        : `La mesa ${summary.label} va ${summary.assignedSeats}/${summary.seats || 'sin límite'} con acompañantes incluidos.`;
                    })()}
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#ece2e8] bg-white p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Perfil del invitado</p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Género</p>
                      <div className="flex flex-wrap gap-2">
                        {GUEST_GENDER_OPTIONS.map((option) => (
                          <button key={option.value} type="button" onClick={() => setDraft((current) => ({ ...current, gender: option.value }))} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition ${draft.gender === option.value ? 'bg-slate-950 text-white' : 'border border-[#e3d8e0] bg-white text-slate-600'}`}>
                            <i className={`fas ${option.icon}`}></i>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Edad</span>
                        <input type="number" min={0} max={130} value={draft.age} onChange={(event) => setDraft((current) => ({ ...current, age: event.target.value === '' ? '' : Number(event.target.value) }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-slate-900 outline-none" placeholder="Opcional" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Grupo etario</span>
                        <select value={draft.ageGroup} onChange={(event) => setDraft((current) => ({ ...current, ageGroup: event.target.value as GuestAgeGroup }))} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-sm font-black text-slate-700 outline-none">
                          {GUEST_AGE_GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Alimentación especial</p>
                      <div className="flex flex-wrap gap-2">
                        {GUEST_FOOD_PRESETS.map((preset) => (
                          <button key={preset} type="button" onClick={() => setDraft((current) => ({ ...current, food: preset }))} className={`rounded-full px-3 py-2 text-xs font-black transition ${draft.food === preset ? 'bg-emerald-400 text-[#112416]' : 'border border-[#e3d8e0] bg-white text-slate-600'}`}>
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Observaciones</span>
                      <textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} rows={4} className="w-full rounded-[16px] border border-[#e4d7df] bg-[#fffafb] px-4 py-3 text-slate-900 outline-none" placeholder="Aclaraciones, alergias, ubicación deseada o notas del equipo" />
                    </label>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-[#f2e7ec] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {drawerMode === 'edit' && selectedGuest ? <button type="button" onClick={() => void deleteGuest(selectedGuest)} className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">Eliminar</button> : null}
                  <button type="button" onClick={closeDrawer} className="rounded-[16px] border border-[#e3d8e0] bg-white px-4 py-3 text-sm font-black text-slate-700">Cancelar</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {drawerMode === 'create' ? <button type="button" onClick={() => saveDraft(true)} className="rounded-[16px] border border-[#e3d8e0] bg-white px-4 py-3 text-sm font-black text-slate-700">Guardar y agregar otro</button> : null}
                  <button type="button" onClick={() => saveDraft(false)} className="rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60" disabled={!draft.name.trim()}>Guardar</button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {drawerMode && seatModalOpen ? (
          <motion.div className="fixed inset-0 z-50 bg-slate-950/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ duration: 0.2 }} className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[28px] bg-white text-slate-950 shadow-[0_28px_90px_rgba(0,0,0,.35)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Asignacion visual</p>
                  <h2 className="mt-1 text-2xl font-black">Elegir asiento en el plano</h2>
                  <p className="mt-1 text-sm text-slate-500">Selecciona una persona del grupo y toca una silla libre.</p>
                </div>
                <button type="button" onClick={() => setSeatModalOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"><i className="fas fa-xmark" /></button>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_1fr]">
                <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Personas del grupo</p>
                  <div className="mt-3 grid gap-2">
                    {draftSeatPeople.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => setSeatModalPersonId(person.id)}
                        className={`rounded-[16px] border px-4 py-3 text-left transition ${selectedDraftSeatPerson?.id === person.id ? 'border-slate-950 bg-white shadow-sm' : 'border-slate-200 bg-white/70 hover:bg-white'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">{person.name}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{person.kind === 'guest' ? 'Titular' : 'Acompanante'}</p>
                          </div>
                          <span className={`h-3 w-3 rounded-full ${person.tableId ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <p className="mt-2 truncate text-xs font-black text-slate-500">{getDraftSeatLocation(person)}</p>
                      </button>
                    ))}
                  </div>
                  {selectedDraftSeatPerson ? (
                    <button type="button" onClick={() => clearDraftSeatPerson(selectedDraftSeatPerson.id)} className="mt-4 w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                      Liberar asiento seleccionado
                    </button>
                  ) : null}
                </aside>

                <div className="min-h-0 overflow-auto bg-slate-100 p-5">
                  <div className="mx-auto" style={{ width: BOARD_W, height: BOARD_H }}>
                    <div
                      className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-inner"
                      style={{
                        width: BOARD_W,
                        height: BOARD_H,
                        backgroundImage: SEATING_BOARD_THEMES[0].backgroundImage,
                        backgroundSize: '100% 100%,28px 28px,28px 28px,100% 100%',
                      }}
                    >
                      <div className="absolute inset-x-8 top-6 flex items-center justify-center gap-3">
                        <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">Toca una silla</span>
                        <span className="rounded-full bg-white/92 px-4 py-2 text-xs font-black text-slate-700">{selectedDraftSeatPerson?.name || 'Selecciona persona'}</span>
                      </div>

                      {layout.map((item) => {
                        const cfg = elementConfig[item.type];
                        const seatDots = getSeatDots(item);
                        return (
                          <div
                            key={item.id}
                            className="absolute flex select-none items-center justify-center border text-center shadow-[0_20px_36px_rgba(15,23,42,.12)]"
                            style={{
                              left: item.x,
                              top: item.y,
                              width: item.w,
                              height: item.h,
                              borderRadius: cfg.borderRadius,
                              background: cfg.gradient,
                              color: cfg.textColor,
                              borderColor: 'rgba(255,255,255,.4)',
                            }}
                          >
                            {seatDots.map((dot, index) => {
                              const draftOccupant = getDraftSeatOccupant(item.id, index);
                              const externalOccupant = getExternalSeatOccupant(item.id, index);
                              const occupant = draftOccupant || externalOccupant;
                              const isSelectedPersonSeat = selectedDraftSeatPerson?.tableId === item.id && selectedDraftSeatPerson?.seatIndex === index;
                              const labelTransform =
                                dot.labelSide === 'top'
                                  ? 'translate(-50%, calc(-100% - 9px))'
                                  : dot.labelSide === 'bottom'
                                    ? 'translate(-50%, 9px)'
                                    : dot.labelSide === 'left'
                                      ? 'translate(calc(-100% - 9px), -50%)'
                                      : 'translate(9px, -50%)';

                              return (
                                <button
                                  key={`${item.id}-${index}`}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (!selectedDraftSeatPerson) return;
                                    assignDraftSeatPerson(selectedDraftSeatPerson.id, item, index);
                                  }}
                                  disabled={Boolean(externalOccupant)}
                                  className={`absolute flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-black shadow-sm transition ${externalOccupant ? 'cursor-not-allowed border-rose-200 bg-rose-100 text-rose-700' : occupant ? 'border-emerald-200 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-amber-50'} ${isSelectedPersonSeat ? 'ring-4 ring-amber-300' : ''}`}
                                  style={{ left: dot.left, top: dot.top, transform: 'translate(-50%, -50%)' }}
                                  title={occupant ? occupant.name : `Asiento ${index + 1}`}
                                >
                                  {occupant ? occupant.name.trim().slice(0, 1).toUpperCase() : index + 1}
                                  {occupant ? (
                                    <span
                                      className={`pointer-events-none absolute z-20 max-w-[120px] truncate rounded-full border bg-white px-2 py-1 text-[9px] font-black leading-none shadow-sm ${externalOccupant ? 'border-rose-100 text-rose-700' : 'border-emerald-100 text-emerald-700'}`}
                                      style={{ left: dot.labelSide === 'right' ? '100%' : dot.labelSide === 'left' ? '0%' : '50%', top: dot.labelSide === 'bottom' ? '100%' : dot.labelSide === 'top' ? '0%' : '50%', transform: labelTransform }}
                                    >
                                      {occupant.name}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                            <div className="pointer-events-none px-2">
                              <i className={`fas ${cfg.icon} text-sm`} />
                              <div className="mt-1 text-[11px] font-black leading-tight">{item.label}</div>
                              {typeof item.seats === 'number' ? <div className="mt-1 text-[10px] font-black opacity-80">{item.seats} sillas</div> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-6 rounded-[24px] border border-[#e6d6df] bg-[#fffafb] p-4 text-sm leading-6 text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,.04)]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Importación y compatibilidad</p>
        <p className="mt-2">La importación sigue aceptando columnas como nombre, telefono, email, genero, mesa, comida, acompanantes, estado y lado, además de sus variantes en inglés.</p>
      </div>
    </section>
  );
}

function WebsitePreview({
  eventInfo,
  guests,
  layout,
  webSections,
  rsvpConfirmed,
  rsvpPending,
  onConfirm,
  backgroundUrl,
  viewport = 'desktop',
  frameLabel,
  inviteeName,
  confirmLabel = 'Confirmar asistencia',
  confirmDisabled = false,
  selectedSectionId,
  onSelectSection,
  onEditSection,
  onRequestImageEdit,
  onMoveSection,
  onInsertSectionAfter,
  onRemoveSection,
  onReorderSection,
  onDuplicateSection,
  onToggleSectionVisibility,
  onUpdateEventInfo,
  canvasItems = [],
  selectedCanvasItemId,
  onSelectCanvasItem,
  onUpdateCanvasItem,
  onRemoveCanvasItem,
  onRequestCanvasImage,
  publicRsvpForm,
  onPublicRsvpFormChange,
  publicRsvpMode = 'linked',
}: {
  eventInfo: EventInfo;
  guests: Guest[];
  layout: LayoutElement[];
  webSections: WebSection[];
  rsvpConfirmed: number;
  rsvpPending: number;
  onConfirm: () => void;
  backgroundUrl: string;
  viewport?: WebsiteViewport;
  frameLabel?: string;
  inviteeName?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  selectedSectionId?: string;
  onSelectSection?: (id: string) => void;
  onEditSection?: (id: string, patch: Partial<WebSection>) => void;
  onRequestImageEdit?: (id: string, slot: 'imageUrl' | 'secondaryImageUrl') => void;
  onMoveSection?: (id: string, direction: -1 | 1) => void;
  onInsertSectionAfter?: (id: string, type: WebSection['type']) => void;
  onRemoveSection?: (id: string) => void;
  onReorderSection?: (sourceId: string, targetId: string) => void;
  onDuplicateSection?: (id: string) => void;
  onToggleSectionVisibility?: (id: string) => void;
  onUpdateEventInfo?: (patch: Partial<EventInfo>) => void;
  canvasItems?: CanvasItem[];
  selectedCanvasItemId?: string;
  onSelectCanvasItem?: (id: string) => void;
  onUpdateCanvasItem?: (id: string, patch: Partial<CanvasItem>) => void;
  onRemoveCanvasItem?: (id: string) => void;
  onRequestCanvasImage?: (id: string) => void;
  publicRsvpForm?: { name: string; email: string; phone: string };
  onPublicRsvpFormChange?: (patch: Partial<{ name: string; email: string; phone: string }>) => void;
  publicRsvpMode?: 'linked' | 'collect';
}) {
  const [countdownNow] = useState(() => Date.now());
  const targetDate = useMemo(() => new Date(eventInfo.date), [eventInfo.date]);
  const diff = targetDate.getTime() - countdownNow;
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const pageStyle = backgroundUrl
    ? {
        backgroundImage: `linear-gradient(180deg,rgba(255,255,255,.25),rgba(255,255,255,.88)), url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;
  const isMobile = viewport === 'mobile';
  const isTablet = viewport === 'tablet';
  const tableSummaries = useMemo(() => getTableSummaries(layout, guests), [guests, layout]);
  const visibleSections = useMemo(() => webSections.filter((section) => section.visible), [webSections]);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const previewContentRef = useRef<HTMLDivElement | null>(null);
  const [draggedCanvasItem, setDraggedCanvasItem] = useState<{ id: string; offsetX: number; offsetY: number; left: number; top: number; width: number; height: number } | null>(null);
  const [resizingCanvasItem, setResizingCanvasItem] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number; rectW: number; rectH: number } | null>(null);
  const [resizingSection, setResizingSection] = useState<{ id: string; startY: number; startHeight: number } | null>(null);
  const [editingCanvasTextId, setEditingCanvasTextId] = useState<string | null>(null);
  const isEditing = Boolean(onEditSection || onUpdateCanvasItem || onRequestImageEdit);
  const activeCanvasItem = useMemo(
    () => canvasItems.find((item) => item.id === selectedCanvasItemId) || null,
    [canvasItems, selectedCanvasItemId],
  );
  const getSectionCanvasItems = (sectionId: string) =>
    canvasItems.filter(
      (item) =>
        item.visible &&
        item.id.startsWith(`${CANVAS_CONTENT_PREFIX}${sectionId}-`) &&
        (isEditing || item.type !== 'image' || item.imageUrl),
    );

  const startCanvasItemDrag = (
    event: MouseEvent<HTMLDivElement>,
    item: CanvasItem,
    scoped = false,
  ) => {
    if (!onUpdateCanvasItem) return;
    if (event.target instanceof HTMLElement) {
      if (event.target.closest('button,input,textarea,select,[data-canvas-control="true"]')) return;
      if (editingCanvasTextId === item.id && event.target.closest('[contenteditable="true"]')) return;
    }
    event.stopPropagation();
    onSelectCanvasItem?.(item.id);
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const scope = scoped
      ? event.currentTarget.closest('[data-canvas-scope="section"]')?.getBoundingClientRect()
      : previewContentRef.current?.getBoundingClientRect();
    if (!scope) return;
    setDraggedCanvasItem({
      id: item.id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      left: scope.left,
      top: scope.top,
      width: scope.width,
      height: scope.height,
    });
  };

  const beginCanvasTextEdit = (item: CanvasItem) => {
    if (!onUpdateCanvasItem || item.type === 'image' || item.type === 'shape') return;
    onSelectCanvasItem?.(item.id);
    setDraggedCanvasItem(null);
    setEditingCanvasTextId(item.id);
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-canvas-text-id="${item.id}"]`);
      target?.focus();
    }, 0);
  };

  const finishSectionDrop = (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId) {
      setDropTargetId(null);
      setDraggedSectionId(null);
      return;
    }
    onReorderSection?.(draggedSectionId, targetId);
    setDropTargetId(null);
    setDraggedSectionId(null);
  };

  const moveCanvasItemByClient = useCallback((clientX: number, clientY: number) => {
    if (resizingSection && onEditSection) {
      const delta = clientY - resizingSection.startY;
      onEditSection(resizingSection.id, { minHeight: clamp(Math.round(resizingSection.startHeight + delta / 8), 32, 110) });
      return;
    }
    if (resizingCanvasItem && onUpdateCanvasItem) {
      const item = canvasItems.find((entry) => entry.id === resizingCanvasItem.id);
      if (!item) return;
      const nextW = clamp(resizingCanvasItem.startW + ((clientX - resizingCanvasItem.startX) / resizingCanvasItem.rectW) * 100, 6, 96 - item.x);
      const nextH = clamp(resizingCanvasItem.startH + ((clientY - resizingCanvasItem.startY) / resizingCanvasItem.rectH) * 100, 2.5, 92 - item.y);
      onUpdateCanvasItem(item.id, { w: nextW, h: nextH });
      return;
    }
    if (!draggedCanvasItem || !onUpdateCanvasItem) return;
    const item = canvasItems.find((entry) => entry.id === draggedCanvasItem.id);
    if (!item) return;
    const nextX = clamp(((clientX - draggedCanvasItem.left - draggedCanvasItem.offsetX) / draggedCanvasItem.width) * 100, 0, 100 - item.w);
    const nextY = clamp(((clientY - draggedCanvasItem.top - draggedCanvasItem.offsetY) / draggedCanvasItem.height) * 100, 0, 100 - item.h);
    onUpdateCanvasItem(item.id, { x: nextX, y: nextY });
  }, [canvasItems, draggedCanvasItem, onEditSection, onUpdateCanvasItem, resizingCanvasItem, resizingSection]);

  const finishCanvasInteraction = () => {
    setDraggedCanvasItem(null);
    setResizingCanvasItem(null);
    setResizingSection(null);
  };

  const moveCanvasItem = (event: MouseEvent<HTMLDivElement>) => {
    moveCanvasItemByClient(event.clientX, event.clientY);
  };

  useEffect(() => {
    if (!draggedCanvasItem && !resizingCanvasItem && !resizingSection) return undefined;

    const handleMove = (event: globalThis.MouseEvent) => {
      event.preventDefault();
      moveCanvasItemByClient(event.clientX, event.clientY);
    };
    const handleUp = () => finishCanvasInteraction();

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [draggedCanvasItem, resizingCanvasItem, resizingSection, moveCanvasItemByClient]);

  return (
    <div className={`w-full overflow-hidden rounded-[28px] border border-[#ead9e7] bg-white shadow-[0_20px_50px_rgba(0,0,0,.18)] ${isMobile ? 'mx-auto max-w-[420px]' : isTablet ? 'mx-auto max-w-[860px]' : 'max-w-none'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>{frameLabel || 'https://rifaticket.app/invitacion/demo'}</span>
        <span>{isMobile ? 'Vertical preview' : isTablet ? 'Tablet preview' : 'Desktop preview'}</span>
      </div>
      <div
        ref={previewCanvasRef}
        spellCheck={false}
        onMouseMove={moveCanvasItem}
        onMouseUp={finishCanvasInteraction}
        className={`relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.82)),radial-gradient(circle_at_top,rgba(251,113,133,.18),transparent_32%),linear-gradient(135deg,#fff6fb,#fff7ed)] text-slate-900 ${isMobile ? 'min-h-[760px] p-5' : isTablet ? 'min-h-[720px] p-6 md:p-8' : 'min-h-[720px] p-8 lg:p-12'}`}
        style={pageStyle}
      >
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(236,72,153,.22),transparent_65%)]" />
        {activeCanvasItem && onUpdateCanvasItem ? (
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="sticky left-4 top-4 z-[70] mb-4 flex max-w-full flex-wrap items-center gap-2 rounded-[18px] border border-pink-300/18 bg-[#160416]/94 p-2 text-pink-50 shadow-[0_18px_36px_rgba(0,0,0,.28)] backdrop-blur"
          >
            <span className="rounded-full bg-pink-400/18 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-pink-100">
              {activeCanvasItem.label}
            </span>
            {activeCanvasItem.type !== 'image' ? (
              <>
                <button type="button" onClick={() => onUpdateCanvasItem(activeCanvasItem.id, { fontSize: activeCanvasItem.fontSize - 2 })} className="flex h-9 w-9 items-center justify-center rounded-full border border-pink-300/14 bg-white/[0.06] font-black">-</button>
                <span className="min-w-[48px] text-center text-xs font-black">{activeCanvasItem.fontSize}px</span>
                <button type="button" onClick={() => onUpdateCanvasItem(activeCanvasItem.id, { fontSize: activeCanvasItem.fontSize + 2 })} className="flex h-9 w-9 items-center justify-center rounded-full border border-pink-300/14 bg-white/[0.06] font-black">+</button>
                <select value={activeCanvasItem.fontFamily} onChange={(event) => onUpdateCanvasItem(activeCanvasItem.id, { fontFamily: event.target.value })} className="h-9 rounded-full border border-pink-300/14 bg-black/18 px-3 text-xs font-black text-white outline-none">
                  {FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </>
            ) : null}
            {['#ffffff', '#ffe4f1', '#ec4899', '#8b5cf6', '#111827', '#f97316'].map((color) => (
              <button key={color} type="button" onClick={() => onUpdateCanvasItem(activeCanvasItem.id, { background: color, backgroundOpacity: color === '#ffffff' ? 0.7 : 0.9 })} className="h-8 w-8 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: color }} />
            ))}
            <button type="button" onClick={() => onUpdateCanvasItem(activeCanvasItem.id, { backgroundOpacity: 0 })} className="h-9 rounded-full border border-pink-300/14 bg-white/[0.06] px-3 text-xs font-black text-pink-50">Sin fondo</button>
            {activeCanvasItem.type === 'image' ? (
              <button type="button" onClick={() => onRequestCanvasImage?.(activeCanvasItem.id)} className="h-9 rounded-full bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-3 text-xs font-black text-white">Cambiar imagen</button>
            ) : null}
          </div>
        ) : null}
        <div ref={previewContentRef} className={`relative mx-auto ${isMobile ? 'max-w-[360px]' : isTablet ? 'max-w-4xl' : 'max-w-6xl'}`}>
          {visibleSections.map((section) => {
            const isSelected = selectedSectionId === section.id;
            const isDropTarget = dropTargetId === section.id && draggedSectionId !== section.id;
            const sectionCanvasItems = getSectionCanvasItems(section.id);
            const sectionCanvasOwnsContent = sectionCanvasItems.length > 0;
            const cardClass = `relative mb-8 overflow-hidden rounded-[28px] border transition ${onSelectSection ? 'cursor-pointer' : ''} ${isSelected ? 'ring-4 ring-pink-300/40 ring-offset-2 ring-offset-transparent' : ''} ${isDropTarget ? 'ring-4 ring-sky-200/70 ring-offset-2 ring-offset-transparent' : ''}`;
            const alignClass = getSectionAlignClass(section.align);
            const justifyClass = section.align === 'right' ? 'justify-end' : section.align === 'center' ? 'justify-center' : 'justify-start';
            const sectionLabel = getWebsiteSectionLabel(section.type);
            const coverBackground = section.layout === 'cover' && section.imageUrl
              ? {
                  backgroundImage: `linear-gradient(180deg,rgba(12,6,19,.26),rgba(12,6,19,.18)), url(${section.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined;
            const sectionMinHeight = section.type === 'hero'
              ? section.minHeight
              : Math.min(section.minHeight, section.layout === 'gallery' ? 58 : 50);
            const surfaceStyle = {
              backgroundColor: section.backgroundColor,
              color: section.textColor,
              fontFamily: section.fontFamily,
              ...(coverBackground || {}),
            } as React.CSSProperties;
            const sectionToolbar = isSelected && isEditing ? (
              <div className="absolute left-4 top-4 z-50 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-1.5 rounded-[16px] border border-white/45 bg-slate-950/86 p-1.5 text-white shadow-[0_16px_32px_rgba(15,23,42,.25)] backdrop-blur">
                <button type="button" title="Mover arriba" onClick={(event) => { event.stopPropagation(); onMoveSection?.(section.id, -1); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black hover:bg-white/20">
                  <i className="fas fa-arrow-up text-xs" />
                  Subir
                </button>
                <button type="button" title="Mover abajo" onClick={(event) => { event.stopPropagation(); onMoveSection?.(section.id, 1); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black hover:bg-white/20">
                  <i className="fas fa-arrow-down text-xs" />
                  Bajar
                </button>
                <button type="button" title="Duplicar seccion" onClick={(event) => { event.stopPropagation(); onDuplicateSection?.(section.id); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black hover:bg-white/20">
                  <i className="fas fa-copy text-xs" />
                  Copiar
                </button>
                <button type="button" title={section.visible ? 'Ocultar seccion' : 'Mostrar seccion'} onClick={(event) => { event.stopPropagation(); onToggleSectionVisibility?.(section.id); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-black hover:bg-white/20">
                  <i className={`fas ${section.visible ? 'fa-eye' : 'fa-eye-slash'} text-xs`} />
                  {section.visible ? 'Ocultar' : 'Mostrar'}
                </button>
                <select
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const value = event.target.value as WebSection['type'] | '';
                    if (value) onInsertSectionAfter?.(section.id, value);
                    event.target.value = '';
                  }}
                  defaultValue=""
                  className="h-9 rounded-full border border-white/10 bg-black/35 px-3 text-xs font-black text-white outline-none"
                >
                  <option value="">Agregar abajo...</option>
                  {WEBSITE_SECTION_OPTIONS.map((option) => (
                    <option key={option.type} value={option.type}>{option.label}</option>
                  ))}
                </select>
                <button type="button" title="Eliminar seccion" onClick={(event) => { event.stopPropagation(); onRemoveSection?.(section.id); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-rose-500 px-3 text-xs font-black text-white hover:bg-rose-600">
                  <i className="fas fa-trash text-xs" />
                  Eliminar
                </button>
              </div>
            ) : null;
            const renderCanvasItem = (item: CanvasItem, scoped = false) => {
              const selectedCanvas = selectedCanvasItemId === item.id;
              return (
                <div
                  key={item.id}
                  onMouseDown={(event) => startCanvasItemDrag(event, item, scoped)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    beginCanvasTextEdit(item);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onUpdateCanvasItem) {
                      if (selectedCanvas && item.type !== 'image' && item.type !== 'shape' && editingCanvasTextId !== item.id) {
                        beginCanvasTextEdit(item);
                        return;
                      }
                      onSelectCanvasItem?.(item.id);
                      return;
                    }
                    if (item.type === 'button') onConfirm();
                  }}
                  className={`absolute flex items-center justify-center overflow-hidden border text-center shadow-[0_18px_38px_rgba(15,23,42,.16)] transition ${editingCanvasTextId === item.id ? 'cursor-text select-text' : 'select-none'} ${onUpdateCanvasItem ? editingCanvasTextId === item.id ? '' : 'cursor-move' : item.type === 'button' ? 'cursor-pointer' : ''} ${selectedCanvas && isEditing ? 'ring-4 ring-pink-400/40' : isEditing ? 'hover:ring-2 hover:ring-pink-200/60' : ''}`}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    width: `${item.w}%`,
                    height: `${item.h}%`,
                    zIndex: item.zIndex,
                    color: item.color,
                    background: item.type === 'image' && item.imageUrl ? `url(${item.imageUrl}) center/cover` : hexToRgba(item.background, item.backgroundOpacity),
                    borderRadius: item.radius,
                    borderColor: selectedCanvas && isEditing ? 'rgba(236,72,153,.72)' : item.borderColor,
                    borderWidth: item.borderWidth,
                    fontFamily: item.fontFamily,
                    fontSize: `${item.fontSize}px`,
                    lineHeight: 1.05,
                    opacity: item.opacity,
                    transform: `rotate(${item.rotate}deg)`,
                  }}
                >
                  {item.type === 'image' && !item.imageUrl ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRequestCanvasImage?.(item.id);
                      }}
                      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white/75 text-xs font-black text-slate-500"
                    >
                      <i className="fas fa-image text-2xl" />
                      Cargar imagen
                    </button>
                  ) : item.type === 'shape' ? null : (
                    <span
                      contentEditable={!!onUpdateCanvasItem && editingCanvasTextId === item.id}
                      suppressContentEditableWarning
                      onBlur={(event) => {
                        onUpdateCanvasItem?.(item.id, { text: event.currentTarget.textContent || item.text });
                        setEditingCanvasTextId(null);
                      }}
                      onMouseDown={(event) => {
                        if (editingCanvasTextId === item.id) event.stopPropagation();
                      }}
                      data-canvas-text-id={item.id}
                      className={`w-full px-3 font-black outline-none ${editingCanvasTextId === item.id ? 'cursor-text' : 'cursor-move'}`}
                    >
                      {item.text}
                    </span>
                  )}

                  {selectedCanvas && isEditing ? (
                    <>
                      <div data-canvas-drag-handle="true" className="absolute -left-1 -top-1 flex h-7 min-w-7 cursor-move items-center justify-center rounded-full bg-pink-500 px-2 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow" title="Arrastrar">
                        <i className="fas fa-up-down-left-right" />
                      </div>
                      <div className="absolute -right-1 -top-1 flex gap-1">
                        <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateCanvasItem?.(item.id, { fontSize: item.fontSize - 2 }); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                          <i className="fas fa-minus text-xs" />
                        </button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateCanvasItem?.(item.id, { fontSize: item.fontSize + 2 }); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                          <i className="fas fa-plus text-xs" />
                        </button>
                        {item.type === 'image' ? (
                          <button type="button" onClick={(event) => { event.stopPropagation(); onRequestCanvasImage?.(item.id); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                            <i className="fas fa-image text-xs" />
                          </button>
                        ) : null}
                        <button type="button" onClick={(event) => { event.stopPropagation(); onRemoveCanvasItem?.(item.id); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white shadow">
                          <i className="fas fa-xmark text-xs" />
                        </button>
                      </div>
                      <button
                        type="button"
                        title="Cambiar tamano"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const scope = scoped
                            ? event.currentTarget.closest('[data-canvas-scope="section"]')?.getBoundingClientRect()
                            : previewContentRef.current?.getBoundingClientRect();
                          if (!scope) return;
                          setDraggedCanvasItem(null);
                          setResizingCanvasItem({ id: item.id, startX: event.clientX, startY: event.clientY, startW: item.w, startH: item.h, rectW: scope.width, rectH: scope.height });
                        }}
                        className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize rounded-tl-lg bg-pink-500 shadow-[0_8px_16px_rgba(236,72,153,.34)]"
                      />
                    </>
                  ) : null}
                </div>
              );
            };

            if (section.type === 'seatingMap') {
              return (
                <section
                  key={section.id}
                  draggable={false}
                  onDragStart={(event) => {
                    if (!onReorderSection) return;
                    setDraggedSectionId(section.id);
                    setDropTargetId(null);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggedSectionId(null);
                    setDropTargetId(null);
                  }}
                  onClick={() => onSelectSection?.(section.id)}
                  onDragOver={(event) => {
                    if (!onReorderSection || !draggedSectionId || draggedSectionId === section.id) return;
                    event.preventDefault();
                    setDropTargetId(section.id);
                  }}
                  onDragLeave={() => {
                    if (dropTargetId === section.id) setDropTargetId(null);
                  }}
                  onDrop={(event) => {
                    if (!onReorderSection) return;
                    event.preventDefault();
                    finishSectionDrop(section.id);
                  }}
                  className={cardClass}
                  style={{ borderColor: `${section.accentColor}33` }}
                >
                  <div data-canvas-scope="section" className="relative px-6 py-8 md:px-10 md:py-12" style={{ ...surfaceStyle, minHeight: isMobile ? `${Math.max(42, sectionMinHeight * 0.72)}vh` : `${sectionMinHeight}vh` }}>
                    {sectionToolbar}
                    {isSelected && isEditing ? (
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setResizingSection({ id: section.id, startY: event.clientY, startHeight: section.minHeight });
                        }}
                        className="absolute inset-x-0 bottom-0 z-40 mx-auto h-6 w-40 cursor-ns-resize rounded-t-2xl bg-pink-500/80 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_12px_28px_rgba(236,72,153,.32)]"
                      >
                        Estirar seccion
                      </button>
                    ) : null}
                    <div className={`relative z-10 ${isMobile ? 'space-y-6' : 'grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-start'}`}>
                      <div className={`flex flex-col ${getSectionAlignClass(section.align)}`}>
                        <p
                          contentEditable={!!onEditSection}
                          suppressContentEditableWarning
                          onBlur={(event) => onEditSection?.(section.id, { eyebrow: event.currentTarget.textContent || section.eyebrow })}
                          className="text-sm font-black uppercase tracking-[0.28em] outline-none"
                          style={{ color: section.accentColor }}
                        >
                          {section.eyebrow || sectionLabel}
                        </p>
                        <h3
                          contentEditable={!!onEditSection}
                          suppressContentEditableWarning
                          onBlur={(event) => onEditSection?.(section.id, { title: event.currentTarget.textContent || section.title })}
                          className="mt-4 font-black tracking-tight outline-none"
                          style={{ fontSize: `${Math.max(28, section.titleSize * (isMobile ? 0.68 : 1))}px`, lineHeight: 1.02 }}
                        >
                          {section.title || SECTION_EXAMPLES.seatingMap.title}
                        </h3>
                        <p
                          contentEditable={!!onEditSection}
                          suppressContentEditableWarning
                          onBlur={(event) => onEditSection?.(section.id, { content: event.currentTarget.textContent || section.content })}
                          className="mt-5 whitespace-pre-line outline-none"
                          style={{ fontSize: `${Math.max(14, section.bodySize * (isMobile ? 0.92 : 1))}px`, lineHeight: 1.7 }}
                        >
                          {section.content}
                        </p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
                          {tableSummaries.slice(0, 6).map((tableItem) => (
                            <div key={tableItem.id} className={`rounded-[18px] border p-4 ${tableItem.overflow ? 'border-rose-400/26 bg-rose-500/10' : 'border-white/40 bg-white/55'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-black">{tableItem.label}</p>
                                <span className="rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: `${section.accentColor}20`, color: section.accentColor }}>{tableItem.assignedSeats}/{tableItem.seats || 'libre'}</span>
                              </div>
                              <p className="mt-2 text-sm opacity-70">{tableItem.overflow ? 'Capacidad excedida' : `${tableItem.freeSeats} libres`}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/40 bg-white/55 p-4 shadow-[0_24px_48px_rgba(15,23,42,.12)]">
                        <div
                          className="relative w-full overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(#ece6ef_1px,transparent_1px),linear-gradient(90deg,#ece6ef_1px,transparent_1px),linear-gradient(180deg,#fff,#fdf8ff)] bg-[length:24px_24px,24px_24px,100%_100%]"
                          style={{ aspectRatio: `${BOARD_W} / ${BOARD_H}`, minHeight: isMobile ? 240 : 320 }}
                        >
                          {layout.map((item) => {
                            const tableItem = tableSummaries.find((summary) => summary.label === item.label);
                            const cfg = elementConfig[item.type];
                            return (
                              <div
                                key={`website-${item.id}`}
                                className="absolute flex items-center justify-center border text-center shadow-[0_14px_32px_rgba(15,23,42,.12)]"
                                style={{
                                  left: `${(item.x / BOARD_W) * 100}%`,
                                  top: `${(item.y / BOARD_H) * 100}%`,
                                  width: `${(item.w / BOARD_W) * 100}%`,
                                  height: `${(item.h / BOARD_H) * 100}%`,
                                  borderRadius: cfg.borderRadius,
                                  background: cfg.gradient,
                                  color: cfg.textColor,
                                  borderColor: 'rgba(255,255,255,.35)',
                                }}
                              >
                                <div className="pointer-events-none px-2">
                                  <div className="text-[10px] font-black leading-tight md:text-xs">{item.label}</div>
                                  {tableItem ? <div className="mt-1 text-[10px] font-black opacity-80">{tableItem.assignedSeats}/{tableItem.seats || 'libre'}</div> : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {sectionCanvasItems.map((item) => renderCanvasItem(item, true))}
                  </div>
                </section>
              );
            }

            const textBlock = sectionCanvasOwnsContent ? null : (
              <div className={`relative z-10 flex h-full flex-col justify-center ${alignClass}`}>
                {isSelected ? <span className="absolute right-0 top-0 rounded-full bg-pink-500/86 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">Editando</span> : null}

                {section.type === 'hero' ? (
                  <p
                    contentEditable={!!onUpdateEventInfo}
                    suppressContentEditableWarning
                    onBlur={(event) => onUpdateEventInfo?.({ type: event.currentTarget.textContent || eventInfo.type })}
                    className="text-sm font-black uppercase tracking-[0.28em] outline-none focus:ring-2 focus:ring-pink-300/50"
                    style={{ color: section.accentColor }}
                  >
                    {eventInfo.type || 'Tipo de evento'}
                  </p>
                ) : (
                  <p
                    contentEditable={!!onEditSection}
                    suppressContentEditableWarning
                    onBlur={(event) => onEditSection?.(section.id, { eyebrow: event.currentTarget.textContent || section.eyebrow })}
                    className="text-sm font-black uppercase tracking-[0.28em] outline-none focus:ring-2 focus:ring-pink-300/50"
                    style={{ color: section.accentColor }}
                  >
                    {section.eyebrow || sectionLabel}
                  </p>
                )}

                {section.type === 'hero' ? (
                  <>
                    <h2
                      contentEditable={!!onUpdateEventInfo}
                      suppressContentEditableWarning
                      onBlur={(event) => onUpdateEventInfo?.({ name: event.currentTarget.textContent || eventInfo.name })}
                      className="mt-4 font-black tracking-tight outline-none focus:ring-2 focus:ring-pink-300/50"
                      style={{ fontSize: `${Math.max(34, section.titleSize * (isMobile ? 0.72 : 1))}px`, lineHeight: 1.02 }}
                    >
                      {eventInfo.name || 'Nombre del evento'}
                    </h2>
                    <div className={`mt-5 flex flex-wrap gap-3 ${justifyClass}`}>
                      <span
                        contentEditable={!!onUpdateEventInfo}
                        suppressContentEditableWarning
                        onBlur={(event) => onUpdateEventInfo?.({ date: event.currentTarget.textContent || eventInfo.date })}
                        className="rounded-full border border-white/60 px-4 py-2 font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(15,23,42,.18)] outline-none focus:ring-2 focus:ring-pink-300/50"
                        style={{ backgroundColor: hexToRgba(section.accentColor, 0.88), fontSize: `${Math.max(11, section.bodySize * 0.72)}px` }}
                      >
                        {eventInfo.date || 'Fecha del evento'}
                      </span>
                      <span
                        contentEditable={!!onUpdateEventInfo}
                        suppressContentEditableWarning
                        onBlur={(event) => onUpdateEventInfo?.({ venue: event.currentTarget.textContent || eventInfo.venue })}
                        className="rounded-full border border-white/60 px-4 py-2 font-black uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(15,23,42,.18)] outline-none focus:ring-2 focus:ring-pink-300/50"
                        style={{ backgroundColor: hexToRgba(section.accentColor, 0.88), fontSize: `${Math.max(11, section.bodySize * 0.72)}px` }}
                      >
                        {eventInfo.venue || 'Lugar del evento'}
                      </span>
                    </div>
                  </>
                ) : section.type === 'countdown' ? (
                  <>
                    <h3
                      contentEditable={!!onEditSection}
                      suppressContentEditableWarning
                      onBlur={(event) => onEditSection?.(section.id, { title: event.currentTarget.textContent || section.title })}
                      className="mt-4 font-black tracking-tight outline-none focus:ring-2 focus:ring-pink-300/50"
                      style={{ fontSize: `${Math.max(28, section.titleSize * (isMobile ? 0.58 : 0.7))}px`, lineHeight: 1.04 }}
                    >
                      {section.title || SECTION_EXAMPLES.countdown.title}
                    </h3>
                    <p className="mt-5 font-black" style={{ fontSize: `${Math.max(48, section.titleSize * (isMobile ? 1.05 : 1.35))}px`, lineHeight: 0.95 }}>{days}</p>
                  </>
                ) : (
                  <h3
                    contentEditable={!!onEditSection}
                    suppressContentEditableWarning
                    onBlur={(event) => onEditSection?.(section.id, { title: event.currentTarget.textContent || section.title })}
                    className="mt-4 font-black tracking-tight outline-none focus:ring-2 focus:ring-pink-300/50"
                    style={{ fontSize: `${Math.max(28, section.titleSize * (isMobile ? 0.72 : 1))}px`, lineHeight: 1.04 }}
                  >
                    {section.title || SECTION_EXAMPLES[section.type].title}
                  </h3>
                )}

                {inviteeName && section.type === 'hero' ? <p className="mt-3 text-sm font-black uppercase tracking-[0.18em]" style={{ color: section.accentColor }}>Invitacion para {inviteeName}</p> : null}

                <p
                  contentEditable={!!onEditSection}
                  suppressContentEditableWarning
                  onBlur={(event) => onEditSection?.(section.id, { content: event.currentTarget.textContent || section.content })}
                  className="mt-5 max-w-3xl whitespace-pre-line outline-none focus:ring-2 focus:ring-pink-300/50"
                  style={{ fontSize: `${Math.max(14, section.bodySize * (isMobile ? 0.94 : 1))}px`, lineHeight: 1.7 }}
                >
                  {section.content || (section.type === 'countdown' ? `dias para encontrarnos en ${eventInfo.venue}` : '')}
                </p>

                {section.type === 'rsvp' ? (
                  <div className={`mt-8 ${isMobile ? '' : section.align === 'right' ? 'ml-auto' : section.align === 'center' ? 'mx-auto' : ''}`}>
                    <div className={`flex flex-wrap gap-3 ${justifyClass}`}>
                      <div className="rounded-full px-4 py-2 text-sm font-black" style={{ backgroundColor: `${section.accentColor}22`, color: section.accentColor }}>{rsvpConfirmed} confirmados</div>
                      <div className="rounded-full bg-black/10 px-4 py-2 text-sm font-black">{rsvpPending} pendientes</div>
                    </div>
                    {publicRsvpMode === 'collect' && publicRsvpForm ? (
                      <div className="mt-6 grid gap-3 rounded-[24px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_36px_rgba(15,23,42,.08)] backdrop-blur sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Nombre y apellido</span>
                          <input
                            value={publicRsvpForm.name}
                            onChange={(event) => onPublicRsvpFormChange?.({ name: event.target.value })}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            placeholder="Ingresá tu nombre completo"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Email</span>
                          <input
                            value={publicRsvpForm.email}
                            onChange={(event) => onPublicRsvpFormChange?.({ email: event.target.value })}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            placeholder="tu@email.com"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Teléfono</span>
                          <input
                            value={publicRsvpForm.phone}
                            onChange={(event) => onPublicRsvpFormChange?.({ phone: event.target.value })}
                            onClick={(event) => event.stopPropagation()}
                            className="w-full rounded-[16px] border border-[#e4d7df] bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                            placeholder="Ej. +54 9 11 ..."
                          />
                        </label>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={confirmDisabled}
                      onClick={(event) => {
                        if (isSelected && onEditSection) {
                          event.preventDefault();
                          event.stopPropagation();
                          return;
                        }
                        onConfirm();
                      }}
                      className="mt-6 rounded-[18px] px-7 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: section.accentColor }}
                    >
                      <span
                        contentEditable={!!onEditSection}
                        suppressContentEditableWarning
                        onClick={(event) => event.stopPropagation()}
                        onBlur={(event) => onEditSection?.(section.id, { ctaLabel: event.currentTarget.textContent || section.ctaLabel || confirmLabel })}
                        className="outline-none"
                      >
                        {section.ctaLabel || confirmLabel}
                      </span>
                    </button>
                  </div>
                ) : null}

                {section.type === 'map' ? (
                  <div
                    contentEditable={!!onUpdateEventInfo}
                    suppressContentEditableWarning
                    onBlur={(event) => onUpdateEventInfo?.({ venue: event.currentTarget.textContent || eventInfo.venue })}
                    className={`mt-8 inline-flex rounded-full border px-4 py-2 text-sm font-black outline-none ${section.align === 'center' ? 'mx-auto' : section.align === 'right' ? 'ml-auto' : ''}`}
                    style={{ borderColor: `${section.accentColor}50`, color: section.accentColor }}
                  >
                    {eventInfo.venue || 'Lugar del evento'}
                  </div>
                ) : null}
              </div>
            );

            const renderMediaSlot = (slot: 'imageUrl' | 'secondaryImageUrl', label: string, imageUrl: string) => {
              const mediaClass = `group relative min-h-[220px] overflow-hidden rounded-[28px] text-left shadow-[0_20px_40px_rgba(15,23,42,.16)] ${section.layout === 'gallery' ? '' : 'h-full'} ${getMediaRatioClass(section.mediaRatio, isMobile)} ${imageUrl ? 'border border-white/30 bg-cover bg-center' : 'border border-dashed border-slate-300 bg-white/75'}`;
              const mediaStyle = imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined;
              const mediaContent = (
                <>
                  {imageUrl ? <div className={`absolute inset-0 bg-black/10 transition ${isEditing ? 'group-hover:bg-black/24' : ''}`} /> : null}
                  {imageUrl ? (
                    isEditing ? <span className="absolute left-4 top-4 rounded-full bg-slate-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">Tocar para cambiar</span> : null
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <i className="fas fa-image text-3xl"></i>
                      {isEditing ? <span className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">Agregar {label}</span> : null}
                    </div>
                  )}
                </>
              );

              if (!isEditing) {
                return <div className={mediaClass} style={mediaStyle}>{mediaContent}</div>;
              }

              return (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectSection?.(section.id);
                    onRequestImageEdit?.(section.id, slot);
                  }}
                  className={mediaClass}
                  style={mediaStyle}
                >
                  {mediaContent}
                </button>
              );
            };

            const mediaBlock = !sectionCanvasOwnsContent && section.layout !== 'cover' ? (
              <div className={`relative z-10 ${section.layout === 'gallery' ? 'grid gap-4 md:grid-cols-2' : 'h-full'}`}>
                {renderMediaSlot('imageUrl', 'foto principal', section.imageUrl)}
                {section.layout === 'gallery' || section.secondaryImageUrl ? renderMediaSlot('secondaryImageUrl', 'segunda foto', section.secondaryImageUrl) : null}
              </div>
            ) : null;

            return (
              <section
                key={section.id}
                draggable={false}
                onDragStart={(event) => {
                  if (!onReorderSection) return;
                  setDraggedSectionId(section.id);
                  setDropTargetId(null);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggedSectionId(null);
                  setDropTargetId(null);
                }}
                onClick={() => onSelectSection?.(section.id)}
                onDragOver={(event) => {
                  if (!onReorderSection || !draggedSectionId || draggedSectionId === section.id) return;
                  event.preventDefault();
                  setDropTargetId(section.id);
                }}
                onDragLeave={() => {
                  if (dropTargetId === section.id) setDropTargetId(null);
                }}
                onDrop={(event) => {
                  if (!onReorderSection) return;
                  event.preventDefault();
                  finishSectionDrop(section.id);
                }}
                className={cardClass}
                style={{ borderColor: `${section.accentColor}33` }}
              >
                <div data-canvas-scope="section" className="relative px-6 py-8 md:px-10 md:py-12" style={{ ...surfaceStyle, minHeight: isMobile ? `${Math.max(42, sectionMinHeight * 0.72)}vh` : `${sectionMinHeight}vh` }}>
                  {sectionToolbar}
                  {isSelected && isEditing ? (
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setResizingSection({ id: section.id, startY: event.clientY, startHeight: section.minHeight });
                      }}
                      className="absolute inset-x-0 bottom-0 z-40 mx-auto h-6 w-40 cursor-ns-resize rounded-t-2xl bg-pink-500/80 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_12px_28px_rgba(236,72,153,.32)]"
                    >
                      Estirar seccion
                    </button>
                  ) : null}
                  {section.layout === 'cover' && section.imageUrl ? <div className="absolute inset-0 bg-black/10" /> : null}
                  {section.layout === 'cover' && isEditing ? (
                    <div className="absolute inset-x-0 bottom-5 z-20 flex justify-end px-5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectSection?.(section.id);
                          onRequestImageEdit?.(section.id, 'imageUrl');
                        }}
                        className="rounded-full bg-slate-950/78 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"
                      >
                        {section.imageUrl ? 'Cambiar portada' : 'Agregar portada'}
                      </button>
                    </div>
                  ) : null}
                  {section.layout === 'split' ? (
                    <div className={`relative z-10 grid h-full gap-8 ${isMobile ? '' : 'md:grid-cols-[1.1fr_.9fr] md:items-center'}`}>
                      {textBlock}
                      {mediaBlock}
                    </div>
                  ) : section.layout === 'gallery' ? (
                    <div className="relative z-10 space-y-8">
                      {textBlock}
                      {mediaBlock}
                    </div>
                  ) : (
                    <div className="relative z-10 flex h-full flex-col justify-end">
                      {textBlock}
                    </div>
                  )}
                  {sectionCanvasItems.map((item) => renderCanvasItem(item, true))}
                </div>
              </section>
            );
          })}

          {canvasItems.filter((item) => item.visible && !isGeneratedCanvasItem(item.id) && (isEditing || item.type !== 'image' || item.imageUrl)).map((item) => {
            const selectedCanvas = selectedCanvasItemId === item.id;
            return (
              <div
                key={item.id}
                onMouseDown={(event) => startCanvasItemDrag(event, item)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  beginCanvasTextEdit(item);
                }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onUpdateCanvasItem) {
                      if (selectedCanvas && item.type !== 'image' && item.type !== 'shape' && editingCanvasTextId !== item.id) {
                        beginCanvasTextEdit(item);
                        return;
                      }
                      onSelectCanvasItem?.(item.id);
                      return;
                    }
                  if (item.type === 'button') onConfirm();
                }}
                className={`absolute flex items-center justify-center overflow-hidden border text-center shadow-[0_18px_38px_rgba(15,23,42,.16)] transition ${editingCanvasTextId === item.id ? 'cursor-text select-text' : 'select-none'} ${onUpdateCanvasItem ? editingCanvasTextId === item.id ? '' : 'cursor-move' : item.type === 'button' ? 'cursor-pointer' : ''} ${selectedCanvas && isEditing ? 'ring-4 ring-pink-400/40' : isEditing ? 'hover:ring-2 hover:ring-pink-200/60' : ''}`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.w}%`,
                  height: `${item.h}%`,
                  zIndex: item.zIndex,
                  color: item.color,
                  background: item.type === 'image' && item.imageUrl ? `url(${item.imageUrl}) center/cover` : hexToRgba(item.background, item.backgroundOpacity),
                  borderRadius: item.radius,
                  borderColor: selectedCanvas && isEditing ? 'rgba(236,72,153,.72)' : item.borderColor,
                  borderWidth: item.borderWidth,
                  fontFamily: item.fontFamily,
                  fontSize: `${item.fontSize}px`,
                  lineHeight: 1.05,
                  opacity: item.opacity,
                  transform: `rotate(${item.rotate}deg)`,
                }}
              >
                {item.type === 'image' && !item.imageUrl ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestCanvasImage?.(item.id);
                    }}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 bg-white/75 text-xs font-black text-slate-500"
                  >
                    <i className="fas fa-image text-2xl" />
                    Cargar imagen
                  </button>
                ) : item.type === 'shape' ? null : (
                  <span
                    contentEditable={!!onUpdateCanvasItem && editingCanvasTextId === item.id}
                    suppressContentEditableWarning
                    onBlur={(event) => {
                      onUpdateCanvasItem?.(item.id, { text: event.currentTarget.textContent || item.text });
                      setEditingCanvasTextId(null);
                    }}
                    onMouseDown={(event) => {
                      if (editingCanvasTextId === item.id) event.stopPropagation();
                    }}
                    data-canvas-text-id={item.id}
                    className={`w-full px-3 font-black outline-none ${editingCanvasTextId === item.id ? 'cursor-text' : 'cursor-move'}`}
                  >
                    {item.text}
                  </span>
                )}

                {selectedCanvas && isEditing ? (
                  <>
                    <div data-canvas-drag-handle="true" className="absolute -left-1 -top-1 flex h-7 min-w-7 cursor-move items-center justify-center rounded-full bg-pink-500 px-2 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow" title="Arrastrar">
                      <i className="fas fa-up-down-left-right" />
                    </div>
                    <div className="absolute -right-1 -top-1 flex gap-1">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateCanvasItem?.(item.id, { fontSize: item.fontSize - 2 }); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                        <i className="fas fa-minus text-xs" />
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateCanvasItem?.(item.id, { fontSize: item.fontSize + 2 }); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                        <i className="fas fa-plus text-xs" />
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateCanvasItem?.(item.id, { backgroundOpacity: item.backgroundOpacity > 0 ? 0 : 0.72 }); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                        <i className="fas fa-droplet-slash text-xs" />
                      </button>
                      {item.type === 'image' ? (
                        <button type="button" onClick={(event) => { event.stopPropagation(); onRequestCanvasImage?.(item.id); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-700 shadow">
                          <i className="fas fa-image text-xs" />
                        </button>
                      ) : null}
                      <button type="button" onClick={(event) => { event.stopPropagation(); onRemoveCanvasItem?.(item.id); }} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white shadow">
                        <i className="fas fa-xmark text-xs" />
                      </button>
                    </div>
                  </>
                ) : null}
                {selectedCanvas && isEditing ? (
                  <button
                    type="button"
                    title="Cambiar tamano"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const rect = previewContentRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      setDraggedCanvasItem(null);
                      setResizingCanvasItem({ id: item.id, startX: event.clientX, startY: event.clientY, startW: item.w, startH: item.h, rectW: rect.width, rectH: rect.height });
                    }}
                    className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize rounded-tl-lg bg-pink-500 shadow-[0_8px_16px_rgba(236,72,153,.34)]"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import InvitationEditorApp from '../components/invitation-editor/InvitationEditorApp';
import { listGlobalCatalog, type GlobalCatalogItem } from '../services/globalCatalog.service';
import { listInvitations, getInvitationDesign, createInvitationDesign, saveInvitationDesign, deleteInvitation, publishInvitation, uploadInvitationImage } from '../services/invitation.service';
import type { InvitationSummary } from '../services/invitation.service';
import type { InvitationDesign } from '../components/invitation-editor/types';
import { TEMPLATES, nextId as nextInvitationId } from '../components/invitation-editor/constants';

function WebsitePanel({
  workspaceId,
  layout,
  onJump,
}: {
  workspaceId?: string | null;
  layout: LayoutElement[];
  onJump: (key: ModuleKey) => void;
}) {
  const [invitations, setInvitations] = useState<InvitationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [design, setDesign] = useState<InvitationDesign | undefined>(undefined);
  const [editingSummary, setEditingSummary] = useState<InvitationSummary | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setInvitationError(null);
    try {
      const list = await listInvitations(workspaceId);
      setInvitations(list);
    } catch (err) {
      console.error('Error loading invitations:', err);
      setInvitationError('No pudimos cargar invitaciones desde el backend. Revisá que el servidor esté levantado y que tu sesión sea válida.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleCreate = async () => {
    if (!workspaceId) return;
    try {
      const now = new Date().toISOString();
      const emptyDesign: InvitationDesign = {
        id: nextInvitationId('inv'),
        name: 'Nueva Invitacion',
        sections: TEMPLATES[0].sections.map((section) => ({
          ...section,
          id: nextInvitationId('sec'),
          elements: section.elements.map((element) => ({ ...element, id: nextInvitationId(element.type) })),
        })),
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: 1,
          workspaceId,
          layout,
        },
      };
      const res = await createInvitationDesign(workspaceId, emptyDesign);
      await handleEdit(res.id);
    } catch (err) {
      console.error('Error creating invitation:', err);
      setInvitationError('No se pudo crear la invitación en el backend.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta invitación?')) return;
    try {
      await deleteInvitation(id);
      await loadList();
    } catch (err) {
      console.error('Error deleting invitation:', err);
      setInvitationError('No se pudo borrar la invitación.');
    }
  };

  const handleEdit = async (id: string) => {
    const sum = invitations.find(i => i.id === id);
    if (sum) setEditingSummary(sum);
    try {
      const d = await getInvitationDesign(id);
      if (d) setDesign(d);
      setEditingId(id);
    } catch (err) {
      console.error('Error loading design:', err);
      setInvitationError('No se pudo abrir el diseño desde el backend.');
    }
  };

  const handlePublishSummary = async (inv: InvitationSummary) => {
    try {
      await publishInvitation(inv.id, !inv.published);
      await loadList();
    } catch (err) {
      console.error('Error publishing invitation:', err);
      setInvitationError('No se pudo cambiar el estado de publicación.');
    }
  };

  const handleCopyInvitationLink = async (inv: InvitationSummary) => {
    if (!inv.publicSlug) return;
    const baseUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    await navigator.clipboard.writeText(`${baseUrl}/i/${inv.publicSlug}`);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (editingId && design) {
    return (
      <div className="fixed inset-0 z-[100] bg-black">
        <InvitationEditorApp
          initialDesign={design}
          initialPublished={editingSummary?.published}
          initialPublicSlug={editingSummary?.publicSlug}
          eventPlanData={layout}
          onSave={async (newDesign) => {
            newDesign.metadata = newDesign.metadata || {} as any;
            newDesign.metadata.layout = layout;
            await saveInvitationDesign(editingId, newDesign);
            await loadList();
          }}
          onPublish={async (published) => {
            const res = await publishInvitation(editingId, published);
            await loadList();
            return res;
          }}
          onBack={() => {
            setEditingId(null);
            setDesign(undefined);
            setEditingSummary(null);
          }}
          onUploadImage={async (file) => {
            if (!workspaceId) throw new Error('No workspace');
            return await uploadInvitationImage(workspaceId, file);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-pink-300">Cargando invitaciones...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Invitaciones digitales</h2>
          <p className="text-slate-500 text-sm mt-1">Crea, publica y comparte invitaciones reales conectadas al backend.</p>
        </div>
        <button onClick={handleCreate} className="px-5 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-2">
          <i className="fas fa-plus" /> Crear invitación
        </button>
      </div>

      {invitationError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {invitationError}
        </div>
      ) : null}

      {invitations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <i className="fas fa-envelope-open-text text-5xl text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Aún no hay invitaciones</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">Crea una invitación visual interactiva para enviar a tus invitados por WhatsApp o email.</p>
          <button onClick={handleCreate} className="mt-6 px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
            Crear la primera
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {invitations.map(inv => (
            <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
              <div className="h-32 bg-slate-50 relative border-b border-slate-100 flex items-center justify-center overflow-hidden">
                {inv.design?.sections?.[0]?.background?.type === 'image' ? (
                  <img src={inv.design.sections[0].background.value} className="w-full h-full object-cover opacity-60" />
                ) : (
                  <div className="w-full h-full" style={{
                    background: inv.design?.sections?.[0]?.background?.type === 'gradient' 
                      ? `linear-gradient(135deg, ${inv.design.sections[0].background.value}, ${inv.design.sections[0].background.secondaryValue})`
                      : inv.design?.sections?.[0]?.background?.value || '#f8fafc'
                  }} />
                )}
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm ${inv.published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.published ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{inv.name || 'Sin título'}</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4 flex items-center gap-1.5">
                  <i className="far fa-clock" /> Actualizado {new Date(inv.updatedAt).toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{inv.eventName || 'Evento actual'}</p>
                <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {inv.published && inv.publicSlug ? (
                    <span className="break-all font-semibold text-slate-700">{`${import.meta.env.VITE_FRONTEND_URL || window.location.origin}/i/${inv.publicSlug}`}</span>
                  ) : (
                    <span>No publicada</span>
                  )}
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <button onClick={() => handleEdit(inv.id)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <i className="fas fa-pen-to-square" /> Editar
                  </button>
                  <a href={inv.publicSlug ? `/i/${inv.publicSlug}` : '#'} target="_blank" rel="noreferrer" onClick={(event) => { if (!inv.publicSlug) event.preventDefault(); }} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${inv.publicSlug ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-50 text-slate-300 pointer-events-none'}`}>
                    <i className="fas fa-eye" /> Previsualizar
                  </a>
                  <button onClick={() => handlePublishSummary(inv)} className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <i className={`fas ${inv.published ? 'fa-eye-slash' : 'fa-rocket'}`} /> {inv.published ? 'Despublicar' : 'Publicar'}
                  </button>
                  {inv.published && inv.publicSlug && (
                    <button onClick={() => handleCopyInvitationLink(inv)} className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                      <i className="fas fa-link" /> Copiar link público
                    </button>
                  )}
                  <button onClick={() => handleDelete(inv.id)} className="col-span-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <i className="fas fa-trash" /> Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeatingPanel({
  layout,
  guests,
  setLayout,
  setGuests,
}: {
  layout: LayoutElement[];
  guests: Guest[];
  setLayout: Dispatch<SetStateAction<LayoutElement[]>>;
  setGuests: Dispatch<SetStateAction<Guest[]>>;
}) {
  const [selectedId, setSelectedId] = useState<string>(layout[0]?.id || '');
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [boardZoom, setBoardZoom] = useState(1.2);
  const [boardTheme, setBoardTheme] = useState<(typeof SEATING_BOARD_THEMES)[number]['value']>('classic');
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    mode: 'round' | 'width' | 'height' | 'both';
  } | null>(null);
  const copiedRef = useRef<LayoutElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const tableSummaries = useMemo(() => getTableSummaries(layout, guests), [guests, layout]);
  const boardThemeConfig = SEATING_BOARD_THEMES.find((item) => item.value === boardTheme) || SEATING_BOARD_THEMES[0];

  const selected = layout.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId || !layout.some((item) => item.id === selectedId)) {
      setSelectedId(layout[0]?.id || '');
      setSelectedSeatIndex(null);
    }
  }, [layout, selectedId]);

  const updateSelected = (patch: Partial<LayoutElement>) => {
    if (!selected) return;
    setLayout((prev) => prev.map((item) => (item.id === selected.id ? { ...item, ...patch } : item)));
  };

  const assignSeat = (table: LayoutElement, seatIndex: number, guestId: string) => {
    setGuests((prev) => {
      const next = prev.map((guest) => {
        const isCurrentSeat = guest.tableId === table.id && guest.seatIndex === seatIndex;
        const companionsData = (guest.companionsData || []).map((companion) => {
          const companionInCurrentSeat = companion.tableId === table.id && companion.seatIndex === seatIndex;
          if (!guestId && companionInCurrentSeat) return { ...companion, tableId: undefined, seatIndex: null };
          if (guestId && companionInCurrentSeat) return { ...companion, tableId: undefined, seatIndex: null };
          return companion;
        });
        if (!guestId && isCurrentSeat) {
          return { ...guest, companionsData, tableId: undefined, seatIndex: null, table: 'Sin mesa' };
        }

        if (guest.id === guestId) {
          return { ...guest, companionsData, tableId: table.id, seatIndex, table: table.label };
        }

        if (guestId && isCurrentSeat) {
          return { ...guest, companionsData, tableId: undefined, seatIndex: null, table: 'Sin mesa' };
        }

        if (guestId && guest.id !== guestId && guest.tableId === table.id && guest.seatIndex === seatIndex) {
          return { ...guest, companionsData, tableId: undefined, seatIndex: null, table: 'Sin mesa' };
        }

        return companionsData === guest.companionsData ? guest : { ...guest, companionsData };
      });
      return next;
    });
    toast(guestId ? 'Invitado asignado al asiento' : 'Asiento liberado', guestId ? 'success' : 'info');
  };

  const addElement = (type: LayoutElementType) => {
    const cfg = elementConfig[type];
    const item: LayoutElement = {
      id: nextId(type),
      type,
      label: cfg.label,
      x: 48 + (layout.length % 5) * 56,
      y: 64 + (layout.length % 4) * 44,
      w: cfg.defaultWidth,
      h: cfg.defaultHeight,
      seats: cfg.defaultSeats,
    };
    setLayout((prev) => [...prev, item]);
    setSelectedId(item.id);
    toast(`${cfg.label} agregado`);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const clone = {
      ...selected,
      id: nextId(selected.type),
      x: clamp(selected.x + 26, 0, BOARD_W - selected.w),
      y: clamp(selected.y + 26, 0, BOARD_H - selected.h),
    };
    setLayout((prev) => [...prev, clone]);
    setSelectedId(clone.id);
    toast('Elemento duplicado');
  };

  const copySelected = () => {
    if (!selected) return;
    copiedRef.current = { ...selected };
    toast('Elemento copiado', 'info');
  };

  const pasteCopied = () => {
    if (!copiedRef.current) return;
    const clone = {
      ...copiedRef.current,
      id: nextId(copiedRef.current.type),
      x: clamp(copiedRef.current.x + 30, 0, BOARD_W - copiedRef.current.w),
      y: clamp(copiedRef.current.y + 30, 0, BOARD_H - copiedRef.current.h),
    };
    setLayout((prev) => [...prev, clone]);
    setSelectedId(clone.id);
    toast('Elemento pegado');
  };

  const removeSelected = () => {
    if (!selected) return;
    setLayout((prev) => prev.filter((item) => item.id !== selected.id));
    setSelectedId('');
    toast('Elemento eliminado', 'warning');
  };

  const startDrag = (event: MouseEvent<HTMLDivElement>, item: LayoutElement) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSelectedId(item.id);
    setDragging({
      id: item.id,
      offsetX: (event.clientX - rect.left) / boardZoom,
      offsetY: (event.clientY - rect.top) / boardZoom,
    });
  };

  const startResize = (
    event: MouseEvent<HTMLButtonElement>,
    item: LayoutElement,
    mode: 'round' | 'width' | 'height' | 'both',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(item.id);
    setResizing({
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      startW: item.w,
      startH: item.h,
      mode,
    });
  };

  const moveDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (resizing) {
      const item = layout.find((entry) => entry.id === resizing.id);
      if (!item) return;
      const deltaX = (event.clientX - resizing.startX) / boardZoom;
      const deltaY = (event.clientY - resizing.startY) / boardZoom;
      let nextW = resizing.startW;
      let nextH = resizing.startH;

      if (resizing.mode === 'round') {
        const size = clamp(resizing.startW + Math.max(deltaX, deltaY), 56, 260);
        nextW = size;
        nextH = size;
      } else {
        if (resizing.mode === 'width' || resizing.mode === 'both') {
          nextW = clamp(resizing.startW + deltaX, 56, 260);
        }
        if (resizing.mode === 'height' || resizing.mode === 'both') {
          nextH = clamp(resizing.startH + deltaY, 40, 260);
        }
      }

      setLayout((prev) =>
        prev.map((entry) => {
          if (entry.id !== resizing.id) return entry;
          return {
            ...entry,
            w: nextW,
            h: nextH,
            x: clamp(entry.x, 0, BOARD_W - nextW),
            y: clamp(entry.y, 0, BOARD_H - nextH),
          };
        }),
      );
      return;
    }

    if (!dragging || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const item = layout.find((entry) => entry.id === dragging.id);
    if (!item) return;
    const nextX = clamp((event.clientX - rect.left) / boardZoom - dragging.offsetX, 0, BOARD_W - item.w);
    const nextY = clamp((event.clientY - rect.top) / boardZoom - dragging.offsetY, 0, BOARD_H - item.h);
    setLayout((prev) => prev.map((entry) => (entry.id === dragging.id ? { ...entry, x: nextX, y: nextY } : entry)));
  };

  const applyPresetLayout = (preset: 'banquet' | 'ceremony' | 'dance') => {
    const nextLayout: LayoutElement[] =
      preset === 'banquet'
        ? [
            { id: 'entrance-banquet', type: 'entrance', label: 'Recepcion', x: 28, y: 28, w: 126, h: 56 },
            { id: 'stage-banquet', type: 'stage', label: 'Escenario', x: 540, y: 22, w: 180, h: 62 },
            { id: 'vip-banquet', type: 'vipTable', label: 'Mesa principal', x: 318, y: 92, w: 116, h: 116, seats: 6 },
            { id: 'round-banquet-1', type: 'roundTable', label: 'Mesa 1', x: 104, y: 170, w: 96, h: 96, seats: 8 },
            { id: 'round-banquet-2', type: 'roundTable', label: 'Mesa 2', x: 246, y: 170, w: 96, h: 96, seats: 8 },
            { id: 'round-banquet-3', type: 'roundTable', label: 'Mesa 3', x: 388, y: 170, w: 96, h: 96, seats: 8 },
            { id: 'round-banquet-4', type: 'roundTable', label: 'Mesa 4', x: 530, y: 170, w: 96, h: 96, seats: 8 },
            { id: 'bar-banquet', type: 'bar', label: 'Barra', x: 40, y: 438, w: 146, h: 54 },
            { id: 'rect-banquet', type: 'rectTable', label: 'Buffet', x: 548, y: 420, w: 162, h: 72, seats: 10 },
          ]
        : preset === 'ceremony'
          ? [
              { id: 'entrance-ceremony', type: 'entrance', label: 'Ingreso', x: 322, y: 470, w: 116, h: 52 },
              { id: 'stage-ceremony', type: 'stage', label: 'Altar / DJ', x: 286, y: 28, w: 188, h: 66 },
              { id: 'vip-ceremony', type: 'vipTable', label: 'Mesa firma', x: 325, y: 132, w: 108, h: 108, seats: 4 },
              { id: 'square-ceremony-left-1', type: 'squareTable', label: 'Fila A', x: 122, y: 160, w: 78, h: 58, seats: 6 },
              { id: 'square-ceremony-left-2', type: 'squareTable', label: 'Fila B', x: 122, y: 242, w: 78, h: 58, seats: 6 },
              { id: 'square-ceremony-left-3', type: 'squareTable', label: 'Fila C', x: 122, y: 324, w: 78, h: 58, seats: 6 },
              { id: 'square-ceremony-right-1', type: 'squareTable', label: 'Fila D', x: 560, y: 160, w: 78, h: 58, seats: 6 },
              { id: 'square-ceremony-right-2', type: 'squareTable', label: 'Fila E', x: 560, y: 242, w: 78, h: 58, seats: 6 },
              { id: 'square-ceremony-right-3', type: 'squareTable', label: 'Fila F', x: 560, y: 324, w: 78, h: 58, seats: 6 },
            ]
          : [
              { id: 'entrance-dance', type: 'entrance', label: 'Ingreso', x: 34, y: 30, w: 126, h: 56 },
              { id: 'dance-dance', type: 'danceFloor', label: 'Pista central', x: 250, y: 170, w: 230, h: 230 },
              { id: 'stage-dance', type: 'stage', label: 'Cabina DJ', x: 274, y: 54, w: 182, h: 60 },
              { id: 'round-dance-1', type: 'roundTable', label: 'Lounge 1', x: 78, y: 156, w: 88, h: 88, seats: 6 },
              { id: 'round-dance-2', type: 'roundTable', label: 'Lounge 2', x: 560, y: 156, w: 88, h: 88, seats: 6 },
              { id: 'round-dance-3', type: 'roundTable', label: 'Lounge 3', x: 92, y: 354, w: 88, h: 88, seats: 6 },
              { id: 'round-dance-4', type: 'roundTable', label: 'Lounge 4', x: 548, y: 354, w: 88, h: 88, seats: 6 },
              { id: 'bar-dance', type: 'bar', label: 'Barra', x: 302, y: 448, w: 126, h: 52 },
            ];

    setLayout(nextLayout);
    setSelectedId(nextLayout[0]?.id || '');
    setSelectedSeatIndex(null);
    toast('Preset de plano aplicado');
  };

  const selectedSeatOccupant =
    selected && selectedSeatIndex !== null ? getSeatOccupant(guests, selected, selectedSeatIndex) : null;
  const assignableGuests = guests
    .filter((guest) => guest.reviewStatus !== 'rejected')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="mx-auto max-w-7xl">
      <SectionHeader
        badge="Plano operativo"
        title="Plano editable con sillas visibles"
        text="Ahora puedes aplicar layouts rapidos, ver las sillas alrededor de cada mesa, arrastrar piezas, estirarlas con manijas visuales y dejar un plano que de verdad sirva para asignar lugares y coordinar al equipo."
      />

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_310px]">
        <aside className="rounded-[28px] border border-pink-300/12 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black text-white">Elementos</h2>
          <p className="mt-2 text-sm leading-6 text-pink-100/58">Agrega mesas, pista, entrada o sectores con visual mas rica que simples cuadrados.</p>
          <div className="mt-5 grid gap-2">
            {palette.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addElement(item.type)}
                className="flex items-center gap-3 rounded-[16px] border border-pink-300/10 bg-black/14 px-4 py-3 text-left text-sm font-black text-pink-50 transition hover:bg-black/22"
              >
                <i className={`fas ${item.icon} w-5 text-center text-pink-200`} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-2">
            <button type="button" onClick={copySelected} className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white">Copiar</button>
            <button type="button" onClick={pasteCopied} className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white">Pegar</button>
            <button type="button" onClick={duplicateSelected} className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white">Duplicar</button>
          </div>

          <div className="mt-6 rounded-[20px] border border-pink-300/10 bg-black/[0.18] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Layouts rapidos</p>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => applyPresetLayout('banquet')} className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-black text-pink-50">Cena formal</button>
              <button type="button" onClick={() => applyPresetLayout('ceremony')} className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-black text-pink-50">Ceremonia</button>
              <button type="button" onClick={() => applyPresetLayout('dance')} className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-black text-pink-50">Pista + lounges</button>
            </div>
          </div>

          <div className="mt-6 rounded-[20px] border border-pink-300/10 bg-black/[0.18] p-4 text-sm leading-6 text-pink-100/70">
            Arrastra para mover. Usa la manija rosa del elemento seleccionado para agrandar o achicar sin cargar medidas a mano.
          </div>
        </aside>

        <div className="rounded-[28px] bg-white p-5 text-slate-900 shadow-[0_24px_52px_rgba(0,0,0,.26)]">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black">Plano del evento</h2>
              <p className="mt-1 text-sm text-slate-500">Arrastra elementos, trabaja con zoom real y cambia la ambientacion del plano segun el tipo de evento.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-rose-50 px-4 py-2 text-xs font-black text-rose-600">Tip: selecciona una mesa y ajusta diametro, alto o sillas</div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                <button type="button" onClick={() => setBoardZoom((prev) => clamp(Number((prev - 0.1).toFixed(2)), 0.8, 1.8))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">-</button>
                <span className="min-w-[58px] text-center text-xs font-black text-slate-700">{Math.round(boardZoom * 100)}%</span>
                <button type="button" onClick={() => setBoardZoom((prev) => clamp(Number((prev + 0.1).toFixed(2)), 0.8, 1.8))} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">+</button>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {SEATING_BOARD_THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                onClick={() => setBoardTheme(theme.value)}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${boardTheme === theme.value ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
              >
                {theme.label}
              </button>
            ))}
          </div>

          <div className="overflow-auto rounded-[28px] border border-slate-200 bg-slate-100/70 p-3">
            <div className="mx-auto" style={{ width: BOARD_W * boardZoom, height: BOARD_H * boardZoom }}>
              <div
                ref={boardRef}
                className="relative overflow-hidden rounded-[28px] border border-slate-200"
                style={{
                  width: BOARD_W,
                  height: BOARD_H,
                  transform: `scale(${boardZoom})`,
                  transformOrigin: 'top left',
                  backgroundImage: boardThemeConfig.backgroundImage,
                  backgroundSize: '100% 100%,28px 28px,28px 28px,100% 100%',
                }}
                onMouseMove={moveDrag}
                onMouseLeave={() => {
                  setDragging(null);
                  setResizing(null);
                }}
                onMouseUp={() => {
                  setDragging(null);
                  setResizing(null);
                }}
              >
                <div className="absolute inset-x-8 top-6 flex items-center justify-center gap-3">
                  <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">Vista cenital</span>
                  <span className="rounded-full bg-white/92 px-4 py-2 text-xs font-black text-slate-700">{boardThemeConfig.label}</span>
                </div>

                {layout.map((item) => {
                  const cfg = elementConfig[item.type];
                  const active = item.id === selectedId;
                  const seatDots = getSeatDots(item);

                  return (
                    <div
                      key={item.id}
                      onMouseDown={(event) => startDrag(event, item)}
                      onClick={() => setSelectedId(item.id)}
                      className={`absolute flex cursor-move select-none items-center justify-center border text-center shadow-[0_20px_36px_rgba(15,23,42,.16)] transition ${active ? 'ring-4 ring-rose-300/40' : 'hover:scale-[1.01]'}`}
                      style={{
                        left: item.x,
                        top: item.y,
                        width: item.w,
                        height: item.h,
                        borderRadius: cfg.borderRadius,
                        background: cfg.gradient,
                        color: cfg.textColor,
                        borderColor: active ? 'rgba(244,114,182,.8)' : 'rgba(255,255,255,.3)',
                      }}
                    >
                  {seatDots.map((dot, index) => {
                    const seatOccupant = getSeatOccupant(guests, item, index);
                    const isSeatSelected = active && selectedSeatIndex === index;
                    const labelTransform =
                      dot.labelSide === 'top'
                        ? 'translate(-50%, calc(-100% - 9px))'
                        : dot.labelSide === 'bottom'
                          ? 'translate(-50%, 9px)'
                          : dot.labelSide === 'left'
                            ? 'translate(calc(-100% - 9px), -50%)'
                            : 'translate(9px, -50%)';

                    return (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          setSelectedId(item.id);
                          setSelectedSeatIndex(index);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(item.id);
                          setSelectedSeatIndex(index);
                        }}
                        className={`absolute h-6 w-6 rounded-full border text-[8px] font-black shadow-sm transition ${seatOccupant ? 'border-emerald-200 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400'} ${isSeatSelected ? 'ring-4 ring-amber-300/70' : ''}`}
                        style={{ left: dot.left, top: dot.top, transform: 'translate(-50%, -50%)' }}
                        title={seatOccupant ? `${seatOccupant.name} - asiento ${index + 1}` : `Asiento ${index + 1}`}
                        aria-label={seatOccupant ? `${seatOccupant.name} en asiento ${index + 1}` : `Asignar asiento ${index + 1}`}
                      >
                        {seatOccupant ? (
                          <>
                            {seatOccupant.name.trim().slice(0, 1).toUpperCase()}
                          <span
                            className="pointer-events-none absolute z-20 max-w-[110px] truncate rounded-full border border-emerald-100 bg-white px-2 py-1 text-[9px] font-black leading-none text-emerald-700 shadow-sm"
                            style={{ left: dot.labelSide === 'right' ? '100%' : dot.labelSide === 'left' ? '0%' : '50%', top: dot.labelSide === 'bottom' ? '100%' : dot.labelSide === 'top' ? '0%' : '50%', transform: labelTransform }}
                          >
                            {seatOccupant.name}
                          </span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}

                  <div className="pointer-events-none px-2">
                    <i className={`fas ${cfg.icon} text-sm`} />
                    <div className="mt-1 text-[11px] font-black leading-tight">{item.label}</div>
                    {typeof item.seats === 'number' ? <div className="mt-1 text-[10px] font-black opacity-80">{item.seats} sillas</div> : null}
                    {isTableLayoutElement(item) ? (
                      <div className="mt-1 text-[10px] font-black opacity-80">
                        {(() => {
                          const summary = tableSummaries.find((entry) => entry.label === item.label);
                          return summary ? `${summary.assignedSeats}/${summary.seats || 'libre'}` : '0/libre';
                        })()}
                      </div>
                    ) : null}
                  </div>

                      {active ? (
                        <>
                          {(item.type === 'roundTable' || item.type === 'vipTable') ? (
                            <button
                              type="button"
                              onMouseDown={(event) => startResize(event, item, 'round')}
                              className="absolute -bottom-3 -right-3 h-7 w-7 rounded-full border-2 border-white bg-pink-500 shadow-[0_10px_24px_rgba(244,114,182,.32)]"
                              aria-label="Ajustar diametro"
                            />
                          ) : (
                            <>
                              <button
                                type="button"
                                onMouseDown={(event) => startResize(event, item, 'width')}
                                className="absolute -right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border-2 border-white bg-pink-500 shadow-[0_10px_24px_rgba(244,114,182,.32)]"
                                aria-label="Ajustar ancho"
                              />
                              <button
                                type="button"
                                onMouseDown={(event) => startResize(event, item, 'height')}
                                className="absolute -bottom-3 left-1/2 h-7 w-7 -translate-x-1/2 rounded-full border-2 border-white bg-violet-500 shadow-[0_10px_24px_rgba(139,92,246,.32)]"
                                aria-label="Ajustar alto"
                              />
                              <button
                                type="button"
                                onMouseDown={(event) => startResize(event, item, 'both')}
                                className="absolute -bottom-3 -right-3 h-7 w-7 rounded-full border-2 border-white bg-pink-500 shadow-[0_10px_24px_rgba(244,114,182,.32)]"
                                aria-label="Ajustar tamano"
                              />
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-pink-300/12 bg-[radial-gradient(circle_at_top,rgba(139,92,246,.18),transparent_38%),rgba(255,255,255,.04)] p-5">
          <h2 className="text-xl font-black text-white">Propiedades</h2>
          {selected ? (
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Nombre</span>
                <input value={selected.label} onChange={(e) => updateSelected({ label: e.target.value })} className="w-full rounded-[16px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
              </label>

              <div className="rounded-[20px] border border-pink-300/10 bg-black/18 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">{selected.type === 'roundTable' || selected.type === 'vipTable' ? 'Diametro' : 'Ancho'}</span>
                  <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white">{Math.round(selected.w)} px</span>
                </div>
                <input
                  type="range"
                  min={56}
                  max={260}
                  value={selected.w}
                  onChange={(e) => {
                    const value = clamp(Number(e.target.value), 56, 260);
                    updateSelected({ w: value, ...(selected.type === 'roundTable' || selected.type === 'vipTable' ? { h: value } : {}) });
                  }}
                  className="mt-4 w-full accent-pink-400"
                />

                {selected.type === 'roundTable' || selected.type === 'vipTable' ? null : (
                  <>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Alto</span>
                      <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white">{Math.round(selected.h)} px</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={260}
                      value={selected.h}
                      onChange={(e) => updateSelected({ h: clamp(Number(e.target.value), 40, 260) })}
                      className="mt-4 w-full accent-violet-400"
                    />
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">X</span>
                  <input type="number" min={0} max={BOARD_W} value={Math.round(selected.x)} onChange={(e) => updateSelected({ x: clamp(Number(e.target.value), 0, BOARD_W - selected.w) })} className="w-full rounded-[16px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Y</span>
                  <input type="number" min={0} max={BOARD_H} value={Math.round(selected.y)} onChange={(e) => updateSelected({ y: clamp(Number(e.target.value), 0, BOARD_H - selected.h) })} className="w-full rounded-[16px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
                </label>
              </div>

              {typeof selected.seats === 'number' ? (
                <div className="rounded-[20px] border border-pink-300/10 bg-black/18 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Sillas</span>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-black text-white">{selected.seats}</span>
                  </div>
                  <input type="range" min={2} max={14} value={selected.seats} onChange={(e) => updateSelected({ seats: clamp(Number(e.target.value), 2, 14) })} className="mt-4 w-full accent-amber-400" />
                </div>
              ) : null}

              {isTableLayoutElement(selected) ? (
                <>
                  <div className="rounded-[20px] border border-pink-300/10 bg-black/18 p-4 text-sm text-pink-100/70">
                    {(() => {
                      const summary = tableSummaries.find((item) => item.id === selected.id);
                      if (!summary) return 'Todavia no hay invitados asignados a esta mesa.';
                      return summary.overflow
                        ? `Mesa excedida: ${summary.assignedSeats}/${summary.seats} lugares ocupados contando acompanantes.`
                        : `Ocupacion actual: ${summary.assignedSeats}/${summary.seats || 'sin limite'} contando acompanantes.`;
                    })()}
                  </div>

                  <div className="rounded-[20px] border border-pink-300/10 bg-black/18 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Sentados en esta mesa</p>
                    <div className="mt-3 grid gap-2">
                      {(() => {
                        const occupants = getVisualSeatOccupants([selected], guests)
                          .filter((occupant) => occupant.tableId === selected.id && occupant.seatIndex !== null && occupant.seatIndex !== undefined)
                          .sort((a, b) => Number(a.seatIndex || 0) - Number(b.seatIndex || 0));
                        if (!occupants.length) {
                          return <p className="rounded-[14px] border border-pink-300/10 bg-white/[0.04] px-3 py-2 text-sm text-pink-100/60">Todavia no hay personas asignadas a sillas.</p>;
                        }
                        return occupants.map((occupant) => (
                          <div key={occupant.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-pink-300/10 bg-white/[0.04] px-3 py-2">
                            <span className="truncate text-sm font-black text-white">{occupant.name}</span>
                            <span className="rounded-full bg-white/[0.08] px-2 py-1 text-xs font-black text-pink-100">Asiento {Number(occupant.seatIndex) + 1}{occupant.virtualSeat ? ' visual' : ''}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-pink-300/10 bg-black/18 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Asignar asiento</p>
                        <p className="mt-2 text-sm leading-5 text-pink-100/66">
                          {selectedSeatIndex === null
                            ? 'Toca una silla del plano para elegirla.'
                            : `Asiento ${selectedSeatIndex + 1}${selectedSeatOccupant ? `: ${selectedSeatOccupant.name}` : ''}`}
                        </p>
                      </div>
                      {selectedSeatIndex !== null ? (
                        <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">{selectedSeatIndex + 1}</span>
                      ) : null}
                    </div>

                    {selectedSeatIndex !== null ? (
                      <div className="mt-4 grid gap-3">
                        <select
                          value={selectedSeatOccupant?.kind === 'guest' ? selectedSeatOccupant.guestId : ''}
                          onChange={(event) => assignSeat(selected, selectedSeatIndex, event.target.value)}
                          className="w-full rounded-[16px] border border-pink-300/14 bg-black/22 px-4 py-3 text-sm font-black text-white outline-none"
                        >
                          <option value="">Sin persona asignada</option>
                          {assignableGuests.map((guest) => {
                            const assignedLabel =
                              guest.tableId && guest.seatIndex !== null && guest.seatIndex !== undefined
                                ? ` - ${guest.table} / asiento ${Number(guest.seatIndex) + 1}`
                                : guest.table && guest.table !== 'Sin mesa'
                                  ? ` - ${guest.table}`
                                  : '';
                            return (
                              <option key={guest.id} value={guest.id}>
                                {guest.name}{assignedLabel}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          onClick={() => assignSeat(selected, selectedSeatIndex, '')}
                          className="rounded-[16px] border border-pink-300/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-pink-50"
                        >
                          Liberar asiento
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}

              <button type="button" onClick={removeSelected} className="w-full rounded-[16px] border border-rose-300/24 bg-rose-500/10 px-4 py-3 text-sm font-black text-rose-100">
                Eliminar elemento
              </button>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-pink-100/58">Selecciona un elemento del plano para editarlo.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function ChecklistPanel({
  checklist,
  setChecklist,
  canEdit,
}: {
  checklist: ChecklistItem[];
  setChecklist: Dispatch<SetStateAction<ChecklistItem[]>>;
  canEdit?: boolean;
}) {
  const [task, setTask] = useState('');
  const [owner, setOwner] = useState('Organizador');

  const rotateStatus = (id: string) => {
    const order: ChecklistStatus[] = ['pending', 'in_progress', 'done'];
    setChecklist((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = order[(order.indexOf(item.status) + 1) % order.length];
        return { ...item, status: next };
      }),
    );
  };

  const addTask = () => {
    if (!task.trim()) return;
    setChecklist((prev) => [{ id: nextId('task'), task: task.trim(), owner: owner.trim() || 'Organizador', status: 'pending' }, ...prev]);
    setTask('');
    toast('Tarea agregada');
  };

  return (
    <section className="mx-auto max-w-6xl">
      <SectionHeader
        badge="Organizacion"
        title="Checklist operativo"
        text="Puedes agregar tareas y cambiar estado sin salir de la misma pantalla. Esto reemplaza la seccion maqueta y deja visible el progreso real."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[28px] border border-pink-300/12 bg-white/[0.04] p-5">
          <div className="grid gap-3">
            {checklist.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-[22px] border border-pink-300/10 bg-black/14 p-4 md:grid-cols-[1fr_150px_190px_auto] md:items-center">
                <p className="font-black text-white">{item.task}</p>
                <StatusPill value={getChecklistStatusLabel(item.status)} />
                <p className="text-sm text-pink-100/58">{item.owner}</p>
                <button type="button" onClick={() => rotateStatus(item.id)} className="rounded-[14px] border border-pink-300/12 px-4 py-2 text-sm font-black text-pink-50">
                  Cambiar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-pink-300/12 bg-[radial-gradient(circle_at_top,rgba(251,113,133,.16),transparent_36%),rgba(255,255,255,.04)] p-5">
          <h2 className="text-xl font-black text-white">Nueva tarea</h2>
          <div className="mt-5 space-y-3">
            <input value={task} onChange={(e) => setTask(e.target.value)} className="w-full rounded-[16px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Ej: Confirmar fotografo" />
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full rounded-[16px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Responsable" />
            <button type="button" onClick={addTask} className="w-full rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-4 py-3 text-sm font-black text-white">Agregar tarea</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ItineraryPanel({
  canEdit,
  itinerary,
  setItinerary,
}: {
  canEdit: boolean;
  itinerary: ItineraryItem[];
  setItinerary: Dispatch<SetStateAction<ItineraryItem[]>>;
}) {
  const [time, setTime] = useState('');
  const [activity, setActivity] = useState('');
  const [place, setPlace] = useState('');
  const [owner, setOwner] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState({
    time: '',
    activity: '',
    place: '',
    owner: '',
  });

  const moveItem = (id: string, direction: -1 | 1) => {
    if (!canEdit) return;
    setItinerary((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const clone = [...prev];
      const [item] = clone.splice(index, 1);
      clone.splice(nextIndex, 0, item);
      return clone;
    });
  };

  const addItem = () => {
    if (!canEdit || !time.trim() || !activity.trim()) return;
    setItinerary((prev) => [...prev, { id: nextId('itinerary'), time: time.trim(), activity: activity.trim(), place: place.trim() || '-', owner: owner.trim() || '-' }]);
    setTime('');
    setActivity('');
    setPlace('');
    setOwner('');
    toast('Bloque agregado al cronograma');
  };

  const startEditing = (item: ItineraryItem) => {
    if (!canEdit) return;
    setEditingId(item.id);
    setEditingDraft({
      time: item.time,
      activity: item.activity,
      place: item.place,
      owner: item.owner,
    });
  };

  const saveEditing = () => {
    if (!canEdit) return;
    if (!editingId || !editingDraft.time.trim() || !editingDraft.activity.trim()) return;
    setItinerary((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              time: editingDraft.time.trim(),
              activity: editingDraft.activity.trim(),
              place: editingDraft.place.trim() || '-',
              owner: editingDraft.owner.trim() || '-',
            }
          : item,
      ),
    );
    setEditingId(null);
    setEditingDraft({ time: '', activity: '', place: '', owner: '' });
    toast('Bloque actualizado');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingDraft({ time: '', activity: '', place: '', owner: '' });
  };

  const removeItem = (id: string) => {
    if (!canEdit) return;
    setItinerary((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) cancelEditing();
    toast('Bloque eliminado', 'warning');
  };

  return (
    <section className="mx-auto max-w-6xl">
      <SectionHeader
        badge="Cronograma"
        title="Planificacion editable por rol"
        text={canEdit ? 'Master y organizadores pueden agregar, editar, eliminar y reordenar bloques del evento.' : 'Esta vista queda en solo lectura para usuarios finales.'}
      />

      <div className={`mb-5 rounded-[24px] border p-4 ${canEdit ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-amber-400/30 bg-amber-400/10'}`}>
        <p className="text-sm font-black text-white">{canEdit ? 'Modo edicion habilitado' : 'Solo lectura'}</p>
        <p className="mt-1 text-sm text-pink-100/70">{canEdit ? 'Puedes agregar y reordenar bloques del evento.' : 'Este rol puede consultar el plan pero no modificarlo.'}</p>
      </div>

      {canEdit ? (
        <div className="mb-5 grid gap-3 rounded-[24px] border border-pink-300/12 bg-white/[0.04] p-4 md:grid-cols-[120px_1fr_1fr_1fr_auto]">
          <input value={time} onChange={(e) => setTime(e.target.value)} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Hora" />
          <input value={activity} onChange={(e) => setActivity(e.target.value)} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Actividad" />
          <input value={place} onChange={(e) => setPlace(e.target.value)} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Lugar" />
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Responsable" />
          <button type="button" onClick={addItem} className="rounded-[14px] bg-white px-4 py-3 text-sm font-black text-[#1b091c]">Agregar</button>
        </div>
      ) : null}

      {canEdit && editingId ? (
        <div className="mb-5 rounded-[24px] border border-pink-300/12 bg-[radial-gradient(circle_at_top,rgba(251,113,133,.14),transparent_36%),rgba(255,255,255,.04)] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Editando bloque</p>
              <p className="mt-1 text-sm text-pink-100/68">Corrige datos o elimina el bloque si ya no corresponde.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={cancelEditing} className="rounded-[14px] border border-pink-300/12 px-4 py-2 text-sm font-black text-pink-50">Cancelar</button>
              <button type="button" onClick={saveEditing} className="rounded-[14px] bg-white px-4 py-2 text-sm font-black text-[#1b091c]">Guardar</button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input value={editingDraft.time} onChange={(e) => setEditingDraft((prev) => ({ ...prev, time: e.target.value }))} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Hora" />
            <input value={editingDraft.activity} onChange={(e) => setEditingDraft((prev) => ({ ...prev, activity: e.target.value }))} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Actividad" />
            <input value={editingDraft.place} onChange={(e) => setEditingDraft((prev) => ({ ...prev, place: e.target.value }))} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Lugar" />
            <input value={editingDraft.owner} onChange={(e) => setEditingDraft((prev) => ({ ...prev, owner: e.target.value }))} className="rounded-[14px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Responsable" />
          </div>
        </div>
      ) : null}

      <div className="rounded-[28px] border border-pink-300/12 bg-white/[0.04] p-5">
        <div className="grid gap-3">
          {itinerary.map((item) => (
            <div key={item.id} className={`grid gap-3 rounded-[22px] border p-4 md:grid-cols-[110px_1fr_170px_190px_auto] md:items-center ${editingId === item.id ? 'border-pink-300/26 bg-pink-400/10' : 'border-pink-300/10 bg-black/14'}`}>
              <p className="text-2xl font-black text-pink-300">{item.time}</p>
              <p className="font-black text-white">{item.activity}</p>
              <p className="text-sm text-pink-100/58">{item.place}</p>
              <p className="text-sm text-pink-100/58">{item.owner}</p>
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEditing(item)} className="rounded-[12px] border border-pink-300/10 px-3 py-2 text-sm text-pink-50">Editar</button>
                  <button type="button" onClick={() => moveItem(item.id, -1)} className="rounded-[12px] border border-pink-300/10 px-3 py-2 text-sm text-pink-50">↑</button>
                  <button type="button" onClick={() => moveItem(item.id, 1)} className="rounded-[12px] border border-pink-300/10 px-3 py-2 text-sm text-pink-50">↓</button>
                  <button type="button" onClick={() => removeItem(item.id)} className="rounded-[12px] border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">Borrar</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CheckinPanel({
  guests,
  setGuests,
  scannerPath,
}: {
  guests: Guest[];
  setGuests: Dispatch<SetStateAction<Guest[]>>;
  scannerPath: string | null;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return guests;
    return guests.filter((guest) => [guest.name, guest.table, guest.phone].join(' ').toLowerCase().includes(normalized));
  }, [guests, query]);

  const markPresent = (id: string) => {
    setGuests((prev) => prev.map((guest) => (guest.id === id ? { ...guest, status: 'present' } : guest)));
    toast('Ingreso validado');
  };

  const present = guests.filter((guest) => guest.status === 'present').length;
  const confirmed = guests.filter((guest) => guest.status === 'confirmed' || guest.status === 'present').length;

  return (
    <section className="mx-auto max-w-6xl">
      <SectionHeader
        badge="Control de acceso"
        title="Check-in mas claro para puerta"
        text="Busca invitados, valida el ingreso y deja visible el conteo general sin depender de una pantalla vacia."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          [String(guests.length), 'Total'],
          [String(confirmed), 'Confirmados'],
          [String(present), 'Presentes'],
          [String(Math.max(0, confirmed - present)), 'Esperados'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-[24px] border border-pink-300/12 bg-white/[0.04] p-5">
            <p className="text-4xl font-black text-white">{value}</p>
            <p className="mt-2 text-sm text-pink-100/58">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="rounded-[28px] border border-pink-300/12 bg-white/[0.04] p-5">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="mb-4 w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Buscar por nombre, mesa o telefono..." />
          <div className="grid gap-3">
            {results.map((guest) => (
              <div key={guest.id} className="grid gap-3 rounded-[22px] border border-pink-300/10 bg-black/14 p-4 md:grid-cols-[1fr_140px_120px_auto] md:items-center">
                <div>
                  <p className="font-black text-white">{guest.name}</p>
                  <p className="mt-1 text-sm text-pink-100/56">{guest.table} · {guest.phone}</p>
                </div>
                <StatusPill value={getGuestStatusLabel(guest.status)} />
                <p className="text-sm text-pink-100/58">{guest.food}</p>
                <button type="button" onClick={() => markPresent(guest.id)} className="rounded-[14px] border border-pink-300/12 bg-white/[0.04] px-4 py-2 text-sm font-black text-pink-50">
                  Validar ingreso
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[28px] border border-pink-300/12 bg-[radial-gradient(circle_at_top,rgba(139,92,246,.18),transparent_36%),rgba(255,255,255,.04)] p-5 text-center">
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-[28px] border border-dashed border-pink-300/28 bg-black/18">
            <i className="fas fa-qrcode text-7xl text-pink-300" />
          </div>
          {scannerPath ? (
            <Link to={scannerPath} className="mt-5 block w-full rounded-[18px] bg-white px-4 py-3 text-sm font-black text-[#160916]">
              Abrir lector QR real
            </Link>
          ) : (
            <button type="button" onClick={() => toast('No encontramos el evento para abrir el lector QR real', 'warning')} className="mt-5 w-full rounded-[18px] bg-white px-4 py-3 text-sm font-black text-[#160916]">
              Abrir lector QR real
            </button>
          )}
          <p className="mt-3 text-xs leading-6 text-pink-100/58">Si ya tienes el flujo de puerta armado, desde aca saltas al lector QR real en lugar de usar una simulacion.</p>
        </aside>
      </div>
    </section>
  );
}

function ProvidersPanel({
  providers,
  services,
}: {
  providers: Provider[];
  services: Provider[];
}) {
  const openWhatsApp = (provider: Pick<Provider, 'name' | 'phone' | 'category' | 'whatsapp'>) => {
    const digits = String(provider.whatsapp || provider.phone || '').replace(/\D/g, '');
    if (!digits) {
      toast('Este proveedor no tiene WhatsApp cargado', 'warning');
      return;
    }

    const text = encodeURIComponent(
      `Hola ${provider.name}, te escribo por el evento para coordinar ${provider.category}.`,
    );
    window.open(`https://wa.me/${digits}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="mx-auto max-w-6xl">
      <SectionHeader
        badge="Proveedores"
        title="Proveedores y servicios del evento"
        text="Catálogo global administrado desde el panel master. Acá solo consultas proveedores, servicios, imágenes y contactos compartidos entre todos los eventos."
      />

      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((provider) => (
            <div key={provider.id} className="rounded-[28px] border border-pink-300/12 bg-white/[0.04] p-5">
              {provider.imageUrl ? <img src={provider.imageUrl} alt={provider.name} className="mb-4 h-40 w-full rounded-[20px] object-cover" /> : null}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white">{provider.name}</h2>
                  <p className="mt-1 text-sm text-pink-100/58">{provider.category}</p>
                </div>
                <StatusPill value={getProviderStatusLabel(provider.status)} />
              </div>
              {provider.description ? <p className="mt-4 text-sm leading-6 text-pink-100/64">{provider.description}</p> : null}
              <p className="mt-4 text-sm text-pink-100/58">{provider.phone || provider.whatsapp || 'Sin teléfono cargado'}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => openWhatsApp(provider)} className="rounded-[14px] bg-[#25D366] px-4 py-2 text-sm font-black text-white">
                  WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-black text-white">Servicios adicionales</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {services.map((service) => (
              <div key={service.id} className="rounded-[28px] border border-pink-300/12 bg-white/[0.04] p-5">
                {service.imageUrl ? <img src={service.imageUrl} alt={service.name} className="mb-4 h-36 w-full rounded-[20px] object-cover" /> : null}
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-400/12 text-pink-200">
                    <i className="fas fa-sparkles" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-white">{service.name}</h3>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-pink-200/70">{service.category || 'Servicio adicional'}</p>
                  <p className="mt-3 text-sm leading-6 text-pink-100/58">{service.description || 'Sin descripción cargada todavía.'}</p>
                  {service.whatsapp || service.phone ? (
                    <button type="button" onClick={() => openWhatsApp(service)} className="mt-5 rounded-[14px] bg-[#25D366] px-4 py-2 text-sm font-black text-white">
                      WhatsApp
                    </button>
                  ) : (
                    <p className="mt-5 rounded-[14px] border border-pink-300/12 px-4 py-2 text-sm font-black text-pink-100/60">
                      Sin contacto cargado
                    </p>
                  )}
                </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function getManagedUserLabel(user: ManagedUser | null | undefined) {
  if (!user) return '';
  return (
    user.fullName ||
    `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
    user.email ||
    'Usuario'
  );
}

function EventDraftSetupPanel({
  eventInfo,
  setEventInfo,
  finalUserId,
  setFinalUserId,
  organizerId,
  setOrganizerId,
  finalUsers,
  organizerUsers,
  loadingUsers,
  canSelectOrganizer,
  saving,
  onCreate,
}: {
  eventInfo: EventInfo;
  setEventInfo: Dispatch<SetStateAction<EventInfo>>;
  finalUserId: string;
  setFinalUserId: Dispatch<SetStateAction<string>>;
  organizerId: string;
  setOrganizerId: Dispatch<SetStateAction<string>>;
  finalUsers: ManagedUser[];
  organizerUsers: ManagedUser[];
  loadingUsers: boolean;
  canSelectOrganizer: boolean;
  saving: boolean;
  onCreate: () => void;
}) {
  const updateField = (key: keyof EventInfo, value: string) => {
    setEventInfo((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="mb-6 rounded-[30px] border border-pink-300/16 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,.18),transparent_34%),rgba(255,255,255,.055)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)]">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-pink-200/70">Nuevo evento</p>
          <h2 className="mt-2 text-2xl font-black text-white">Configuracion inicial</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-pink-100/64">
            Crea el evento desde este mismo panel operativo. Despues queda abierta la vista con permisos por rol.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={saving}
          className="rounded-[18px] bg-white px-5 py-3 text-sm font-black text-[#1b091c] disabled:opacity-60"
        >
          {saving ? 'Creando...' : 'Crear evento'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Nombre del evento</span>
          <input value={eventInfo.name} onChange={(e) => updateField('name', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Ej: 15 Anos de Camila" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Usuario final obligatorio</span>
          <select value={finalUserId} onChange={(e) => setFinalUserId(e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none">
            <option value="">{loadingUsers ? 'Cargando usuarios finales...' : 'Seleccionar usuario final'}</option>
            {finalUsers.map((item) => (
              <option key={item.id} value={item.id}>
                {getManagedUserLabel(item)} {item.email ? `· ${item.email}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Fecha</span>
          <input type="date" value={eventInfo.date} onChange={(e) => updateField('date', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Lugar</span>
          <input value={eventInfo.venue} onChange={(e) => updateField('venue', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" placeholder="Salon, quinta, direccion o sede" />
        </label>
        {canSelectOrganizer ? (
          <label className="block lg:col-span-2">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Organizador opcional</span>
            <select value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none">
              <option value="">Sin organizador asignado</option>
              {organizerUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {getManagedUserLabel(item)} {item.email ? `· ${item.email}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}

function SettingsPanel({
  eventInfo,
  setEventInfo,
}: {
  eventInfo: EventInfo;
  setEventInfo: Dispatch<SetStateAction<EventInfo>>;
}) {
  const updateField = (key: keyof EventInfo, value: string) => {
    setEventInfo((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="mx-auto max-w-5xl">
      <SectionHeader
        badge="Configuracion"
        title="Datos base del evento"
        text="Esta seccion ahora sirve para controlar nombre, tipo, fecha y sede. Todo el resto del panel toma estos datos."
      />

      <div className="rounded-[30px] border border-pink-300/12 bg-white/[0.04] p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Nombre</span>
            <input value={eventInfo.name} onChange={(e) => updateField('name', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Tipo</span>
            <input value={eventInfo.type} onChange={(e) => updateField('type', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Fecha</span>
            <input type="date" value={eventInfo.date} onChange={(e) => updateField('date', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Venue</span>
            <input value={eventInfo.venue} onChange={(e) => updateField('venue', e.target.value)} className="w-full rounded-[18px] border border-pink-300/14 bg-black/18 px-4 py-3 text-white outline-none" />
          </label>
        </div>

        <button type="button" onClick={() => toast('Configuracion guardada')} className="mt-5 rounded-[18px] bg-[linear-gradient(135deg,#fb7185,#8b5cf6)] px-5 py-3 text-sm font-black text-white">
          Guardar cambios
        </button>
      </div>
    </section>
  );
}

export function EventInvitationPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const guestId = searchParams.get('guest');
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(() => loadWorkspaceState(id));
  const [publicRsvpForm, setPublicRsvpForm] = useState({ name: '', email: '', phone: '' });
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return window.innerWidth >= 960 ? 'desktop' : 'mobile';
  });

  useEffect(() => {
    setWorkspaceState(loadWorkspaceState(id));
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewportMode = () => {
      setViewportMode(window.innerWidth >= 960 ? 'desktop' : 'mobile');
    };

    syncViewportMode();
    window.addEventListener('resize', syncViewportMode);
    return () => window.removeEventListener('resize', syncViewportMode);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== getWorkspaceStorageKey(id)) return;
      setWorkspaceState(loadWorkspaceState(id));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [id]);

  const guest = useMemo(
    () => workspaceState.guests.find((item) => item.id === guestId || item.inviteCode === guestId) || null,
    [guestId, workspaceState.guests],
  );
  const rsvpSummary = useMemo(() => getRsvpSummary(workspaceState.guests), [workspaceState.guests]);
  const invitationUrl = useMemo(() => getInvitationUrl(id, guest?.id || null), [guest?.id, id]);
  const invitationLabel = useMemo(() => {
    if (typeof window === 'undefined') return invitationUrl;
    return invitationUrl.replace(window.location.origin, '');
  }, [invitationUrl]);

  useEffect(() => {
    setPublicRsvpForm({
      name: guest?.name || '',
      email: guest?.email || '',
      phone: guest?.phone && guest.phone !== '-' ? guest.phone : '',
    });
  }, [guest?.email, guest?.id, guest?.name, guest?.phone]);

  const confirmAttendance = () => {
    const normalizedName = publicRsvpForm.name.trim();
    const normalizedEmail = publicRsvpForm.email.trim().toLowerCase();
    const normalizedPhone = publicRsvpForm.phone.trim();

    if (!normalizedEmail) {
      toast('Completá tu email para confirmar asistencia', 'warning');
      return;
    }

    if (guest && (guest.status === 'confirmed' || guest.status === 'present')) {
      toast('La asistencia ya estaba confirmada', 'info');
      return;
    }

    const matchedGuest = guest || workspaceState.guests.find((item) => item.email && item.email.trim().toLowerCase() === normalizedEmail) || null;

    const nextGuestId = matchedGuest?.id || nextId('guest');
    const nextGuest = normalizeGuest(
      {
        ...(matchedGuest || {}),
        id: nextGuestId,
        name: normalizedName || matchedGuest?.name || `Invitado ${workspaceState.guests.length + 1}`,
        email: normalizedEmail || matchedGuest?.email,
        phone: normalizedPhone || matchedGuest?.phone || '-',
        status: 'confirmed',
        inviteCode: matchedGuest?.inviteCode || createInviteCode(`${normalizedName || nextGuestId}-${normalizedPhone || normalizedEmail || nextGuestId}`),
      },
      workspaceState.guests.length,
    );

    const nextState = normalizeWorkspaceState({
      ...workspaceState,
      guests: matchedGuest
        ? workspaceState.guests.map((item) => (item.id === matchedGuest.id ? { ...item, ...nextGuest } : item))
        : [nextGuest, ...workspaceState.guests],
    });
    safeSetWorkspaceState(id, nextState);
    setWorkspaceState(nextState);
    setPublicRsvpForm({
      name: nextGuest.name,
      email: nextGuest.email || '',
      phone: nextGuest.phone === '-' ? '' : nextGuest.phone,
    });
    toast('Asistencia confirmada');
  };

  return (
    <main className="min-h-screen bg-[#120512] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-pink-300/10 bg-white/[0.04] p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-100/52">Invitacion publica</p>
            <h1 className="mt-1 text-2xl font-black">{workspaceState.eventInfo.name}</h1>
            <p className="mt-1 text-sm text-pink-100/66">{guest ? `Invitacion para ${guest.name}` : 'Vista publica general de la invitacion'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-pink-300/12 bg-black/20 px-4 py-2 text-xs font-black text-pink-50">
              {viewportMode === 'desktop' ? 'Vista desktop' : 'Vista mobile'}
            </span>
            <button type="button" onClick={() => copyText(invitationUrl, 'Link de invitacion copiado')} className="rounded-[16px] border border-pink-300/12 bg-white/[0.04] px-4 py-3 text-sm font-black text-pink-50">
              Copiar link
            </button>
          </div>
        </div>

        <WebsitePreview
          eventInfo={workspaceState.eventInfo}
          guests={workspaceState.guests}
          layout={workspaceState.layout}
          webSections={workspaceState.webSections}
          rsvpConfirmed={rsvpSummary.confirmed}
          rsvpPending={rsvpSummary.pending}
          onConfirm={confirmAttendance}
          backgroundUrl={workspaceState.websiteBackgroundUrl}
          viewport={viewportMode}
          frameLabel={invitationLabel}
          inviteeName={guest?.name || publicRsvpForm.name}
          confirmLabel={guest && (guest.status === 'confirmed' || guest.status === 'present') ? 'Asistencia confirmada' : 'Confirmar asistencia'}
          confirmDisabled={!!guest && (guest.status === 'confirmed' || guest.status === 'present')}
          publicRsvpMode={guest ? 'linked' : 'collect'}
          publicRsvpForm={publicRsvpForm}
          onPublicRsvpFormChange={(patch) => setPublicRsvpForm((current) => ({ ...current, ...patch }))}
        />
      </div>
    </main>
  );
}


export default function EventWorkspace() {
  const { user, logout } = useContext(AuthContext);
  const { id: workspaceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [active, setActive] = useState<ModuleKey>('overview');
  const [guideOpen, setGuideOpen] = useState(false);
  const initial = useMemo(() => loadWorkspaceState(workspaceId), [workspaceId]);
  const [eventInfo, setEventInfo] = useState<EventInfo>(initial.eventInfo);
  const [guests, setGuests] = useState<Guest[]>(initial.guests);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial.checklist);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(initial.itinerary);
  const [providers, setProviders] = useState<Provider[]>(initial.providers);
  const [services, setServices] = useState<Provider[]>([]);
  const [layout, setLayout] = useState<LayoutElement[]>(initial.layout);
  const [webSections, setWebSections] = useState<WebSection[]>(initial.webSections);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(initial.canvasItems);
  const [websiteBackgroundUrl, setWebsiteBackgroundUrl] = useState<string>(initial.websiteBackgroundUrl);
  const rsvpSummary = useMemo(() => getRsvpSummary(guests), [guests]);
  const isDraftWorkspace = String(workspaceId || '').startsWith('draft-');
  const visibleMenuGroups = menuGroups;
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [loadingManagedUsers, setLoadingManagedUsers] = useState(false);
  const [finalUserId, setFinalUserId] = useState(searchParams.get('finalUserId') || searchParams.get('assignedToId') || '');
  const [organizerId, setOrganizerId] = useState(searchParams.get('organizerId') || '');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [guestsApiReady, setGuestsApiReady] = useState(!workspaceId || isDraftWorkspace);
  const [guestsApiWritable, setGuestsApiWritable] = useState(!workspaceId || isDraftWorkspace);
  const guestsSaveTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastSyncedGuestsRef = useRef('');
  const visibleMenuKeys = useMemo(
    () => new Set(visibleMenuGroups.flatMap((group) => group.items.map((item) => item.key))),
    [visibleMenuGroups],
  );

  useEffect(() => {
    if (!visibleMenuKeys.has(active)) {
      setActive('overview');
    }
  }, [active, visibleMenuKeys]);

  useEffect(() => {
    if (!isDraftWorkspace || !['master', 'organizer', 'creator'].includes(String(user?.role || ''))) return;

    let cancelled = false;
    const loadManagedUsers = async () => {
      try {
        setLoadingManagedUsers(true);
        const { data } = await api.get('/admin/users');
        if (cancelled) return;
        setManagedUsers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setManagedUsers([]);
      } finally {
        if (!cancelled) setLoadingManagedUsers(false);
      }
    };

    loadManagedUsers();
    return () => {
      cancelled = true;
    };
  }, [isDraftWorkspace, user?.role]);

  const finalUsers = useMemo(
    () => managedUsers.filter((item) => String(item.role || '').toLowerCase() === 'guest'),
    [managedUsers],
  );

  const organizerUsers = useMemo(
    () => managedUsers.filter((item) => ['organizer', 'creator'].includes(String(item.role || '').toLowerCase())),
    [managedUsers],
  );

  useEffect(() => {
    const next = loadWorkspaceState(workspaceId);
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setEventInfo(next.eventInfo);
      setGuests(isDraftWorkspace ? next.guests : []);
      setChecklist(next.checklist);
      setItinerary(next.itinerary);
      setProviders(next.providers);
      setLayout(next.layout);
      setWebSections(next.webSections);
      setCanvasItems(next.canvasItems);
      setWebsiteBackgroundUrl(next.websiteBackgroundUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [isDraftWorkspace, workspaceId]);

  useEffect(() => {
    if (!workspaceId || isDraftWorkspace) {
      setGuestsApiReady(true);
      setGuestsApiWritable(true);
      return;
    }

    let cancelled = false;
    setGuestsApiReady(false);
    setGuestsApiWritable(false);

    const hydrateGuests = async () => {
      try {
        const nextGuests = await listWorkspaceGuests(workspaceId);
        if (cancelled) return;
        const normalizedGuests = nextGuests.map((guest, index) => normalizeGuest(guest, index));
        lastSyncedGuestsRef.current = JSON.stringify(normalizedGuests);
        setGuests(normalizedGuests);
        setGuestsApiWritable(true);
      } catch (error) {
        console.error('Error loading guests from API:', error);
        if (cancelled) return;
        setGuestsApiWritable(false);
        Swal.fire('Aviso', 'No pudimos cargar los invitados guardados del evento.', 'warning');
      } finally {
        if (!cancelled) setGuestsApiReady(true);
      }
    };

    void hydrateGuests();

    return () => {
      cancelled = true;
    };
  }, [isDraftWorkspace, workspaceId]);

  useEffect(() => {
    if (!workspaceId || isDraftWorkspace) return;

    const refreshGuests = async () => {
      try {
        const nextGuests = await listWorkspaceGuests(workspaceId);
        const normalizedGuests = nextGuests.map((guest, index) => normalizeGuest(guest, index));
        const serialized = JSON.stringify(normalizedGuests);
        lastSyncedGuestsRef.current = serialized;
        setGuests((current) => (JSON.stringify(current) === serialized ? current : normalizedGuests));
      } catch (error) {
        console.error('Error refreshing guests from API:', error);
      }
    };

    window.addEventListener('focus', refreshGuests);
    return () => window.removeEventListener('focus', refreshGuests);
  }, [isDraftWorkspace, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    const mapItem = (item: GlobalCatalogItem): Provider => ({
      id: item.id,
      name: item.name,
      category: item.category || (item.kind === 'provider' ? 'Proveedor' : 'Servicio'),
      status: item.isActive ? 'active' : 'inactive',
      phone: item.phone || '',
      whatsapp: item.whatsapp || item.phone || '',
      imageUrl: item.imageUrl || '',
      description: item.description || '',
    });

    const loadCatalog = async () => {
      try {
        const items = await listGlobalCatalog();
        if (cancelled) return;
        setProviders(items.filter((item) => item.kind === 'provider').map(mapItem));
        setServices(items.filter((item) => item.kind === 'service').map(mapItem));
      } catch (error) {
        console.error('Error loading global catalog:', error);
        if (cancelled) return;
        setProviders([]);
        setServices([]);
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const state: WorkspaceState = {
      eventInfo,
      guests: isDraftWorkspace ? guests : [],
      checklist,
      itinerary,
      providers,
      layout,
      webSections,
      canvasItems,
      websiteBackgroundUrl,
      rsvpConfirmed: rsvpSummary.confirmed,
      rsvpPending: rsvpSummary.pending,
    };

    safeSetWorkspaceState(workspaceId, state);
  }, [isDraftWorkspace, workspaceId, eventInfo, guests, checklist, itinerary, providers, layout, webSections, canvasItems, websiteBackgroundUrl, rsvpSummary.confirmed, rsvpSummary.pending]);

  useEffect(() => {
    if (!workspaceId || isDraftWorkspace || !guestsApiReady || !guestsApiWritable) return;

    const serializedGuests = JSON.stringify(guests);
    if (serializedGuests === lastSyncedGuestsRef.current) return;

    if (guestsSaveTimeoutRef.current) {
      window.clearTimeout(guestsSaveTimeoutRef.current);
    }

    guestsSaveTimeoutRef.current = window.setTimeout(() => {
      void saveWorkspaceGuests(workspaceId, guests)
        .then((savedGuests) => {
          const normalizedGuests = savedGuests.map((guest, index) => normalizeGuest(guest, index));
          const nextSerialized = JSON.stringify(normalizedGuests);
          lastSyncedGuestsRef.current = nextSerialized;
          setGuests((current) => (JSON.stringify(current) === nextSerialized ? current : normalizedGuests));
        })
        .catch((error) => {
          console.error('Error saving guests to API:', error);
        });
    }, 350);

    return () => {
      if (guestsSaveTimeoutRef.current) {
        window.clearTimeout(guestsSaveTimeoutRef.current);
        guestsSaveTimeoutRef.current = null;
      }
    };
  }, [guests, guestsApiReady, guestsApiWritable, isDraftWorkspace, workspaceId]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== getWorkspaceStorageKey(workspaceId)) return;
      const next = loadWorkspaceState(workspaceId);
      if (isDraftWorkspace) {
        setGuests(next.guests);
      }
      setWebSections(next.webSections);
      setCanvasItems(next.canvasItems);
      setWebsiteBackgroundUrl(next.websiteBackgroundUrl);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isDraftWorkspace, workspaceId]);

  const canEditItinerary = user?.role === 'master' || user?.role === 'organizer' || user?.role === 'creator';
  const createBackendEvent = useCallback(async () => {
    if (!eventInfo.name.trim()) {
      Swal.fire('Aviso', 'El nombre del evento es obligatorio', 'warning');
      return;
    }

    if (!finalUserId) {
      Swal.fire('Aviso', 'Debes asociar un usuario final al evento', 'warning');
      return;
    }

    if (!eventInfo.date) {
      Swal.fire('Aviso', 'Defini la fecha del evento.', 'warning');
      return;
    }

    try {
      setCreatingEvent(true);
      const payload = {
        title: eventInfo.name.trim(),
        drawDate: `${eventInfo.date}T23:30`,
        finalUserId,
        organizerId: user?.role === 'master' && organizerId ? organizerId : undefined,
        assignedToId: user?.role === 'master' && organizerId ? organizerId : undefined,
        eventType: eventInfo.type || 'general',
        maxCapacity: 100,
        totalNumbers: 100,
        estimatedAttendanceCapacity: 100,
        isPaid: false,
        ticketPrice: 0,
        allowCash: true,
        allowTransfer: false,
        desiredNetGoal: '0',
        minDraw: '0',
        desc: eventInfo.venue ? `Lugar: ${eventInfo.venue}` : 'Evento creado desde el panel operativo.',
      };

      const { data } = await api.post('/raffles', payload);
      safeSetWorkspaceState(data.id, {
        eventInfo,
        guests,
        checklist,
        itinerary,
        providers,
        layout,
        webSections,
        canvasItems,
        websiteBackgroundUrl,
        rsvpConfirmed: rsvpSummary.confirmed,
        rsvpPending: rsvpSummary.pending,
      });
      toast('Evento creado correctamente');
      navigate(`/workspace/${data.id}`, { replace: true });
    } catch (error: any) {
      Swal.fire(
        'Error',
        error?.response?.data?.message || 'No se pudo crear el evento.',
        'error',
      );
    } finally {
      setCreatingEvent(false);
    }
  }, [canvasItems, checklist, eventInfo, finalUserId, guests, itinerary, layout, navigate, organizerId, providers, rsvpSummary.confirmed, rsvpSummary.pending, user?.role, webSections, websiteBackgroundUrl]);

  const activeLabel = useMemo(() => {
    for (const group of visibleMenuGroups) {
      const item = group.items.find((entry) => entry.key === active);
      if (item) return item.label;
    }
    return 'Inicio';
  }, [active, visibleMenuGroups]);

  const jumpTo = useCallback((key: ModuleKey) => setActive(key), []);
  const scannerPath = workspaceId ? `/dashboard/${workspaceId}/door` : null;

  return (
    <main className="event-os min-h-screen bg-[#100311] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.18),transparent_24%),radial-gradient(circle_at_top_left,rgba(251,113,133,.12),transparent_20%),linear-gradient(180deg,#100311,#170817_52%,#0b0211)]" />
      <Sidebar active={active} setActive={jumpTo} eventName={eventInfo.name} menuGroups={visibleMenuGroups} />
      <Topbar activeLabel={activeLabel} onOpenGuide={() => setGuideOpen(true)} onLogout={logout} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      <section className="relative px-5 py-8 xl:ml-[280px] xl:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 xl:hidden">
            {visibleMenuGroups.flatMap((group) => group.items).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-black ${
                  active === item.key ? 'border-pink-300/24 bg-pink-400/14 text-white' : 'border-pink-300/10 bg-white/[0.03] text-pink-100/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {isDraftWorkspace ? (
            <EventDraftSetupPanel
              eventInfo={eventInfo}
              setEventInfo={setEventInfo}
              finalUserId={finalUserId}
              setFinalUserId={setFinalUserId}
              organizerId={organizerId}
              setOrganizerId={setOrganizerId}
              finalUsers={finalUsers}
              organizerUsers={organizerUsers}
              loadingUsers={loadingManagedUsers}
              canSelectOrganizer={user?.role === 'master'}
              saving={creatingEvent}
              onCreate={createBackendEvent}
            />
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {active === 'overview' ? <OverviewPanel eventInfo={eventInfo} guests={guests} itinerary={itinerary} providers={providers} onJump={jumpTo} /> : null}
              {active === 'guests' ? <GuestsPanel workspaceId={workspaceId} eventInfo={eventInfo} layout={layout} guests={guests} setGuests={setGuests} onJump={jumpTo} /> : null}
              {active === 'website' ? <WebsitePanel workspaceId={workspaceId} layout={layout} onJump={jumpTo} /> : null}
              {active === 'seating' ? <SeatingPanel layout={layout} guests={guests} setLayout={setLayout} setGuests={setGuests} /> : null}
              {active === 'itinerary' ? <ItineraryPanel canEdit={canEditItinerary} itinerary={itinerary} setItinerary={setItinerary} /> : null}
              {active === 'checkin' ? <CheckinPanel guests={guests} setGuests={setGuests} scannerPath={scannerPath} /> : null}
              {active === 'providers' ? <ProvidersPanel providers={providers} services={services} /> : null}
              {active === 'settings' ? <SettingsPanel eventInfo={eventInfo} setEventInfo={setEventInfo} /> : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}
