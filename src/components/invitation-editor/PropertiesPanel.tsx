import type { FC } from 'react';
import type { EditorElement, InvitationSection, TextContent, ShapeContent, ImageContent, ButtonContent } from './types';
import { FONT_OPTIONS, COLOR_PRESETS } from './constants';

interface Props {
  element: EditorElement | null;
  sections: InvitationSection[];
  onUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onUpdateContent: (id: string, patch: Record<string, unknown>) => void;
  onUpdateStyles: (id: string, patch: Partial<EditorElement['styles']>) => void;
  onDelete: (ids: string[]) => void;
  onDuplicate: (ids: string[]) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onRequestImageUpload: (elementId: string) => void;
}

const PropertiesPanel: FC<Props> = ({ element, sections, onUpdate, onUpdateContent, onUpdateStyles, onDelete, onDuplicate, onBringForward, onSendBackward, onRequestImageUpload }) => {
  if (!element) {
    return (
      <div className="inv-editor-properties">
        <div style={{ padding: 24, textAlign: 'center' }}>
          <i className="fas fa-mouse-pointer" style={{ fontSize: 32, color: '#4a3f6b', marginBottom: 12 }} />
          <p style={{ fontWeight: 700, color: '#94a3b8' }}>Selecciona un elemento</p>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
            Haz click en un elemento del canvas para ver y editar sus propiedades.
          </p>
        </div>
      </div>
    );
  }

  const isText = element.type === 'text';
  const isShape = element.type === 'shape';
  const isImage = element.type === 'image';
  const isButton = element.type === 'button';
  const isLocation = element.type === 'location';
  const isRsvp = element.type === 'rsvp';
  const content = element.content;
  const styles = element.styles;

  return (
    <div className="inv-editor-properties">
      {/* Header */}
      <div className="inv-prop-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{element.name}</span>
          <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{element.type}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="inv-btn-icon" onClick={() => onDuplicate([element.id])} data-tooltip="Duplicar"><i className="fas fa-copy" /></button>
          <button className="inv-btn-icon" onClick={() => onBringForward(element.id)} data-tooltip="Traer adelante"><i className="fas fa-arrow-up" /></button>
          <button className="inv-btn-icon" onClick={() => onSendBackward(element.id)} data-tooltip="Enviar atras"><i className="fas fa-arrow-down" /></button>
          <button className="inv-btn-icon" onClick={() => onUpdate(element.id, { locked: !element.locked })} data-tooltip={element.locked ? 'Desbloquear' : 'Bloquear'}>
            <i className={`fas ${element.locked ? 'fa-lock' : 'fa-lock-open'}`} />
          </button>
          <button className="inv-btn-icon" onClick={() => onUpdate(element.id, { visible: !element.visible })} data-tooltip={element.visible ? 'Ocultar' : 'Mostrar'}>
            <i className={`fas ${element.visible ? 'fa-eye' : 'fa-eye-slash'}`} />
          </button>
          <button className="inv-btn-icon" onClick={() => onDelete([element.id])} data-tooltip="Eliminar" style={{ color: '#f43f5e' }}>
            <i className="fas fa-trash" />
          </button>
        </div>
      </div>

      {/* Position & Size */}
      <div className="inv-prop-section">
        <p className="inv-prop-label">Posicion y tamaño</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['X', 'x', element.x], ['Y', 'y', element.y],
            ['Ancho', 'width', element.width], ['Alto', 'height', element.height],
          ].map(([label, key, val]) => (
            <div key={key as string} className="inv-prop-row" style={{ margin: 0 }}>
              <span style={{ fontSize: 11, color: '#64748b', width: 36 }}>{label as string}</span>
              <input type="number" className="inv-prop-input inv-prop-input-sm" style={{ flex: 1 }}
                value={Math.round(val as number)}
                onChange={e => onUpdate(element.id, { [key as string]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="inv-prop-row" style={{ marginTop: 8 }}>
          <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Rotacion</span>
          <input type="range" min={-180} max={180} value={element.rotation}
            onChange={e => onUpdate(element.id, { rotation: Number(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 11, width: 36, textAlign: 'right' }}>{element.rotation}°</span>
        </div>
        <div className="inv-prop-row">
          <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Opacidad</span>
          <input type="range" min={0} max={1} step={0.05} value={element.opacity}
            onChange={e => onUpdate(element.id, { opacity: Number(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 11, width: 36, textAlign: 'right' }}>{Math.round(element.opacity * 100)}%</span>
        </div>
      </div>

      {/* Text content */}
      {(isText || isButton) && (
        <div className="inv-prop-section">
          <p className="inv-prop-label">Texto</p>
          <textarea className="inv-prop-input" rows={3}
            value={(content as TextContent | ButtonContent).text}
            onChange={e => onUpdateContent(element.id, { text: e.target.value })} />
          <div className="inv-prop-row" style={{ marginTop: 8 }}>
            <select className="inv-prop-select" value={(content as TextContent).fontFamily}
              onChange={e => onUpdateContent(element.id, { fontFamily: e.target.value })}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="inv-prop-row">
            <input type="number" className="inv-prop-input inv-prop-input-sm" value={(content as TextContent).fontSize}
              onChange={e => onUpdateContent(element.id, { fontSize: Number(e.target.value) })} />
            <select className="inv-prop-select" style={{ width: 80 }} value={(content as TextContent).fontWeight}
              onChange={e => onUpdateContent(element.id, { fontWeight: e.target.value })}>
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="600">Semi</option>
              <option value="700">Bold</option>
              <option value="800">Extra</option>
              <option value="900">Black</option>
            </select>
            {isText && (
              <select className="inv-prop-select" style={{ width: 70 }} value={(content as TextContent).fontStyle}
                onChange={e => onUpdateContent(element.id, { fontStyle: e.target.value })}>
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            )}
          </div>
          <div className="inv-prop-row">
            {['left', 'center', 'right'].map(a => (
              <button key={a} className={`inv-btn-icon ${(content as TextContent).textAlign === a ? 'active' : ''}`}
                onClick={() => onUpdateContent(element.id, { textAlign: a })}>
                <i className={`fas fa-align-${a}`} />
              </button>
            ))}
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Color</span>
            <input type="color" value={(content as TextContent).color}
              onChange={e => onUpdateContent(element.id, { color: e.target.value })}
              style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
            <input className="inv-prop-input" style={{ flex: 1 }} value={(content as TextContent).color}
              onChange={e => onUpdateContent(element.id, { color: e.target.value })} />
          </div>
          {isText && (
            <>
              <div className="inv-prop-row">
                <span style={{ fontSize: 11, color: '#64748b', width: 70 }}>Interlineado</span>
                <input type="number" step={0.1} className="inv-prop-input inv-prop-input-sm"
                  value={(content as TextContent).lineHeight}
                  onChange={e => onUpdateContent(element.id, { lineHeight: Number(e.target.value) })} />
              </div>
              <div className="inv-prop-row">
                <span style={{ fontSize: 11, color: '#64748b', width: 70 }}>Espaciado</span>
                <input type="number" className="inv-prop-input inv-prop-input-sm"
                  value={(content as TextContent).letterSpacing}
                  onChange={e => onUpdateContent(element.id, { letterSpacing: Number(e.target.value) })} />
              </div>
            </>
          )}
        </div>
      )}

      {isButton && (
        <div className="inv-prop-section">
          <p className="inv-prop-label">Accion del boton</p>
          <div className="inv-prop-row">
            <select className="inv-prop-select" value={(content as ButtonContent).action}
              onChange={e => onUpdateContent(element.id, { action: e.target.value })}>
              <option value="rsvp">RSVP</option>
              <option value="section">Ir a seccion</option>
              <option value="map">Ver ubicacion</option>
              <option value="link">Abrir link</option>
              <option value="whatsapp">Abrir WhatsApp</option>
              <option value="calendar">Agregar al calendario</option>
            </select>
          </div>
          {(content as ButtonContent).action === 'section' && (
            <div className="inv-prop-row">
              <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Seccion</span>
              <select className="inv-prop-select" value={(content as ButtonContent).targetSection || ''}
                onChange={e => onUpdateContent(element.id, { targetSection: e.target.value })}>
                <option value="">Elegir</option>
                {sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
              </select>
            </div>
          )}
          {['link', 'whatsapp', 'map', 'calendar'].includes((content as ButtonContent).action) && (
            <div className="inv-prop-row">
              <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>URL</span>
              <input className="inv-prop-input" value={(content as ButtonContent).url || ''}
                placeholder={(content as ButtonContent).action === 'whatsapp' ? 'https://wa.me/549...' : 'https://...'}
                onChange={e => onUpdateContent(element.id, { url: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {/* Shape content */}
      {isShape && (
        <div className="inv-prop-section">
          <p className="inv-prop-label">Forma</p>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Texto</span>
            <input className="inv-prop-input" value={(content as ShapeContent).text}
              onChange={e => onUpdateContent(element.id, { text: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Color texto</span>
            <input type="color" value={(content as ShapeContent).textColor}
              onChange={e => onUpdateContent(element.id, { textColor: e.target.value })}
              style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Size</span>
            <input type="number" className="inv-prop-input inv-prop-input-sm"
              value={(content as ShapeContent).textSize}
              onChange={e => onUpdateContent(element.id, { textSize: Number(e.target.value) })} />
          </div>
        </div>
      )}

      {/* Image content */}
      {isImage && (
        <div className="inv-prop-section">
          <p className="inv-prop-label">Imagen</p>
          <button className="inv-btn inv-btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            onClick={() => onRequestImageUpload(element.id)}>
            <i className="fas fa-upload" /> Cambiar imagen
          </button>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Ajuste</span>
            <select className="inv-prop-select" value={(content as ImageContent).objectFit}
              onChange={e => onUpdateContent(element.id, { objectFit: e.target.value })}>
              <option value="cover">Cubrir</option>
              <option value="contain">Contener</option>
              <option value="fill">Estirar</option>
            </select>
          </div>
        </div>
      )}

      {/* Location content */}
      {isLocation && (
        <div className="inv-prop-section">
          <p className="inv-prop-label">Ubicación</p>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Nombre</span>
            <input className="inv-prop-input" value={(content as any).placeName}
              onChange={e => onUpdateContent(element.id, { placeName: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Dirección</span>
            <input className="inv-prop-input" value={(content as any).address}
              onChange={e => onUpdateContent(element.id, { address: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Maps URL</span>
            <input className="inv-prop-input" value={(content as any).mapsUrl}
              onChange={e => onUpdateContent(element.id, { mapsUrl: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Botón</span>
            <input className="inv-prop-input" value={(content as any).buttonText}
              onChange={e => onUpdateContent(element.id, { buttonText: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Color Botón</span>
            <input type="color" value={(content as any).buttonColor}
              onChange={e => onUpdateContent(element.id, { buttonColor: e.target.value })}
              style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
          </div>
        </div>
      )}

      {/* RSVP content */}
      {isRsvp && (
        <div className="inv-prop-section">
          <p className="inv-prop-label">Formulario RSVP</p>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Título</span>
            <input className="inv-prop-input" value={(content as any).title}
              onChange={e => onUpdateContent(element.id, { title: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Desc.</span>
            <input className="inv-prop-input" value={(content as any).description}
              onChange={e => onUpdateContent(element.id, { description: e.target.value })} />
          </div>
          <div className="inv-prop-row">
            <span style={{ fontSize: 11, color: '#64748b', width: 60 }}>Botón</span>
            <input className="inv-prop-input" value={(content as any).buttonText}
              onChange={e => onUpdateContent(element.id, { buttonText: e.target.value })} />
          </div>
          <p className="inv-prop-label" style={{ marginTop: 12 }}>Campos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['name', 'companions', 'message'].map(field => {
              const fields = (content as any).fields || [];
              const has = fields.includes(field);
              return (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={has} onChange={e => {
                    const next = e.target.checked ? [...fields, field] : fields.filter((f: string) => f !== field);
                    onUpdateContent(element.id, { fields: next });
                  }} />
                  {field === 'name' ? 'Nombre' : field === 'companions' ? 'Acompañantes' : 'Mensaje'}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Common styles */}
      <div className="inv-prop-section">
        <p className="inv-prop-label">Fondo y borde</p>
        <div className="inv-prop-row">
          <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Fondo</span>
          <input type="color" value={styles.backgroundColor === 'transparent' ? '#ffffff' : styles.backgroundColor}
            onChange={e => onUpdateStyles(element.id, { backgroundColor: e.target.value })}
            style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
          <input className="inv-prop-input" style={{ flex: 1 }} value={styles.backgroundColor}
            onChange={e => onUpdateStyles(element.id, { backgroundColor: e.target.value })} />
        </div>
        <div className="inv-prop-row">
          <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Borde</span>
          <input type="color" value={styles.borderColor === 'transparent' ? '#000000' : styles.borderColor}
            onChange={e => onUpdateStyles(element.id, { borderColor: e.target.value })}
            style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
          <input type="number" className="inv-prop-input inv-prop-input-sm" value={styles.borderWidth}
            onChange={e => onUpdateStyles(element.id, { borderWidth: Number(e.target.value) })} />
        </div>
        <div className="inv-prop-row">
          <span style={{ fontSize: 11, color: '#64748b', width: 50 }}>Radio</span>
          <input type="range" min={0} max={999} value={styles.borderRadius}
            onChange={e => onUpdateStyles(element.id, { borderRadius: Number(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{styles.borderRadius}</span>
        </div>
      </div>

      {/* Quick colors */}
      <div className="inv-prop-section">
        <p className="inv-prop-label">Colores rapidos</p>
        <div className="inv-color-grid">
          {COLOR_PRESETS.map(c => (
            <button key={c} className="inv-color-swatch" style={{ backgroundColor: c }}
              onClick={() => {
                if (isText || isButton) onUpdateContent(element.id, { color: c });
                else onUpdateStyles(element.id, { backgroundColor: c });
              }} />
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="inv-prop-section">
        <p className="inv-prop-label">Nombre en capas</p>
        <input className="inv-prop-input" value={element.name}
          onChange={e => onUpdate(element.id, { name: e.target.value })} />
      </div>
    </div>
  );
};

export default PropertiesPanel;
