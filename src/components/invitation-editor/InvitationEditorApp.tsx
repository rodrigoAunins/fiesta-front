import { useState, useRef, useCallback } from 'react';
import { useEditorState } from './useEditorState';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import EditorToolbar from './EditorToolbar';
import ElementsSidebar from './ElementsSidebar';
import CanvasEditor from './CanvasEditor';
import PropertiesPanel from './PropertiesPanel';
import PreviewModal from './PreviewModal';
import { createImageElement } from './constants';
import type { EditorElement, InvitationSection, SectionBackground, InvitationDesign } from './types';
import './editor.css';

interface Props {
  initialDesign?: InvitationDesign;
  initialPublished?: boolean;
  initialPublicSlug?: string | null;
  eventPlanData?: unknown[];
  onSave?: (design: InvitationDesign) => Promise<void>;
  onPublish?: (published: boolean) => Promise<{ published: boolean; publicSlug: string }>;
  onBack?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
}

export default function InvitationEditorApp({ initialDesign, initialPublished = false, initialPublicSlug = null, eventPlanData = [], onSave, onPublish, onBack, onUploadImage }: Props) {
  const editor = useEditorState(initialDesign);
  const [showPreview, setShowPreview] = useState(false);
  const [imageUploadTarget, setImageUploadTarget] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(initialPublished);
  const [publicSlug, setPublicSlug] = useState<string | null>(initialPublicSlug);
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Save ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (editor.isSaving || !onSave) return;
    editor.setIsSaving(true);
    try {
      await onSave(editor.getDesign());
      editor.setIsDirty(false);
      editor.setLastSaved(new Date().toISOString());
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      editor.setIsSaving(false);
    }
  }, [editor, onSave]);

  const handlePublish = useCallback(async (publish: boolean) => {
    if (isPublishing || !onPublish) return;
    setIsPublishing(true);
    try {
      const res = await onPublish(publish);
      setIsPublished(res.published);
      setPublicSlug(res.publicSlug);
    } catch (err) {
      console.error('Publish failed:', err);
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, onPublish]);

  const handleCopyLink = useCallback(() => {
    if (!publicSlug) return;
    const baseUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const url = `${baseUrl}/i/${publicSlug}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado al portapapeles');
  }, [publicSlug]);

  // ─── Image upload ────────────────────────────────────────────────

  const handleRequestImageUpload = useCallback((elementId?: string) => {
    setImageUploadTarget(elementId || '__new__');
    setTimeout(() => fileInputRef.current?.click(), 0);
  }, []);

  const handleImageFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    let src: string;
    if (onUploadImage) {
      try { src = await onUploadImage(file); } catch { return; }
    } else {
      src = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    if (imageUploadTarget === '__new__') {
      const targetSectionId = editor.selectedSectionId || editor.sections[0]?.id;
      if (targetSectionId) {
        editor.addElement(targetSectionId, createImageElement(src));
      }
    } else if (imageUploadTarget) {
      editor.updateElementContent(imageUploadTarget, { src });
    }
    setImageUploadTarget(null);
  }, [imageUploadTarget, editor, onUploadImage]);

  // ─── Template apply ──────────────────────────────────────────────

  const handleApplyTemplate = useCallback((sections: InvitationSection[]) => {
    editor.setSections(sections.map(s => ({ ...s, elements: s.elements.map(e => ({ ...e })) })));
    editor.deselectAll();
  }, [editor]);

  const handleChangeBackground = useCallback((sectionId: string, bg: SectionBackground) => {
    editor.setSections(prev => prev.map(s => s.id === sectionId ? { ...s, background: bg } : s));
  }, [editor]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────

  useKeyboardShortcuts({
    selectedIds: editor.selectedIds,
    elements: editor.sections.flatMap(s => s.elements),
    deleteSelected: () => editor.removeElements(editor.selectedIds),
    duplicateSelected: () => editor.duplicateElements(editor.selectedIds),
    undo: editor.undo,
    redo: editor.redo,
    nudge: editor.nudge,
    selectAll: editor.selectAll,
    deselectAll: editor.deselectAll,
    copySelected: editor.copySelected,
    pasteClipboard: editor.pasteClipboard,
  });

  // ─── Selected element for props panel ────────────────────────────

  const selectedEl = editor.selectedElements.length === 1 ? editor.selectedElements[0] : null;

  const handleToggleVisible = useCallback((id: string) => {
    editor.setSections(prev => prev.map(s => ({ ...s, elements: s.elements.map(e => e.id === id ? { ...e, visible: !e.visible } : e) })));
  }, [editor]);

  const handleToggleLock = useCallback((id: string) => {
    editor.setSections(prev => prev.map(s => ({ ...s, elements: s.elements.map(e => e.id === id ? { ...e, locked: !e.locked } : e) })));
  }, [editor]);

  return (
    <div className="inv-editor">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />

      <EditorToolbar
        name={editor.designName}
        onNameChange={editor.setDesignName}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        zoom={editor.zoom}
        onZoomChange={editor.setZoom}
        isDirty={editor.isDirty}
        isSaving={editor.isSaving}
        lastSaved={editor.lastSaved}
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        onBack={() => onBack?.()}
        layersPanelOpen={editor.layersPanelOpen}
        onToggleLayers={() => editor.setLayersPanelOpen(p => !p)}
        isPublished={isPublished}
        publicSlug={publicSlug}
        onPublish={() => handlePublish(!isPublished)}
        onCopyLink={handleCopyLink}
      />

      <ElementsSidebar
        activeTab={editor.sidebarTab}
        sections={editor.sections}
        selectedSectionId={editor.selectedSectionId}
        onTabChange={editor.setSidebarTab}
        onAddElement={editor.addElement}
        onAddSection={editor.addSection}
        onUpdateSection={editor.updateSection}
        onRemoveSection={editor.removeSection}
        onDuplicateSection={editor.duplicateSection}
        onMoveSection={editor.moveSection}
        onSelectSection={editor.setSelectedSectionId}
        onApplyTemplate={handleApplyTemplate}
        onChangeBackground={handleChangeBackground}
        onRequestImageUpload={() => handleRequestImageUpload()}
        eventPlanData={eventPlanData}
      />

      <CanvasEditor
        sections={editor.sections}
        selectedIds={editor.selectedIds}
        selectedSectionId={editor.selectedSectionId}
        zoom={editor.zoom}
        layersPanelOpen={editor.layersPanelOpen}
        onSelectElement={(id, sectionId, additive) => editor.selectElement(id, sectionId, additive)}
        onSelectSection={editor.setSelectedSectionId}
        onDeselectAll={editor.deselectAll}
        onUpdateElement={editor.updateElement}
        onUpdateElementContent={editor.updateElementContent}
        onToggleVisible={handleToggleVisible}
        onToggleLock={handleToggleLock}
      />

      <PropertiesPanel
        element={selectedEl}
        sections={editor.sections}
        onUpdate={editor.updateElement}
        onUpdateContent={editor.updateElementContent}
        onUpdateStyles={editor.updateElementStyles}
        onDelete={editor.removeElements}
        onDuplicate={editor.duplicateElements}
        onBringForward={editor.bringForward}
        onSendBackward={editor.sendBackward}
        onRequestImageUpload={(elId) => handleRequestImageUpload(elId)}
      />

      {showPreview && (
        <PreviewModal
          sections={editor.sections}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
