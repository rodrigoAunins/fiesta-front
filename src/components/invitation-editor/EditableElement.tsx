import { useRef, useEffect, useCallback, type FC } from 'react';
import interact from 'interactjs';
import type { EditorElement, TextContent, ShapeContent, ImageContent, ButtonContent, SeatingMapContent, LocationContent, RsvpContent } from './types';

interface Props {
  element: EditorElement;
  sectionId: string;
  isSelected: boolean;
  zoom: number;
  onSelect: (id: string, sectionId: string, additive: boolean) => void;
  onUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onUpdateContent: (id: string, patch: Record<string, unknown>) => void;
  onDoubleClick: (id: string) => void;
}

const EditableElement: FC<Props> = ({ element, sectionId, isSelected, zoom, onSelect, onUpdate, onUpdateContent, onDoubleClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { id, type, x, y, width, height, rotation, opacity, locked, visible, styles, content } = element;

  // ─── Interact.js for drag + resize ───────────────────────────────

  useEffect(() => {
    const node = ref.current;
    if (!node || locked) return;

    const interactable = interact(node)
      .draggable({
        inertia: false,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: false
          })
        ],
        listeners: {
          move(event) {
            // Interact.js dx/dy is in screen pixels, we must divide by zoom to get internal canvas coordinates
            const dx = event.dx / zoom;
            const dy = event.dy / zoom;
            
            const currentX = parseFloat(node.getAttribute('data-x') || String(element.x));
            const currentY = parseFloat(node.getAttribute('data-y') || String(element.y));
            
            const newX = currentX + dx;
            const newY = currentY + dy;
            
            node.setAttribute('data-x', String(newX));
            node.setAttribute('data-y', String(newY));
            node.style.left = `${newX * zoom}px`;
            node.style.top = `${newY * zoom}px`;
          },
          end(event) {
            const finalX = parseFloat(node.getAttribute('data-x') || String(element.x));
            const finalY = parseFloat(node.getAttribute('data-y') || String(element.y));
            onUpdate(id, { x: finalX, y: finalY });
          }
        },
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
          interact.modifiers.restrictSize({ min: { width: 20, height: 10 } }),
          interact.modifiers.restrictEdges({
            outer: 'parent'
          })
        ],
        listeners: {
          move(event) {
            const dx = event.deltaRect.left / zoom;
            const dy = event.deltaRect.top / zoom;
            const dw = event.deltaRect.width / zoom;
            const dh = event.deltaRect.height / zoom;
            
            const currentX = parseFloat(node.getAttribute('data-x') || String(element.x));
            const currentY = parseFloat(node.getAttribute('data-y') || String(element.y));
            const currentW = parseFloat(node.getAttribute('data-w') || String(element.width));
            const currentH = parseFloat(node.getAttribute('data-h') || String(element.height));
            
            const newX = currentX + dx;
            const newY = currentY + dy;
            const newW = currentW + dw;
            const newH = currentH + dh;
            
            node.setAttribute('data-x', String(newX));
            node.setAttribute('data-y', String(newY));
            node.setAttribute('data-w', String(newW));
            node.setAttribute('data-h', String(newH));
            
            node.style.left = `${newX * zoom}px`;
            node.style.top = `${newY * zoom}px`;
            node.style.width = `${newW * zoom}px`;
            node.style.height = `${newH * zoom}px`;
          },
          end() {
            const finalX = parseFloat(node.getAttribute('data-x') || String(element.x));
            const finalY = parseFloat(node.getAttribute('data-y') || String(element.y));
            const finalW = parseFloat(node.getAttribute('data-w') || String(element.width));
            const finalH = parseFloat(node.getAttribute('data-h') || String(element.height));
            onUpdate(id, { x: finalX, y: finalY, width: finalW, height: finalH });
          }
        },
      });

    return () => { interactable.unset(); };
  }, [id, locked, zoom, element.x, element.y, onUpdate]);

  if (!visible) return null;

  const bgColor = styles.backgroundColor === 'transparent'
    ? 'transparent'
    : `${styles.backgroundColor}${Math.round(styles.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;

  const containerStyle: React.CSSProperties = {
    left: x * zoom,
    top: y * zoom,
    width: width * zoom,
    height: height * zoom,
    transform: `rotate(${rotation}deg)`,
    opacity,
    background: bgColor,
    borderColor: styles.borderColor,
    borderWidth: styles.borderWidth,
    borderStyle: styles.borderWidth > 0 ? 'solid' : 'none',
    borderRadius: styles.borderRadius,
    boxShadow: styles.boxShadow !== 'none' ? styles.boxShadow : undefined,
    zIndex: element.zIndex,
    touchAction: 'none',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(id, sectionId, e.shiftKey);
  };

  // ─── Render by type ──────────────────────────────────────────────

  const renderContent = () => {
    if (type === 'text') {
      const tc = content as TextContent;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: tc.textAlign === 'center' ? 'center' : tc.textAlign === 'right' ? 'flex-end' : 'flex-start', padding: 8 * zoom, overflow: 'hidden' }}>
          <span style={{
            fontFamily: tc.fontFamily,
            fontSize: tc.fontSize * zoom,
            fontWeight: tc.fontWeight as any,
            fontStyle: tc.fontStyle,
            color: tc.color,
            textAlign: tc.textAlign,
            lineHeight: tc.lineHeight,
            letterSpacing: tc.letterSpacing * zoom,
            textDecoration: tc.textDecoration,
            width: '100%',
            wordBreak: 'break-word',
          }}>
            {tc.text}
          </span>
        </div>
      );
    }

    if (type === 'shape') {
      const sc = content as ShapeContent;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sc.text && <span style={{ color: sc.textColor, fontSize: sc.textSize * zoom, fontFamily: sc.textFont, fontWeight: 700 }}>{sc.text}</span>}
        </div>
      );
    }

    if (type === 'image') {
      const ic = content as ImageContent;
      if (!ic.src) {
        return (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#94a3b8', background: 'rgba(255,255,255,0.08)' }}>
            <i className="fas fa-image" style={{ fontSize: 28 * zoom }} />
            <span style={{ fontSize: 11 * zoom, fontWeight: 700 }}>Sin imagen</span>
          </div>
        );
      }
      return <img src={ic.src} alt={ic.alt} style={{ width: '100%', height: '100%', objectFit: ic.objectFit, borderRadius: styles.borderRadius, display: 'block' }} draggable={false} />;
    }

    if (type === 'button') {
      const bc = content as ButtonContent;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 * zoom }}>
          <span style={{
            fontFamily: bc.fontFamily,
            fontSize: bc.fontSize * zoom,
            fontWeight: bc.fontWeight as any,
            color: bc.color,
            textAlign: bc.textAlign,
          }}>
            {bc.text}
          </span>
        </div>
      );
    }

    if (type === 'seatingMap') {
      const smc = content as SeatingMapContent;
      const planItems = Array.isArray((smc as any).eventPlanData) ? ((smc as any).eventPlanData as Array<any>) : [];
      if (planItems.length > 0) {
        return (
          <div style={{ width: '100%', height: '100%', padding: 12 * zoom }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', background: '#f8fafc', borderRadius: 12 * zoom, overflow: 'hidden' }}>
              {planItems.map((item) => (
                <div key={item.id || `${item.label}-${item.x}-${item.y}`} style={{
                  position: 'absolute',
                  left: `${(Number(item.x || 0) / 760) * 100}%`,
                  top: `${(Number(item.y || 0) / 540) * 100}%`,
                  width: Math.max(30, Number(item.w || 80) * 0.35 * zoom),
                  height: Math.max(22, Number(item.h || 60) * 0.35 * zoom),
                  borderRadius: item.type === 'roundTable' || item.type === 'vipTable' || item.type === 'danceFloor' ? 999 : 8 * zoom,
                  background: item.type === 'vipTable' ? '#fbbf24' : item.type === 'stage' ? '#7c3aed' : item.type === 'entrance' ? '#14b8a6' : '#ec4899',
                  color: '#fff',
                  fontSize: 9 * zoom,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}>{item.label}</div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 * zoom, padding: 16 * zoom }}>
          <i className="fas fa-map" style={{ fontSize: 32 * zoom, color: smc.tableColor }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16 * zoom, fontWeight: '700', color: smc.labelColor, textAlign: 'center' }}>
            Plano de Ubicación
          </span>
          <span style={{ fontSize: 12 * zoom, color: 'rgba(255,255,255,0.6)' }}>
            (El plano real se mostrará al invitado)
          </span>
        </div>
      );
    }

    if (type === 'location') {
      const lc = content as LocationContent;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 * zoom, padding: 24 * zoom }}>
          <i className="fas fa-map-marker-alt" style={{ fontSize: 40 * zoom, color: lc.buttonColor }} />
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 * zoom }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 24 * zoom, fontWeight: '700', color: '#1e293b' }}>
              {lc.placeName}
            </span>
            <span style={{ fontSize: 16 * zoom, color: '#64748b' }}>
              {lc.address}
            </span>
          </div>
          <div style={{ 
            marginTop: 8 * zoom,
            padding: `${12 * zoom}px ${32 * zoom}px`, 
            background: lc.buttonColor, 
            color: 'white', 
            borderRadius: 999,
            fontSize: 16 * zoom,
            fontWeight: 600
          }}>
            {lc.buttonText}
          </div>
        </div>
      );
    }

    if (type === 'rsvp') {
      const rc = content as RsvpContent;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 * zoom, padding: 32 * zoom }}>
          <i className="fas fa-envelope-open-text" style={{ fontSize: 40 * zoom, color: '#ec4899' }} />
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 * zoom }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 28 * zoom, fontWeight: '800', color: '#0f172a' }}>
              {rc.title}
            </span>
            <span style={{ fontSize: 16 * zoom, color: '#64748b', maxWidth: '80%' }}>
              {rc.description}
            </span>
          </div>
          
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 * zoom, marginTop: 16 * zoom, maxWidth: 400 * zoom }}>
            {rc.fields.includes('name') && (
              <div style={{ width: '100%', height: 48 * zoom, background: '#f8fafc', border: `${1 * zoom}px solid #e2e8f0`, borderRadius: 8 * zoom }} />
            )}
            {rc.fields.includes('companions') && (
              <div style={{ width: '100%', height: 48 * zoom, background: '#f8fafc', border: `${1 * zoom}px solid #e2e8f0`, borderRadius: 8 * zoom }} />
            )}
            {rc.fields.includes('message') && (
              <div style={{ width: '100%', height: 96 * zoom, background: '#f8fafc', border: `${1 * zoom}px solid #e2e8f0`, borderRadius: 8 * zoom }} />
            )}
            <div style={{ 
              marginTop: 8 * zoom,
              width: '100%',
              height: 48 * zoom,
              background: '#0f172a', 
              color: 'white', 
              borderRadius: 8 * zoom,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16 * zoom,
              fontWeight: 600
            }}>
              {rc.buttonText}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={ref}
      data-x={element.x}
      data-y={element.y}
      data-w={element.width}
      data-h={element.height}
      className={`inv-element ${isSelected ? 'selected' : ''} ${locked ? 'locked' : ''}`}
      style={containerStyle}
      onClick={handleClick}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick(id); }}
    >
      {renderContent()}

      {isSelected && !locked && (
        <>
          {['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].map(pos => (
            <div key={pos} className={`resize-handle ${pos}`} />
          ))}
          <div className="rotate-handle">
            <i className="fas fa-rotate" />
          </div>
        </>
      )}
    </div>
  );
};

export default EditableElement;
