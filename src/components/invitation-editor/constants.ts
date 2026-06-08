import type {
  ButtonContent,
  EditorElement,
  ElementStyles,
  ImageContent,
  InvitationSection,
  InvitationTemplate,
  LocationContent,
  RsvpContent,
  SeatingMapContent,
  SectionBackground,
  ShapeContent,
  TextContent,
} from './types';

// ─── Defaults ──────────────────────────────────────────────────────

export const DEFAULT_SECTION: InvitationSection = {
  id: 'sec-default',
  type: 'cover',
  name: 'Portada',
  height: 900,
  background: { type: 'color', value: '#ffffff' },
  elements: [],
};

export const DEFAULT_STYLES: ElementStyles = {
  backgroundColor: 'transparent',
  backgroundOpacity: 1,
  borderColor: 'transparent',
  borderWidth: 0,
  borderRadius: 0,
  boxShadow: 'none',
};

export const DEFAULT_TEXT_CONTENT: TextContent = {
  text: 'Nuevo texto',
  fontFamily: "'Inter', sans-serif",
  fontSize: 32,
  fontWeight: '400',
  fontStyle: 'normal',
  color: '#1a1a2e',
  textAlign: 'center',
  lineHeight: 1.4,
  letterSpacing: 0,
  textDecoration: 'none',
};

export const DEFAULT_SHAPE_CONTENT: ShapeContent = {
  shapeType: 'rect',
  text: '',
  textColor: '#ffffff',
  textSize: 18,
  textFont: "'Inter', sans-serif",
};

export const DEFAULT_IMAGE_CONTENT: ImageContent = {
  src: '',
  alt: 'Imagen',
  objectFit: 'cover',
};

export const DEFAULT_BUTTON_CONTENT: ButtonContent = {
  text: 'Confirmar asistencia',
  fontFamily: "'Inter', sans-serif",
  fontSize: 16,
  fontWeight: '700',
  color: '#ffffff',
  textAlign: 'center',
  action: 'rsvp',
};

export const DEFAULT_SEATING_MAP_CONTENT: SeatingMapContent = {
  showTables: true,
  tableColor: '#3b82f6',
  labelColor: '#ffffff',
};

export const DEFAULT_LOCATION_CONTENT: LocationContent = {
  placeName: 'Salón Principal',
  address: 'Av. Libertador 1234, CABA',
  mapsUrl: 'https://maps.google.com',
  buttonText: 'Ver ubicación',
  buttonColor: '#3b82f6',
};

export const DEFAULT_RSVP_CONTENT: RsvpContent = {
  title: 'Confirmá tu asistencia',
  description: 'Por favor, confirmanos antes del 10 de Octubre.',
  buttonText: 'Confirmar asistencia',
  successMessage: '¡Gracias por confirmar!',
  fields: ['name', 'companions'],
};

// ─── Fonts ─────────────────────────────────────────────────────────

export const FONT_OPTIONS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', serif" },
  { label: 'Trebuchet', value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Verdana', value: "Verdana, Geneva, sans-serif" },
  { label: 'Gill Sans', value: "'Gill Sans', 'Trebuchet MS', sans-serif" },
  { label: 'Courier', value: "'Courier New', Courier, monospace" },
  { label: 'Impact', value: "Impact, 'Arial Black', sans-serif" },
];

// ─── Colors ────────────────────────────────────────────────────────

export const COLOR_PRESETS = [
  '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#adb5bd',
  '#6c757d', '#495057', '#343a40', '#212529', '#000000',
  '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
  '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b',
  '#f97316', '#ef4444', '#b91c1c', '#7f1d1d', '#1e3a5f',
];

// ─── Background presets ────────────────────────────────────────────

