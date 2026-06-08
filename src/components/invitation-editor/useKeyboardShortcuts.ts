import { useEffect, useCallback } from 'react';
import type { EditorElement } from './types';

interface ShortcutActions {
  selectedIds: string[];
  elements: EditorElement[];
  deleteSelected: () => void;
  duplicateSelected: () => void;
  undo: () => void;
  redo: () => void;
  nudge: (dx: number, dy: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
}

export function useKeyboardShortcuts(actions: ShortcutActions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditing = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;

      // Delete always works when not editing text
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing) {
        e.preventDefault();
        actions.deleteSelected();
        return;
      }

      if (isEditing) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); actions.undo(); return; }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); actions.redo(); return; }
      if (ctrl && e.key === 'd') { e.preventDefault(); actions.duplicateSelected(); return; }
      if (ctrl && e.key === 'a') { e.preventDefault(); actions.selectAll(); return; }
      if (ctrl && e.key === 'c') { e.preventDefault(); actions.copySelected(); return; }
      if (ctrl && e.key === 'v') { e.preventDefault(); actions.pasteClipboard(); return; }
      if (e.key === 'Escape') { actions.deselectAll(); return; }

      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') { e.preventDefault(); actions.nudge(0, -step); }
      if (e.key === 'ArrowDown') { e.preventDefault(); actions.nudge(0, step); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); actions.nudge(-step, 0); }
      if (e.key === 'ArrowRight') { e.preventDefault(); actions.nudge(step, 0); }
    },
    [actions],
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
