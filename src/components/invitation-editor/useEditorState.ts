import { useState, useCallback, useRef, useMemo } from 'react';
import type { EditorElement, InvitationSection, InvitationDesign, SidebarTab } from './types';
import { DEFAULT_SECTION, nextId } from './constants';
import { useHistory } from './useHistory';

export function useEditorState(initial?: InvitationDesign) {
  const [designId] = useState(initial?.id || nextId('inv'));
  const [designName, setDesignName] = useState(initial?.name || 'Nueva invitacion');
  
  // Migrate old flat template to multi-section if needed
  const initialSections = initial?.sections?.length
    ? initial.sections
    : (initial as any)?.canvas
      ? [
          {
            ...DEFAULT_SECTION,
            background: (initial as any).canvas.background,
            elements: (initial as any).elements || [],
            height: (initial as any).canvas.height,
          },
        ]
      : [{ ...DEFAULT_SECTION, elements: [...DEFAULT_SECTION.elements] }];

  const [sections, setSectionsRaw] = useState<InvitationSection[]>(initialSections);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(initialSections[0]?.id || null);
  const [zoom, setZoom] = useState(0.45);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(initial?.metadata?.updatedAt || null);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sections');
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const clipboardRef = useRef<EditorElement[]>([]);
  const history = useHistory(sections);

  // ─── Sections CRUD ─────────────────────────────────────────────

  const setSections = useCallback((updater: InvitationSection[] | ((prev: InvitationSection[]) => InvitationSection[])) => {
    setSectionsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      history.pushState(prev);
      setIsDirty(true);
      return next;
    });
  }, [history]);

  const addSection = useCallback((section: InvitationSection) => {
    setSections(prev => [...prev, section]);
    setSelectedSectionId(section.id);
    setSelectedIds([]);
  }, [setSections]);

  const updateSection = useCallback((id: string, patch: Partial<InvitationSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, [setSections]);

  const removeSection = useCallback((id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId(null);
  }, [selectedSectionId, setSections]);

  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    setSections(prev => {
      if (direction === 'up' && index > 0) {
        const next = [...prev];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        return next;
      }
      if (direction === 'down' && index < prev.length - 1) {
        const next = [...prev];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        return next;
      }
      return prev;
    });
  }, [setSections]);

  const duplicateSection = useCallback((id: string) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], id: nextId('sec'), elements: prev[idx].elements.map(e => ({ ...e, id: nextId(e.type) })) };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  }, [setSections]);

  // ─── Elements CRUD ───────────────────────────────────────────────

  const addElement = useCallback((sectionId: string, el: EditorElement) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const maxZ = s.elements.length > 0 ? Math.max(...s.elements.map(e => e.zIndex)) : 0;
      return { ...s, elements: [...s.elements, { ...el, zIndex: maxZ + 1 }] };
    }));
    setSelectedIds([el.id]);
    setSelectedSectionId(sectionId);
  }, [setSections]);

  const updateElement = useCallback((id: string, patch: Partial<EditorElement>) => {
    setSections(prev => prev.map(s => ({
      ...s,
      elements: s.elements.map(el => el.id === id ? { ...el, ...patch } : el)
    })));
  }, [setSections]);

  const updateElementContent = useCallback((id: string, contentPatch: Record<string, unknown>) => {
    setSections(prev => prev.map(s => ({
      ...s,
      elements: s.elements.map(el => el.id === id ? { ...el, content: { ...el.content, ...contentPatch } as any } : el)
    })));
  }, [setSections]);

  const updateElementStyles = useCallback((id: string, stylesPatch: Partial<EditorElement['styles']>) => {
    setSections(prev => prev.map(s => ({
      ...s,
      elements: s.elements.map(el => el.id === id ? { ...el, styles: { ...el.styles, ...stylesPatch } } : el)
    })));
  }, [setSections]);

  const removeElements = useCallback((ids: string[]) => {
    setSections(prev => prev.map(s => ({
      ...s,
      elements: s.elements.filter(el => !ids.includes(el.id))
    })));
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  }, [setSections]);

  const duplicateElements = useCallback((ids: string[]) => {
    setSections(prev => prev.map(s => {
      const targetEls = s.elements.filter(el => ids.includes(el.id));
      if (targetEls.length === 0) return s;
      
      const maxZ = s.elements.length > 0 ? Math.max(...s.elements.map(e => e.zIndex)) : 0;
      const clones = targetEls.map((el, i) => ({
        ...el,
        id: nextId(el.type),
        name: `${el.name} copia`,
        x: el.x + 20,
        y: el.y + 20,
        zIndex: maxZ + i + 1,
      }));
      
      setTimeout(() => setSelectedIds(clones.map(c => c.id)), 0);
      return { ...s, elements: [...s.elements, ...clones] };
    }));
  }, [setSections]);

  // ─── Selection ───────────────────────────────────────────────────

  const selectElement = useCallback((id: string, sectionId: string, additive = false) => {
    setSelectedSectionId(sectionId);
    setSelectedIds(prev => additive ? (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : [id]);
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const selectAll = useCallback(() => {
    if (!selectedSectionId) return;
    const sec = sections.find(s => s.id === selectedSectionId);
    if (sec) setSelectedIds(sec.elements.filter(e => !e.locked).map(e => e.id));
  }, [sections, selectedSectionId]);

  const allElements = useMemo(() => sections.flatMap(s => s.elements), [sections]);
  const selectedElements = useMemo(() => allElements.filter(el => selectedIds.includes(el.id)), [allElements, selectedIds]);

  // ─── Layer ordering ──────────────────────────────────────────────

  // ─── Layer ordering ──────────────────────────────────────────────

  const bringForward = useCallback((id: string) => {
    setSections(prev => prev.map(s => {
      if (!s.elements.find(e => e.id === id)) return s;
      const maxZ = Math.max(...s.elements.map(e => e.zIndex));
      return { ...s, elements: s.elements.map(e => e.id === id ? { ...e, zIndex: maxZ + 1 } : e) };
    }));
  }, [setSections]);

  const sendBackward = useCallback((id: string) => {
    setSections(prev => prev.map(s => {
      if (!s.elements.find(e => e.id === id)) return s;
      const minZ = Math.min(...s.elements.map(e => e.zIndex));
      return { ...s, elements: s.elements.map(e => e.id === id ? { ...e, zIndex: Math.max(1, minZ - 1) } : e) };
    }));
  }, [setSections]);

  // ─── Nudge ───────────────────────────────────────────────────────

  const nudge = useCallback((dx: number, dy: number) => {
    if (selectedIds.length === 0) return;
    setSections(prev => prev.map(s => ({
      ...s,
      elements: s.elements.map(el => 
        selectedIds.includes(el.id) && !el.locked
          ? { ...el, x: el.x + dx, y: el.y + dy }
          : el
      )
    })));
  }, [selectedIds, setSections]);

  // ─── Clipboard ───────────────────────────────────────────────────

  // ─── Clipboard ───────────────────────────────────────────────────

  const copySelected = useCallback(() => {
    clipboardRef.current = allElements.filter(el => selectedIds.includes(el.id));
  }, [allElements, selectedIds]);

  const pasteClipboard = useCallback(() => {
    if (clipboardRef.current.length === 0 || !selectedSectionId) return;
    setSections(prev => prev.map(s => {
      if (s.id !== selectedSectionId) return s;
      const maxZ = s.elements.length > 0 ? Math.max(...s.elements.map(e => e.zIndex)) : 0;
      const pasted = clipboardRef.current.map((el, i) => ({
        ...el,
        id: nextId(el.type),
        name: `${el.name} copia`,
        x: el.x + 30,
        y: el.y + 30,
        zIndex: maxZ + i + 1,
      }));
      setTimeout(() => setSelectedIds(pasted.map(p => p.id)), 0);
      return { ...s, elements: [...s.elements, ...pasted] };
    }));
  }, [selectedSectionId, setSections]);

  // ─── Undo / Redo ─────────────────────────────────────────────────

  // ─── Undo / Redo ─────────────────────────────────────────────────

  const undo = useCallback(() => {
    const entry = history.undo(sections);
    if (entry) {
      setSectionsRaw(entry.sections);
      setIsDirty(true);
    }
  }, [sections, history]);

  const redo = useCallback(() => {
    const entry = history.redo(sections);
    if (entry) {
      setSectionsRaw(entry.sections);
      setIsDirty(true);
    }
  }, [sections, history]);

  // ─── Serialize ───────────────────────────────────────────────────

  // ─── Serialize ───────────────────────────────────────────────────

  const getDesign = useCallback((): InvitationDesign => ({
    id: designId,
    name: designName,
    sections,
    metadata: {
      createdAt: initial?.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (initial?.metadata?.version || 0) + 1,
    },
  }), [designId, designName, sections, initial]);

  return {
    // State
    designId, designName, setDesignName,
    sections, setSections, setSectionsRaw,
    selectedIds, selectedElements,
    selectedSectionId, setSelectedSectionId,
    zoom, setZoom,
    isDirty, setIsDirty,
    isSaving, setIsSaving,
    lastSaved, setLastSaved,
    sidebarTab, setSidebarTab,
    layersPanelOpen, setLayersPanelOpen,

    // Actions
    addSection, updateSection, removeSection, moveSection, duplicateSection,
    addElement, updateElement, updateElementContent, updateElementStyles,
    removeElements, duplicateElements,
    selectElement, deselectAll, selectAll,
    bringForward, sendBackward,
    nudge, copySelected, pasteClipboard,
    undo, redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    getDesign,
  };
}
