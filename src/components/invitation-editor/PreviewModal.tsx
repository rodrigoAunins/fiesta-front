import { useState, type FC } from 'react';
import type { InvitationSection } from './types';
import InvitationRenderer from './InvitationRenderer';

interface Props {
  sections: InvitationSection[];
  onClose: () => void;
}

const PreviewModal: FC<Props> = ({ sections, onClose }) => {
  const [mode, setMode] = useState<'mobile' | 'desktop'>('mobile');
  const width = mode === 'desktop' ? 800 : 390;

  return (
    <div className="inv-preview-overlay" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <button className={`inv-btn ${mode === 'mobile' ? 'inv-btn-primary' : 'inv-btn-ghost'}`} onClick={() => setMode('mobile')}>
            <i className="fas fa-mobile-screen" /> Movil
          </button>
          <button className={`inv-btn ${mode === 'desktop' ? 'inv-btn-primary' : 'inv-btn-ghost'}`} onClick={() => setMode('desktop')}>
            <i className="fas fa-desktop" /> Escritorio
          </button>
          <button className="inv-btn inv-btn-ghost" onClick={onClose}>
            <i className="fas fa-xmark" /> Cerrar
          </button>
        </div>
        <div className="inv-preview-container" style={{ maxHeight: '82vh', maxWidth: width, overflowY: 'auto', width: '100%' }}>
          <InvitationRenderer sections={sections} width={width} frame={false} />
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
