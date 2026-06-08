import { useMemo, type FC } from 'react';
import type { EditorElement, InvitationSection, SectionBackground } from './types';
import EditableElement from './EditableElement';
import LayersPanel from './LayersPanel';

interface Props {
  sections: InvitationSection[];
  selectedIds: string[];
  selectedSectionId: string | null;
  zoom: number;
  layersPanelOpen: boolean;
  onSelectElement: (id: string, sectionId: string, additive: boolean) => void;
  onSelectSection: (id: string) => void;
  onDeselectAll: () => void;
  onUpdateElement: (id: string, patch: Partial<EditorElement>) => void;
  onUpdateElementContent: (id: string, patch: Record<string, unknown>) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
}

const SectionRenderer: FC<{
  section: InvitationSection;
  selectedIds: string[];
  selectedSectionId: string | null;
  zoom: number;
  onSelectElement: (id: string, sectionId: string, additive: boolean) => void;
  onSelectSection: (id: string) => void;
  onUpdateElement: (id: string, patch: Partial<EditorElement>) => void;
  onUpdateElementContent: (id: string, patch: Record<string, unknown>) => void;
}> = ({ section, selectedIds, selectedSectionId, zoom, onSelectElement, onSelectSection, onUpdateElement, onUpdateElementContent }) => {
  const sorted = useMemo(() => [...section.elements].sort((a, b) => a.zIndex - b.zIndex), [section.elements]);

  const bgStyle = useMemo((): React.CSSProperties => {
    const bg = section.background;
    const opacity = bg.opacity !== undefined ? bg.opacity : 1;
    if (bg.type === 'gradient') {
      return { background: `linear-gradient(${bg.angle || 135}deg, ${bg.value}, ${bg.secondaryValue || bg.value})`, opacity };
    }
    if (bg.type === 'image') {
      return { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity };
    }
    return { backgroundColor: bg.value, opacity };
  }, [section.background]);

  const isSelected = selectedSectionId === section.id;

  return (
    <div
      className={`inv-section-wrapper ${isSelected ? 'ring-2 ring-pink-500' : ''}`}
      style={{
        width: 1080 * zoom,
        height: section.height * zoom,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelectSection(section.id);
        }
      }}
    >
      <div style={{ position: 'absolute', inset: 0, ...bgStyle, pointerEvents: 'none' }} />
      {sorted.filter(el => el.visible).map(el => (
        <EditableElement
          key={el.id}
          element={el}
          sectionId={section.id}
          isSelected={selectedIds.includes(el.id)}
          zoom={zoom}
          onSelect={onSelectElement}
          onUpdate={onUpdateElement}
          onUpdateContent={onUpdateElementContent}
          onDoubleClick={() => {}}
        />
      ))}
    </div>
  );
};

const CanvasEditor: FC<Props> = ({
  sections, selectedIds, selectedSectionId, zoom,
  layersPanelOpen,
  onSelectElement, onSelectSection, onDeselectAll, onUpdateElement, onUpdateElementContent,
  onToggleVisible, onToggleLock,
}) => {
  return (
    <div className="inv-editor-canvas-area" onClick={(e) => {
      if (e.target === e.currentTarget) onDeselectAll();
    }}>
      <div className="flex flex-col items-center gap-4 py-8" style={{ width: '100%' }}>
        {sections.map(section => (
          <SectionRenderer
            key={section.id}
            section={section}
            selectedIds={selectedIds}
            selectedSectionId={selectedSectionId}
            zoom={zoom}
            onSelectElement={onSelectElement}
            onSelectSection={onSelectSection}
            onUpdateElement={onUpdateElement}
            onUpdateElementContent={onUpdateElementContent}
          />
        ))}
      </div>

      {layersPanelOpen && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '35%' }}>
          <LayersPanel
            elements={sections.flatMap(s => s.elements)}
            selectedIds={selectedIds}
            onSelect={(id) => {
              const sec = sections.find(s => s.elements.find(e => e.id === id));
              if (sec) onSelectElement(id, sec.id, false);
            }}
            onToggleVisible={onToggleVisible}
            onToggleLock={onToggleLock}
          />
        </div>
      )}
    </div>
  );
};

export default CanvasEditor;
