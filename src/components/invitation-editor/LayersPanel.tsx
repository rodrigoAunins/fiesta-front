import type { FC } from 'react';
import type { EditorElement } from './types';

interface Props {
  elements: EditorElement[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  text: 'fa-font',
  shape: 'fa-shapes',
  image: 'fa-image',
  button: 'fa-hand-pointer',
};

const LayersPanel: FC<Props> = ({ elements, selectedIds, onSelect, onToggleVisible, onToggleLock }) => {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="inv-layers-panel">
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
        <span style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>Capas</span>
        <span style={{ fontSize: 11, color: '#64748b' }}>{elements.length}</span>
      </div>
      {sorted.map(el => (
        <div key={el.id}
          className={`inv-layer-row ${selectedIds.includes(el.id) ? 'active' : ''}`}
          onClick={() => onSelect(el.id)}>
          <i className={`fas ${TYPE_ICONS[el.type] || 'fa-cube'}`} style={{ fontSize: 11, color: '#8b5cf6', width: 16, textAlign: 'center' }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: el.visible ? 1 : 0.4 }}>
            {el.name}
          </span>
          <button className="inv-btn-icon" style={{ width: 22, height: 22, fontSize: 10, border: 'none' }}
            onClick={e => { e.stopPropagation(); onToggleVisible(el.id); }}>
            <i className={`fas ${el.visible ? 'fa-eye' : 'fa-eye-slash'}`} />
          </button>
          <button className="inv-btn-icon" style={{ width: 22, height: 22, fontSize: 10, border: 'none' }}
            onClick={e => { e.stopPropagation(); onToggleLock(el.id); }}>
            <i className={`fas ${el.locked ? 'fa-lock' : 'fa-lock-open'}`} />
          </button>
        </div>
      ))}
      {elements.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
          Sin elementos
        </div>
      )}
    </div>
  );
};

export default LayersPanel;
