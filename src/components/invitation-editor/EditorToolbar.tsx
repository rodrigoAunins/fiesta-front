import type { FC } from 'react';

interface Props {
  name: string;
  onNameChange: (v: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomChange: (v: number) => void;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: string | null;
  onSave: () => void;
  onPreview: () => void;
  onBack: () => void;
  layersPanelOpen: boolean;
  onToggleLayers: () => void;
  isPublished?: boolean;
  publicSlug?: string | null;
  onPublish?: () => void;
  onCopyLink?: () => void;
}

const EditorToolbar: FC<Props> = ({
  name, onNameChange,
  canUndo, canRedo, onUndo, onRedo,
  zoom, onZoomChange,
  isDirty, isSaving, lastSaved,
  onSave, onPreview, onBack,
  layersPanelOpen, onToggleLayers,
  isPublished, publicSlug, onPublish, onCopyLink,
}) => {
  const saveLabel = isSaving ? 'Guardando...' : isDirty ? 'Sin guardar' : 'Guardado';
  const saveClass = isSaving ? 'saving' : isDirty ? 'dirty' : 'saved';

  return (
    <div className="inv-editor-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="inv-btn-icon" onClick={onBack} data-tooltip="Volver al workspace">
          <i className="fas fa-arrow-left" />
        </button>
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          className="inv-prop-input"
          style={{ width: 200, fontSize: 14, fontWeight: 700, background: 'transparent', border: 'none', color: '#f1f5f9' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="inv-btn-icon" disabled={!canUndo} onClick={onUndo} data-tooltip="Deshacer (Ctrl+Z)">
          <i className="fas fa-rotate-left" />
        </button>
        <button className="inv-btn-icon" disabled={!canRedo} onClick={onRedo} data-tooltip="Rehacer (Ctrl+Y)">
          <i className="fas fa-rotate-right" />
        </button>

        <div style={{ width: 1, height: 24, background: 'rgba(139,92,246,0.15)', margin: '0 4px' }} />

        <button className="inv-btn-icon" onClick={() => onZoomChange(Math.max(0.15, zoom - 0.05))} data-tooltip="Alejar">
          <i className="fas fa-minus" />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'center', color: '#94a3b8' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="inv-btn-icon" onClick={() => onZoomChange(Math.min(1.5, zoom + 0.05))} data-tooltip="Acercar">
          <i className="fas fa-plus" />
        </button>

        <div style={{ width: 1, height: 24, background: 'rgba(139,92,246,0.15)', margin: '0 4px' }} />

        <button
          className={`inv-btn-icon ${layersPanelOpen ? 'active' : ''}`}
          onClick={onToggleLayers}
          data-tooltip="Capas"
        >
          <i className="fas fa-layer-group" />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`inv-save-badge ${saveClass}`}>{saveLabel}</span>
        <button className="inv-btn inv-btn-ghost" onClick={onSave} disabled={isSaving}>
          <i className="fas fa-floppy-disk" /> Guardar
        </button>
        <button className="inv-btn inv-btn-ghost" onClick={onPreview}>
          <i className="fas fa-eye" /> Preview
        </button>
        
        <div style={{ width: 1, height: 24, background: 'rgba(139,92,246,0.15)', margin: '0 4px' }} />
        
        {publicSlug && isPublished && (
          <button className="inv-btn inv-btn-ghost" onClick={onCopyLink} data-tooltip="Copiar link público">
            <i className="fas fa-link" />
          </button>
        )}
        <button 
          className={`inv-btn ${isPublished ? 'inv-btn-ghost' : 'inv-btn-primary'}`} 
          onClick={onPublish}
          style={isPublished ? { color: '#0ea5e9', borderColor: '#0ea5e9' } : {}}
        >
          <i className={`fas ${isPublished ? 'fa-globe' : 'fa-rocket'}`} /> 
          {isPublished ? 'Publicado' : 'Publicar'}
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;
