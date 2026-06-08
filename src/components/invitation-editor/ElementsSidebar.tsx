import type { FC } from 'react';
import type { SidebarTab } from './types';
import { TEMPLATES, SHAPE_PRESETS, BG_PRESETS, STOCK_BACKGROUNDS, DYNAMIC_VARIABLES, createTextElement, createShapeElement, createImageElement, createButtonElement, createSeatingMapElement, createLocationElement, createRsvpElement, nextId } from './constants';
import type { EditorElement, InvitationSection, SectionBackground } from './types';

interface Props {
  activeTab: SidebarTab;
  sections: InvitationSection[];
  selectedSectionId: string | null;
  onTabChange: (tab: SidebarTab) => void;
  onAddElement: (sectionId: string, el: EditorElement) => void;
  onAddSection: (section: InvitationSection) => void;
  onUpdateSection: (id: string, patch: Partial<InvitationSection>) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
  onMoveSection: (index: number, direction: 'up' | 'down') => void;
  onSelectSection: (id: string) => void;
  onApplyTemplate: (sections: InvitationSection[]) => void;
  onChangeBackground: (sectionId: string, bg: SectionBackground) => void;
  onRequestImageUpload: () => void;
  eventPlanData?: unknown[];
}

const TABS: Array<{ key: SidebarTab; label: string; icon: string }> = [
  { key: 'sections', label: 'Secciones', icon: 'fa-layer-group' },
  { key: 'templates', label: 'Plantillas', icon: 'fa-wand-magic-sparkles' },
  { key: 'text', label: 'Texto', icon: 'fa-font' },
  { key: 'shapes', label: 'Formas', icon: 'fa-shapes' },
  { key: 'images', label: 'Imagenes', icon: 'fa-image' },
  { key: 'backgrounds', label: 'Fondos', icon: 'fa-palette' },
  { key: 'elements', label: 'Bloques', icon: 'fa-cubes' },
  { key: 'location', label: 'Ubicacion', icon: 'fa-location-dot' },
  { key: 'rsvp', label: 'RSVP', icon: 'fa-check-to-slot' },
  { key: 'plan', label: 'Plano', icon: 'fa-table-cells-large' },
  { key: 'layers', label: 'Capas', icon: 'fa-layer-group' },
];