export const BACKGROUND_PRESETS: Array<{ label: string; bg: SectionBackground }> = [
  { label: 'Blanco', bg: { type: 'color', value: '#ffffff' } },
  { label: 'Crema', bg: { type: 'color', value: '#fef9ef' } },
  { label: 'Rosa suave', bg: { type: 'color', value: '#fff0f6' } },
  { label: 'Lila suave', bg: { type: 'color', value: '#f3f0ff' } },
  { label: 'Azul hielo', bg: { type: 'color', value: '#e8f4fd' } },
  { label: 'Negro elegante', bg: { type: 'color', value: '#0f0f0f' } },
  { label: 'Dorado', bg: { type: 'gradient', value: '#f6d365', secondaryValue: '#fda085', angle: 135 } },
  { label: 'Sunset', bg: { type: 'gradient', value: '#a18cd1', secondaryValue: '#fbc2eb', angle: 135 } },
  { label: 'Oceano', bg: { type: 'gradient', value: '#667eea', secondaryValue: '#764ba2', angle: 135 } },
  { label: 'Bosque', bg: { type: 'gradient', value: '#0f766e', secondaryValue: '#134e4a', angle: 180 } },
];

export const BG_PRESETS = BACKGROUND_PRESETS;

export const GRADIENT_PRESETS = BACKGROUND_PRESETS.filter((preset) => preset.bg.type === 'gradient');

