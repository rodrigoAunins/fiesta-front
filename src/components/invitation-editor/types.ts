// ─── Element content types ──────────────────────────────────────────

export interface TextContent {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  textDecoration: string;
}

export interface ShapeContent {
  shapeType: 'rect' | 'circle' | 'line' | 'ellipse' | 'triangle' | 'star' | 'badge';
  text: string;
  textColor: string;
  textSize: number;
  textFont: string;
}

export interface ImageContent {
  src: string;
  alt: string;
  objectFit: 'cover' | 'contain' | 'fill';
}

export interface ButtonContent {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  action: 'rsvp' | 'section' | 'map' | 'link' | 'whatsapp' | 'calendar' | string;
  url?: string; // target url if action is 'link'
  targetSection?: string; // id of section to scroll to
}

export interface SeatingMapContent {
  showTables: boolean;
  tableColor: string;
  labelColor: string;
  eventPlanId?: string;
  eventPlanImageUrl?: string;
  eventPlanData?: unknown;
}

export interface LocationContent {
  placeName: string;
  address: string;
  mapsUrl: string;
  buttonText: string;
  buttonColor: string;
}

export interface RsvpContent {
  title: string;
  description: string;
  buttonText: string;
  successMessage: string;
  fields: ('name' | 'companions' | 'message')[];
}

// ─── Editor element ────────────────────────────────────────────────

export type ElementType = 'text' | 'shape' | 'image' | 'button' | 'seatingMap' | 'location' | 'rsvp';

export interface ElementStyles {
  backgroundColor: string;
  backgroundOpacity: number;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  boxShadow: string;
  padding?: number;
}

export interface EditorElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  styles: ElementStyles;
  content: TextContent | ShapeContent | ImageContent | ButtonContent | SeatingMapContent | LocationContent | RsvpContent;
}

// ─── Sections / Design ───────────────────────────────────────────────

export interface SectionBackground {
  type: 'color' | 'gradient' | 'image';
  value: string;
  secondaryValue?: string;
  angle?: number;
  opacity?: number;
}

export interface InvitationSection {
  id: string;
  type: 'cover' | 'content' | 'location' | 'rsvp' | 'gallery' | 'custom';
  name: string;
  height: number;
  background: SectionBackground;
  elements: EditorElement[];
}

export interface ThemeSettings {
  fontFamily: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface InvitationDesign {
  id: string;
  name: string;
  theme?: ThemeSettings;
  sections: InvitationSection[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
    workspaceId?: string;
    layout?: any[]; // For seating map persistence
  };
}

// ─── Editor State ──────────────────────────────────────────────────

export interface EditorState {
  design: InvitationDesign;
  selectedIds: string[];
  zoom: number;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: string | null;
}

// ─── Sidebar ───────────────────────────────────────────────────────

export type SidebarTab =
  | 'sections'
  | 'templates'
  | 'text'
  | 'shapes'
  | 'images'
  | 'backgrounds'
  | 'elements'
  | 'location'
  | 'rsvp'
  | 'plan'
  | 'layers';

// ─── History ───────────────────────────────────────────────────────

export interface HistoryEntry {
  sections: InvitationSection[];
  timestamp: number;
}

// ─── Template ──────────────────────────────────────────────────────

export interface InvitationTemplate {
  id: string;
  name: string;
  category: string;
  thumbnail?: string;
  sections: InvitationSection[];
}

// ─── Dynamic data variables ────────────────────────────────────────

export interface EventData {
  nombreEvento: string;
  fecha: string;
  hora: string;
  lugar: string;
  direccion: string;
  nombreInvitado: string;
  dressCode: string;
  frasePersonalizada: string;
}
