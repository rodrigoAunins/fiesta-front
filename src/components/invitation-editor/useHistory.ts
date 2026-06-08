import { useState, useCallback, useRef } from 'react';
import type { InvitationSection } from './types';
import type { HistoryEntry } from './types';

const MAX_HISTORY = 50;

export function useHistory(initialSections: InvitationSection[]) {
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const skipRef = useRef(false);

  const pushState = useCallback((sections: InvitationSection[]) => {
    if (skipRef.current) { skipRef.current = false; return; }
    setPast(prev => {
      const next = [...prev, { sections, timestamp: Date.now() }];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback(
    (currentSections: InvitationSection[]): HistoryEntry | null => {
      if (past.length === 0) return null;
      const prev = [...past];
      const entry = prev.pop()!;
      setPast(prev);
      setFuture(f => [...f, { sections: currentSections, timestamp: Date.now() }]);
      skipRef.current = true;
      return entry;
    },
    [past],
  );

  const redo = useCallback(
    (currentSections: InvitationSection[]): HistoryEntry | null => {
      if (future.length === 0) return null;
      const next = [...future];
      const entry = next.pop()!;
      setFuture(next);
      setPast(p => [...p, { sections: currentSections, timestamp: Date.now() }]);
      skipRef.current = true;
      return entry;
    },
    [future],
  );

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return { pushState, undo, redo, canUndo, canRedo };
}
