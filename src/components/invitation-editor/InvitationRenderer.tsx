import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  ButtonContent,
  EditorElement,
  ImageContent,
  InvitationDesign,
  InvitationSection,
  LocationContent,
  RsvpContent,
  SeatingMapContent,
  ShapeContent,
  TextContent,
} from './types';

type Props = {
  design?: InvitationDesign | null;
  sections?: InvitationSection[];
  width?: number;
  frame?: boolean;
  rsvpConfirmed?: boolean;
  onConfirmRsvp?: () => boolean | void | Promise<boolean | void>;
  rsvpForm?: {
    name: string;
    email: string;
    phone: string;
  };
  onRsvpFormChange?: (patch: Partial<{ name: string; email: string; phone: string }>) => void;
};

const BASE_WIDTH = 1080;
const PLAN_BASE_WIDTH = 760;
const PLAN_BASE_HEIGHT = 540;

function backgroundStyle(bg: InvitationSection['background']): CSSProperties {
  const opacity = bg.opacity ?? 1;
  if (bg.type === 'gradient') {
    return { background: `linear-gradient(${bg.angle || 135}deg, ${bg.value}, ${bg.secondaryValue || bg.value})`, opacity };
  }
  if (bg.type === 'image') {
    return { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity };
  }
  return { backgroundColor: bg.value, opacity };
}

function findLocationUrl(sections: InvitationSection[]) {
  for (const section of sections) {
    const location = section.elements.find((element) => element.type === 'location')?.content as LocationContent | undefined;
    if (location?.mapsUrl) return location.mapsUrl;
  }
  return '';
}

function calendarUrl(sections: InvitationSection[]) {
  const title = encodeURIComponent('Evento');
  const details = encodeURIComponent('Invitacion digital');
  const location = encodeURIComponent(findLocationUrl(sections));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
}

