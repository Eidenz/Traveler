// client/src/hooks/usePanelWidth.js
// Resizable-panel width with a remembered preference.
//
// The width the user chose (persisted under storageKey) and the width that
// is actually rendered are deliberately separate: the rendered width is
// clamped to the current viewport so the panel's resize edge always stays
// visible, while the preference keeps its full value. Enlarging a panel on a
// wide monitor, moving the window to a smaller one, and coming back
// therefore restores the large size — only an actual drag (which calls
// setPanelWidth + persistPanelWidth) rewrites the preference.

import { useState, useEffect, useCallback, useRef } from 'react';

// Keep at least this much of the window free so the resize handle (and a
// slice of the neighbouring pane) is always reachable
const EDGE_MARGIN = 48;

const usePanelWidth = (storageKey, { min, max = Infinity, defaultWidth }) => {
  const [preferred, setPreferred] = useState(() => {
    const saved = parseInt(localStorage.getItem(storageKey), 10);
    return Number.isFinite(saved) ? saved : defaultWidth;
  });
  const preferredRef = useRef(preferred);
  preferredRef.current = preferred;

  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const panelWidth = Math.max(min, Math.min(preferred, max, viewportWidth - EDGE_MARGIN));

  const persistPanelWidth = useCallback(() => {
    localStorage.setItem(storageKey, String(Math.round(preferredRef.current)));
  }, [storageKey]);

  return { panelWidth, setPanelWidth: setPreferred, persistPanelWidth };
};

export default usePanelWidth;