export const STOCK_BACKGROUNDS = [
  { label: 'Wedding 1', value: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1080&auto=format&fit=crop' },
  { label: 'Wedding 2', value: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1080&auto=format&fit=crop' },
  { label: 'Party 1', value: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1080&auto=format&fit=crop' },
  { label: 'Birthday', value: 'https://images.unsplash.com/photo-1530103862676-de88b6bc8bbd?q=80&w=1080&auto=format&fit=crop' },
  { label: 'Abstract 1', value: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop' },
];

// ─── Shape presets ─────────────────────────────────────────────────

export const SHAPE_PRESETS: Array<{ label: string; icon: string; shape: ShapeContent['shapeType']; w: number; h: number; styles: Partial<ElementStyles> }> = [
  { label: 'Rectangulo', icon: 'fa-square', shape: 'rect', w: 300, h: 200, styles: { backgroundColor: '#ec4899', borderRadius: 16 } },
  { label: 'Circulo', icon: 'fa-circle', shape: 'circle', w: 200, h: 200, styles: { backgroundColor: '#8b5cf6', borderRadius: 9999 } },
  { label: 'Linea', icon: 'fa-minus', shape: 'line', w: 400, h: 4, styles: { backgroundColor: '#6c757d', borderRadius: 2 } },
  { label: 'Badge', icon: 'fa-certificate', shape: 'badge', w: 240, h: 80, styles: { backgroundColor: '#f59e0b', borderRadius: 999 } },
  { label: 'Tarjeta', icon: 'fa-id-card', shape: 'rect', w: 500, h: 300, styles: { backgroundColor: '#ffffff', borderRadius: 24, borderColor: '#e5e7eb', borderWidth: 2, boxShadow: '0 8px 30px rgba(0,0,0,0.12)' } },
  { label: 'Separador', icon: 'fa-grip-lines', shape: 'line', w: 600, h: 2, styles: { backgroundColor: '#d1d5db', borderRadius: 1 } },
];

// ─── Element factory ───────────────────────────────────────────────

let _counter = 0;
export function nextId(prefix = 'el') {
  _counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_counter}`;
}

export function createTextElement(overrides?: Partial<EditorElement>): EditorElement {
  return {
    id: nextId('txt'),
    type: 'text',
    name: 'Texto',
    x: 140, y: 200, width: 800, height: 100,
    rotation: 0, zIndex: 10, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES },
    content: { ...DEFAULT_TEXT_CONTENT },
    ...overrides,
  };
}

export function createShapeElement(shapeType: ShapeContent['shapeType'] = 'rect', overrides?: Partial<EditorElement>): EditorElement {
  const preset = SHAPE_PRESETS.find(s => s.shape === shapeType) || SHAPE_PRESETS[0];
  return {
    id: nextId('shp'),
    type: 'shape',
    name: preset.label,
    x: 200, y: 400, width: preset.w, height: preset.h,
    rotation: 0, zIndex: 5, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES, ...preset.styles },
    content: { ...DEFAULT_SHAPE_CONTENT, shapeType },
    ...overrides,
  };
}

export function createImageElement(src = '', overrides?: Partial<EditorElement>): EditorElement {
  return {
    id: nextId('img'),
    type: 'image',
    name: 'Imagen',
    x: 140, y: 300, width: 400, height: 400,
    rotation: 0, zIndex: 3, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES, borderRadius: 16 },
    content: { ...DEFAULT_IMAGE_CONTENT, src },
    ...overrides,
  };
}

export function createButtonElement(overrides?: Partial<EditorElement>): EditorElement {
  return {
    id: nextId('btn'),
    type: 'button',
    name: 'Boton',
    x: 290, y: 1600, width: 500, height: 70,
    rotation: 0, zIndex: 15, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES, backgroundColor: '#ec4899', borderRadius: 18 },
    content: { ...DEFAULT_BUTTON_CONTENT },
    ...overrides,
  };
}

export function createSeatingMapElement(overrides?: Partial<EditorElement>): EditorElement {
  return {
    id: nextId('map'),
    type: 'seatingMap',
    name: 'Plano del Evento',
    x: 140, y: 100, width: 800, height: 400,
    rotation: 0, zIndex: 10, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
    content: { ...DEFAULT_SEATING_MAP_CONTENT },
    ...overrides,
  };
}

export function createLocationElement(overrides?: Partial<EditorElement>): EditorElement {
  return {
    id: nextId('loc'),
    type: 'location',
    name: 'Ubicacion',
    x: 140, y: 100, width: 800, height: 400,
    rotation: 0, zIndex: 10, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES, backgroundColor: '#ffffff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' },
    content: { ...DEFAULT_LOCATION_CONTENT },
    ...overrides,
  };
}

export function createRsvpElement(overrides?: Partial<EditorElement>): EditorElement {
  return {
    id: nextId('rsvp'),
    type: 'rsvp',
    name: 'Formulario RSVP',
    x: 140, y: 100, width: 800, height: 600,
    rotation: 0, zIndex: 10, opacity: 1,
    locked: false, visible: true,
    styles: { ...DEFAULT_STYLES, backgroundColor: '#ffffff', borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' },
    content: { ...DEFAULT_RSVP_CONTENT },
    ...overrides,
  };
}

// ─── Templates ─────────────────────────────────────────────────────

export const TEMPLATES: InvitationTemplate[] = [
  {
    id: 'tpl-birthday',
    name: 'Cumpleaños elegante',
    category: 'cumpleanos',
    sections: [
      {
        id: nextId('sec'),
        type: 'cover',
        name: 'Portada',
        height: 900,
        background: { type: 'gradient', value: '#fbc2eb', secondaryValue: '#a6c1ee', angle: 135 },
        elements: [
          createTextElement({ id: 'tpl-b-1', name: 'Titulo', x: 90, y: 320, width: 900, height: 120, content: { ...DEFAULT_TEXT_CONTENT, text: '¡Te invitamos!', fontSize: 72, fontWeight: '800', color: '#1a1a2e' } }),
          createTextElement({ id: 'tpl-b-2', name: 'Nombre', x: 90, y: 480, width: 900, height: 100, content: { ...DEFAULT_TEXT_CONTENT, text: 'Mis 15 Años', fontSize: 56, fontWeight: '700', color: '#6d28d9' } }),
        ]
      },
      {
        id: nextId('sec'),
        type: 'content',
        name: 'Detalles',
        height: 800,
        background: { type: 'color', value: '#ffffff' },
        elements: [
          createTextElement({ id: 'tpl-b-3', name: 'Fecha', x: 140, y: 150, width: 800, height: 60, content: { ...DEFAULT_TEXT_CONTENT, text: '24 de Julio 2026 · 20:00 hs', fontSize: 24, color: '#4a4a6a' } }),
          createTextElement({ id: 'tpl-b-4', name: 'Lugar', x: 140, y: 250, width: 800, height: 60, content: { ...DEFAULT_TEXT_CONTENT, text: 'Salon Las Rosas', fontSize: 28, fontWeight: '600', color: '#1a1a2e' } }),
          createShapeElement('line', { id: 'tpl-b-5', name: 'Separador', x: 340, y: 220, width: 400, height: 3, styles: { ...DEFAULT_STYLES, backgroundColor: '#8b5cf6', borderRadius: 2 } }),
          createLocationElement({ id: 'tpl-b-loc', y: 350 }),
        ]
      },
      {
        id: nextId('sec'),
        type: 'rsvp',
        name: 'RSVP',
        height: 800,
        background: { type: 'color', value: '#f8fafc' },
        elements: [
          createRsvpElement({ id: 'tpl-b-rsvp', y: 100 })
        ]
      }
    ],
  },
  {
    id: 'tpl-wedding',
    name: 'Casamiento minimalista',
    category: 'casamiento',
    sections: [
      {
        id: nextId('sec'),
        type: 'cover',
        name: 'Portada',
        height: 1000,
        background: { type: 'color', value: '#f8f5f0' },
        elements: [
          createTextElement({ id: 'tpl-w-1', name: 'Nombres', x: 90, y: 400, width: 900, height: 140, content: { ...DEFAULT_TEXT_CONTENT, text: 'Sofia & Tomas', fontSize: 64, fontWeight: '300', fontFamily: "'Palatino Linotype', serif", color: '#2d3436' } }),
          createTextElement({ id: 'tpl-w-2', name: 'Subtitulo', x: 140, y: 580, width: 800, height: 60, content: { ...DEFAULT_TEXT_CONTENT, text: 'Nos casamos', fontSize: 20, letterSpacing: 6, fontWeight: '400', color: '#636e72' } }),
          createShapeElement('line', { id: 'tpl-w-3', name: 'Linea', x: 440, y: 560, width: 200, height: 1, styles: { ...DEFAULT_STYLES, backgroundColor: '#b2bec3' } }),
        ]
      },
      {
        id: nextId('sec'),
        type: 'content',
        name: 'Ceremonia',
        height: 800,
        background: { type: 'color', value: '#ffffff' },
        elements: [
          createTextElement({ id: 'tpl-w-4', name: 'Fecha', x: 140, y: 100, width: 800, height: 60, content: { ...DEFAULT_TEXT_CONTENT, text: '21 de Noviembre 2026', fontSize: 28, fontFamily: "'Palatino Linotype', serif", color: '#2d3436' } }),
          createTextElement({ id: 'tpl-w-5', name: 'Lugar', x: 140, y: 200, width: 800, height: 50, content: { ...DEFAULT_TEXT_CONTENT, text: 'Estancia Los Olivos · 18:30 hs', fontSize: 22, color: '#636e72' } }),
          createLocationElement({ id: 'tpl-w-loc', y: 300 }),
        ]
      },
      {
        id: nextId('sec'),
        type: 'rsvp',
        name: 'Confirmacion',
        height: 700,
        background: { type: 'color', value: '#f8f5f0' },
        elements: [
          createRsvpElement({ id: 'tpl-w-rsvp', y: 50 })
        ]
      }
    ],
  }
];

// ─── Dynamic data variable tokens ──────────────────────────────────

export const DYNAMIC_VARIABLES = [
  { key: '{{nombreEvento}}', label: 'Nombre del evento' },
  { key: '{{fecha}}', label: 'Fecha' },
  { key: '{{hora}}', label: 'Hora' },
  { key: '{{lugar}}', label: 'Lugar' },
  { key: '{{direccion}}', label: 'Direccion' },
  { key: '{{nombreInvitado}}', label: 'Nombre del invitado' },
  { key: '{{dressCode}}', label: 'Dress code' },
  { key: '{{frasePersonalizada}}', label: 'Frase personalizada' },
];