const ElementsSidebar: FC<Props> = ({ activeTab, sections, selectedSectionId, onTabChange, onAddElement, onAddSection, onUpdateSection, onRemoveSection, onDuplicateSection, onMoveSection, onSelectSection, onApplyTemplate, onChangeBackground, onRequestImageUpload, eventPlanData = [] }) => {
  const handleAddElement = (el: EditorElement) => {
    const targetSectionId = selectedSectionId || sections[0]?.id;
    if (targetSectionId) {
      onAddElement(targetSectionId, el);
    }
  };

  const handleChangeBackground = (bg: SectionBackground) => {
    const targetSectionId = selectedSectionId || sections[0]?.id;
    if (targetSectionId) {
      onChangeBackground(targetSectionId, bg);
    }
  };

  return (
    <div className="inv-editor-sidebar">
      <div className="inv-sidebar-tabs">
        {TABS.map(tab => (
          <button key={tab.key} className={`inv-sidebar-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => onTabChange(tab.key)}>
            <i className={`fas ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inv-sidebar-content">
        {activeTab === 'sections' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">Secciones actuales</p>
            {sections.map((section, index) => (
              <div key={section.id} className="inv-template-card" style={{ borderColor: selectedSectionId === section.id ? '#8b5cf6' : undefined, padding: 10 }}>
                <button type="button" onClick={() => onSelectSection(section.id)} style={{ background: 'transparent', border: 0, color: '#e2e8f0', cursor: 'pointer', fontWeight: 800, padding: 0, textAlign: 'left', width: '100%' }}>
                  {section.name}
                </button>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 72px', marginTop: 8 }}>
                  <input className="inv-prop-input" value={section.name} onChange={(event) => onUpdateSection(section.id, { name: event.target.value })} />
                  <input className="inv-prop-input" type="number" value={section.height} onChange={(event) => onUpdateSection(section.id, { height: Math.max(320, Number(event.target.value)) })} />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="inv-btn-icon" onClick={() => onMoveSection(index, 'up')} disabled={index === 0} data-tooltip="Subir"><i className="fas fa-arrow-up" /></button>
                  <button className="inv-btn-icon" onClick={() => onMoveSection(index, 'down')} disabled={index === sections.length - 1} data-tooltip="Bajar"><i className="fas fa-arrow-down" /></button>
                  <button className="inv-btn-icon" onClick={() => onDuplicateSection(section.id)} data-tooltip="Duplicar"><i className="fas fa-copy" /></button>
                  <button className="inv-btn-icon" onClick={() => sections.length > 1 && onRemoveSection(section.id)} disabled={sections.length <= 1} data-tooltip="Eliminar" style={{ color: '#fb7185' }}><i className="fas fa-trash" /></button>
                </div>
              </div>
            ))}
            <p className="inv-prop-label" style={{ marginTop: 14 }}>Agregar seccion</p>
            {[
              { type: 'cover', name: 'Portada', height: 900, background: { type: 'color', value: '#ffffff' } as SectionBackground },
              { type: 'location', name: 'Ubicacion', height: 700, background: { type: 'color', value: '#f8fafc' } as SectionBackground },
              { type: 'rsvp', name: 'Confirmacion', height: 700, background: { type: 'color', value: '#ffffff' } as SectionBackground },
              { type: 'gallery', name: 'Galeria', height: 760, background: { type: 'color', value: '#fff7ed' } as SectionBackground },
              { type: 'custom', name: 'Personalizada', height: 650, background: { type: 'color', value: '#ffffff' } as SectionBackground },
            ].map((preset) => (
              <button
                key={preset.name}
                className="inv-btn inv-btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onAddSection({ id: nextId('sec'), type: preset.type as InvitationSection['type'], name: preset.name, height: preset.height, background: preset.background, elements: [] })}
              >
                <i className="fas fa-plus" /> {preset.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'templates' && (
          <div>
            <p className="inv-prop-label">Plantillas iniciales</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {TEMPLATES.map(tpl => (
                <div key={tpl.id} className="inv-template-card" onClick={() => onApplyTemplate(tpl.sections)}>
                  <div style={{ height: 60, borderRadius: 8, marginBottom: 8, background: tpl.sections[0]?.background?.type === 'gradient' ? `linear-gradient(${tpl.sections[0].background.angle || 135}deg, ${tpl.sections[0].background.value}, ${tpl.sections[0].background.secondaryValue})` : tpl.sections[0]?.background?.value || '#ccc' }} />
                  <p style={{ fontWeight: 700, fontSize: 13 }}>{tpl.name}</p>
                  <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{tpl.sections.length} secciones</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">Agregar texto</p>
            {[
              { label: 'Titulo', size: 64, weight: '800' },
              { label: 'Subtitulo', size: 36, weight: '600' },
              { label: 'Parrafo', size: 22, weight: '400' },
              { label: 'Etiqueta', size: 14, weight: '700', spacing: 4 },
            ].map(preset => (
              <button key={preset.label} className="inv-btn inv-btn-ghost" style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => handleAddElement(createTextElement({ name: preset.label, content: { text: preset.label, fontFamily: "'Inter', sans-serif", fontSize: preset.size, fontWeight: preset.weight, fontStyle: 'normal', color: '#1a1a2e', textAlign: 'center', lineHeight: 1.3, letterSpacing: preset.spacing || 0, textDecoration: 'none' } as any }))}>
                <i className="fas fa-font" /> {preset.label}
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#64748b' }}>{preset.size}px</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'shapes' && (
          <div>
            <p className="inv-prop-label">Formas</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SHAPE_PRESETS.map(preset => (
                <button key={preset.label} className="inv-btn inv-btn-ghost" style={{ flexDirection: 'column', padding: 12, width: '100%' }}
                  onClick={() => handleAddElement(createShapeElement(preset.shape))}>
                  <i className={`fas ${preset.icon}`} style={{ fontSize: 20 }} />
                  <span style={{ fontSize: 11 }}>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">Imagenes</p>
            <button className="inv-btn inv-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14 }} onClick={onRequestImageUpload}>
              <i className="fas fa-upload" /> Subir imagen
            </button>
          </div>
        )}

        {activeTab === 'backgrounds' && (
          <div>
            <p className="inv-prop-label">Fondos</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {BG_PRESETS.map(preset => (
                <button key={preset.label} className="inv-template-card" style={{ padding: 8 }}
                  onClick={() => handleChangeBackground(preset.bg)}>
                  <div style={{
                    height: 50, borderRadius: 8, marginBottom: 6,
                    background: preset.bg.type === 'gradient'
                      ? `linear-gradient(${preset.bg.angle || 135}deg, ${preset.bg.value}, ${preset.bg.secondaryValue})`
                      : preset.bg.value,
                    border: preset.bg.value === '#ffffff' ? '1px solid #e5e7eb' : 'none',
                  }} />
                  <p style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{preset.label}</p>
                </button>
              ))}
            </div>
            <p className="inv-prop-label" style={{ marginTop: 16 }}>Stock</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {STOCK_BACKGROUNDS.map(preset => (
                <button key={preset.value} className="inv-template-card" style={{ padding: 8 }}
                  onClick={() => handleChangeBackground({ type: 'image', value: preset.value })}>
                  <div style={{ height: 54, borderRadius: 8, marginBottom: 6, backgroundImage: `url(${preset.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <p style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{preset.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'elements' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">Bloques especiales</p>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => handleAddElement(createButtonElement())}>
              <i className="fas fa-hand-pointer" /> Boton
            </button>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => handleAddElement(createButtonElement({ name: 'Ubicacion', content: { text: 'Ver ubicacion', fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: '700', color: '#ffffff', textAlign: 'center', action: 'map' } as any, styles: { backgroundColor: '#0f766e', backgroundOpacity: 1, borderColor: 'transparent', borderWidth: 0, borderRadius: 14, boxShadow: 'none', padding: 0 } }))}>
              <i className="fas fa-location-dot" /> Boton ubicacion
            </button>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => handleAddElement(createButtonElement({ name: 'Calendario', content: { text: 'Agregar al calendario', fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: '700', color: '#ffffff', textAlign: 'center', action: 'calendar' } as any, styles: { backgroundColor: '#3b82f6', backgroundOpacity: 1, borderColor: 'transparent', borderWidth: 0, borderRadius: 14, boxShadow: 'none', padding: 0 } }))}>
              <i className="fas fa-calendar-plus" /> Boton calendario
            </button>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => handleAddElement(createSeatingMapElement())}>
              <i className="fas fa-map" /> Plano de ubicacion
            </button>
          </div>
        )}

        {activeTab === 'location' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">Ubicacion</p>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleAddElement(createLocationElement())}>
              <i className="fas fa-location-dot" /> Bloque de ubicacion
            </button>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleAddElement(createButtonElement({ name: 'Ver ubicacion', content: { text: 'Ver ubicacion', fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: '700', color: '#ffffff', textAlign: 'center', action: 'map' } as any }))}>
              <i className="fas fa-route" /> Boton ver ubicacion
            </button>
          </div>
        )}

        {activeTab === 'rsvp' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">RSVP</p>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleAddElement(createRsvpElement())}>
              <i className="fas fa-check-to-slot" /> Formulario RSVP
            </button>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleAddElement(createButtonElement())}>
              <i className="fas fa-hand-pointer" /> Boton RSVP
            </button>
          </div>
        )}

        {activeTab === 'plan' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="inv-prop-label">Plano</p>
            <button className="inv-btn inv-btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => handleAddElement(createSeatingMapElement({ content: { showTables: true, tableColor: '#8b5cf6', labelColor: '#0f172a', eventPlanId: 'workspace-layout', eventPlanData } as any }))}>
              <i className="fas fa-table-cells-large" /> Importar plano del evento
            </button>
            <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
              Importa el plano actual de Planos y mesas. Si cambias el plano, volve a importarlo para actualizarlo en esta invitacion.
            </p>
          </div>
        )}

        {activeTab === 'layers' && (
          <div>
            <p className="inv-prop-label">Variables dinamicas</p>
            <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
              Usa estas variables en textos para que se reemplacen con datos reales del evento.
            </p>
            <div style={{ display: 'grid', gap: 4 }}>
              {DYNAMIC_VARIABLES.map(v => (
                <div key={v.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: 12 }}>
                  <span style={{ color: '#94a3b8' }}>{v.label}</span>
                  <code style={{ fontSize: 11, color: '#a78bfa', cursor: 'pointer' }}
                    onClick={() => navigator.clipboard?.writeText(v.key)}>
                    {v.key}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ElementsSidebar;