function renderPlanData(data: unknown, scale: number) {
  const items = Array.isArray(data) ? data as Array<any> : [];
  if (items.length === 0) return null;

  return (
    <div style={{ background: '#f8fafc', borderRadius: 18 * scale, height: '100%', overflow: 'hidden', position: 'relative', width: '100%' }}>
      {items.map((item) => {
        const isRound = item.type === 'roundTable' || item.type === 'vipTable' || item.type === 'danceFloor';
        const bg = item.type === 'vipTable' ? '#fbbf24' : item.type === 'stage' ? '#7c3aed' : item.type === 'entrance' ? '#14b8a6' : item.type === 'danceFloor' ? '#c026d3' : '#ec4899';
        return (
          <div key={item.id || `${item.label}-${item.x}-${item.y}`} style={{
            alignItems: 'center',
            background: bg,
            borderRadius: isRound ? 999 : 14 * scale,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontSize: 11 * scale,
            fontWeight: 800,
            height: `${Math.max(6, (Number(item.h || 60) / PLAN_BASE_HEIGHT) * 100)}%`,
            justifyContent: 'center',
            left: `${(Number(item.x || 0) / PLAN_BASE_WIDTH) * 100}%`,
            lineHeight: 1.2,
            padding: 4 * scale,
            position: 'absolute',
            textAlign: 'center',
            top: `${(Number(item.y || 0) / PLAN_BASE_HEIGHT) * 100}%`,
            width: `${Math.max(7, (Number(item.w || 80) / PLAN_BASE_WIDTH) * 100)}%`,
          }}>
            <span>{item.label || 'Plano'}</span>
            {item.seats ? <small style={{ fontSize: 9 * scale, opacity: 0.9 }}>{item.seats} sillas</small> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function InvitationRenderer({ design, sections: sectionsProp, width = 420, frame = true, rsvpConfirmed = false, onConfirmRsvp, rsvpForm, onRsvpFormChange }: Props) {
  const sections = useMemo(() => sectionsProp || design?.sections || [], [design?.sections, sectionsProp]);
  const [rsvpSent, setRsvpSent] = useState(rsvpConfirmed);
  const [sendingRsvp, setSendingRsvp] = useState(false);
  const scale = Math.min(width / BASE_WIDTH, 1);

  useEffect(() => {
    setRsvpSent(rsvpConfirmed);
  }, [rsvpConfirmed]);

  const confirmRsvp = async () => {
    if (sendingRsvp) return;
    setSendingRsvp(true);
    try {
      const result = await onConfirmRsvp?.();
      if (result !== false) {
        setRsvpSent(true);
      }
    } finally {
      setSendingRsvp(false);
    }
  };

  const handleButtonAction = (content: ButtonContent) => {
    if (content.action === 'rsvp') {
      document.querySelector('[data-invitation-rsvp="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (content.action === 'section' && content.targetSection) {
      document.getElementById(`invitation-section-${content.targetSection}`)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (content.action === 'map') {
      const url = content.url || findLocationUrl(sections);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if ((content.action === 'link' || content.action === 'whatsapp') && content.url) {
      window.open(content.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (content.action === 'calendar') {
      window.open(content.url || calendarUrl(sections), '_blank', 'noopener,noreferrer');
    }
  };

  const elementBase = (element: EditorElement): CSSProperties => ({
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity,
    background: element.styles.backgroundColor === 'transparent' ? 'transparent' : element.styles.backgroundColor,
    borderColor: element.styles.borderColor,
    borderWidth: element.styles.borderWidth,
    borderStyle: element.styles.borderWidth > 0 ? 'solid' : 'none',
    borderRadius: element.styles.borderRadius * scale,
    boxShadow: element.styles.boxShadow !== 'none' ? element.styles.boxShadow : undefined,
    zIndex: element.zIndex,
    overflow: 'hidden',
    boxSizing: 'border-box',
  });

  const renderElement = (element: EditorElement) => {
    const base = elementBase(element);

    if (element.type === 'text') {
      const content = element.content as TextContent;
      return (
        <div key={element.id} style={base}>
          <div style={{ alignItems: 'center', display: 'flex', height: '100%', justifyContent: content.textAlign === 'right' ? 'flex-end' : content.textAlign === 'left' ? 'flex-start' : 'center', padding: 8 * scale, width: '100%' }}>
            <span style={{ color: content.color, fontFamily: content.fontFamily, fontSize: content.fontSize * scale, fontStyle: content.fontStyle, fontWeight: content.fontWeight, letterSpacing: content.letterSpacing * scale, lineHeight: content.lineHeight, textAlign: content.textAlign, textDecoration: content.textDecoration, width: '100%', wordBreak: 'break-word' }}>
              {content.text}
            </span>
          </div>
        </div>
      );
    }

    if (element.type === 'shape') {
      const content = element.content as ShapeContent;
      return (
        <div key={element.id} style={base}>
          {content.text ? <div style={{ alignItems: 'center', display: 'flex', height: '100%', justifyContent: 'center' }}><span style={{ color: content.textColor, fontFamily: content.textFont, fontSize: content.textSize * scale, fontWeight: 700 }}>{content.text}</span></div> : null}
        </div>
      );
    }

    if (element.type === 'image') {
      const content = element.content as ImageContent;
      return <div key={element.id} style={base}>{content.src ? <img src={content.src} alt={content.alt} draggable={false} style={{ display: 'block', height: '100%', objectFit: content.objectFit, width: '100%' }} /> : null}</div>;
    }

    if (element.type === 'button') {
      const content = element.content as ButtonContent;
      return (
        <button key={element.id} type="button" onClick={() => handleButtonAction(content)} style={{ ...base, alignItems: 'center', border: base.borderStyle === 'none' ? 0 : base.borderWidth, cursor: 'pointer', display: 'flex', justifyContent: 'center', padding: 6 * scale }}>
          <span style={{ color: content.color, fontFamily: content.fontFamily, fontSize: content.fontSize * scale, fontWeight: content.fontWeight, textAlign: content.textAlign }}>{content.text}</span>
        </button>
      );
    }

    if (element.type === 'location') {
      const content = element.content as LocationContent;
      return (
        <div key={element.id} style={base}>
          <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 14 * scale, height: '100%', justifyContent: 'center', padding: 24 * scale, textAlign: 'center', width: '100%' }}>
            <i className="fas fa-location-dot" style={{ color: content.buttonColor, fontSize: 38 * scale }} />
            <strong style={{ color: '#1e293b', fontSize: 24 * scale }}>{content.placeName}</strong>
            <span style={{ color: '#64748b', fontSize: 16 * scale }}>{content.address}</span>
            <button type="button" onClick={() => content.mapsUrl && window.open(content.mapsUrl, '_blank', 'noopener,noreferrer')} style={{ background: content.buttonColor, border: 0, borderRadius: 999, color: '#fff', cursor: 'pointer', fontSize: 16 * scale, fontWeight: 700, padding: `${12 * scale}px ${30 * scale}px` }}>
              {content.buttonText}
            </button>
          </div>
        </div>
      );
    }

    if (element.type === 'rsvp') {
      const content = element.content as RsvpContent;
      return (
        <div key={element.id} data-invitation-rsvp="true" style={base}>
          <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 12 * scale, height: '100%', justifyContent: 'center', padding: 28 * scale, textAlign: 'center', width: '100%' }}>
            <strong style={{ color: '#0f172a', fontSize: 28 * scale }}>{content.title}</strong>
            <span style={{ color: '#64748b', fontSize: 16 * scale }}>{rsvpSent ? content.successMessage : content.description}</span>
            {!rsvpSent ? (
              <>
                {rsvpForm ? (
                  <div style={{ display: 'grid', gap: 12 * scale, marginTop: 6 * scale, width: '75%' }}>
                    <input
                      value={rsvpForm.name}
                      onChange={(event) => onRsvpFormChange?.({ name: event.target.value })}
                      placeholder="Nombre y apellido"
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 * scale, color: '#0f172a', fontSize: 15 * scale, height: 48 * scale, outline: 'none', padding: `0 ${16 * scale}px`, width: '100%' }}
                    />
                    <input
                      value={rsvpForm.email}
                      onChange={(event) => onRsvpFormChange?.({ email: event.target.value })}
                      placeholder="Email"
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 * scale, color: '#0f172a', fontSize: 15 * scale, height: 48 * scale, outline: 'none', padding: `0 ${16 * scale}px`, width: '100%' }}
                    />
                    <input
                      value={rsvpForm.phone}
                      onChange={(event) => onRsvpFormChange?.({ phone: event.target.value })}
                      placeholder="Teléfono"
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 * scale, color: '#0f172a', fontSize: 15 * scale, height: 48 * scale, outline: 'none', padding: `0 ${16 * scale}px`, width: '100%' }}
                    />
                  </div>
                ) : null}
                <button type="button" onClick={() => void confirmRsvp()} disabled={sendingRsvp} style={{ background: '#0f172a', border: 0, borderRadius: 10 * scale, color: '#fff', cursor: sendingRsvp ? 'wait' : 'pointer', fontSize: 16 * scale, fontWeight: 700, height: 48 * scale, marginTop: 12 * scale, opacity: sendingRsvp ? 0.7 : 1, width: '75%' }}>
                  {sendingRsvp ? 'Confirmando...' : content.buttonText}
                </button>
              </>
            ) : null}
          </div>
        </div>
      );
    }

    if (element.type === 'seatingMap') {
      const content = element.content as SeatingMapContent;
      return (
        <div key={element.id} style={base}>
          {content.eventPlanImageUrl ? (
            <img src={content.eventPlanImageUrl} alt="Plano del evento" style={{ display: 'block', height: '100%', objectFit: 'contain', width: '100%' }} />
          ) : content.eventPlanData ? (
            renderPlanData(content.eventPlanData, scale)
          ) : (
            <div style={{ alignItems: 'center', color: content.labelColor, display: 'flex', flexDirection: 'column', gap: 12 * scale, height: '100%', justifyContent: 'center', padding: 16 * scale, textAlign: 'center' }}>
              <i className="fas fa-table-cells-large" style={{ color: content.tableColor, fontSize: 34 * scale }} />
              <strong style={{ fontSize: 16 * scale }}>Plano del evento</strong>
              <span style={{ color: '#94a3b8', fontSize: 12 * scale }}>Conectar eventPlanId / eventPlanImageUrl desde backend.</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ background: frame ? '#f1f5f9' : 'transparent', display: 'flex', justifyContent: 'center', minHeight: frame ? '100vh' : undefined, width: '100%' }}>
      <div style={{ background: '#fff', boxShadow: frame ? '0 24px 80px rgba(15,23,42,.18)' : undefined, maxWidth: width, overflow: 'hidden', width: '100%' }}>
        {sections.map((section) => (
          <section id={`invitation-section-${section.id}`} key={section.id} style={{ height: section.height * scale, overflow: 'hidden', position: 'relative', width: BASE_WIDTH * scale }}>
            <div style={{ inset: 0, pointerEvents: 'none', position: 'absolute', ...backgroundStyle(section.background) }} />
            {[...section.elements].filter((element) => element.visible).sort((a, b) => a.zIndex - b.zIndex).map(renderElement)}
          </section>
        ))}
      </div>
    </div>
  );
}
