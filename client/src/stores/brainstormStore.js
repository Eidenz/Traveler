// client/src/stores/brainstormStore.js
// Board state for the brainstorm canvas: items, groups, selection, viewport.
// The canvas renders from here; realtime socket handlers and API responses
// write into here. Coordinates are world-space; the viewport maps world to
// screen as `screen = world * zoom + offset`.

import { create } from 'zustand';

export const worldToScreen = (viewport, wx, wy) => ({
  x: wx * viewport.zoom + viewport.x,
  y: wy * viewport.zoom + viewport.y,
});

export const screenToWorld = (viewport, sx, sy) => ({
  x: (sx - viewport.x) / viewport.zoom,
  y: (sy - viewport.y) / viewport.zoom,
});

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2.5;

// Approximate card footprint in world units, used for culling and
// zoom-to-fit. Cards self-size; exactness is not required here.
export const ITEM_W = 230;
export const ITEM_H = 170;

const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

const useBrainstormStore = create((set, get) => ({
  items: [],
  groups: [],
  selectedIds: new Set(),
  viewport: { x: 0, y: 0, zoom: 1 },
  highlightId: null, // item briefly pulsed (just created / search result)

  // ---- board data ----
  setBoard: (items, groups) => set({ items, groups, selectedIds: new Set() }),

  upsertItem: (item) => set((s) => {
    const exists = s.items.some((i) => i.id === item.id);
    return {
      items: exists
        ? s.items.map((i) => (i.id === item.id ? { ...i, ...item } : i))
        : [...s.items, item],
    };
  }),

  removeItem: (id) => set((s) => {
    const selectedIds = new Set(s.selectedIds);
    selectedIds.delete(id);
    return { items: s.items.filter((i) => i.id !== id), selectedIds };
  }),

  upsertGroup: (group) => set((s) => {
    const exists = s.groups.some((g) => g.id === group.id);
    return {
      groups: exists
        ? s.groups.map((g) => (g.id === group.id ? { ...g, ...group } : g))
        : [...s.groups, group],
    };
  }),

  removeGroup: (id) => set((s) => ({
    groups: s.groups.filter((g) => g.id !== id),
    // membership is cleared server-side (ON DELETE SET NULL); mirror it
    items: s.items.map((i) => (i.group_id === id ? { ...i, group_id: null } : i)),
  })),

  /** Merge a list of {id, position_x, position_y} into items. */
  moveItemsLocal: (updates) => set((s) => {
    const byId = new Map(updates.map((u) => [u.id, u]));
    return {
      items: s.items.map((i) => {
        const u = byId.get(i.id);
        return u ? { ...i, position_x: u.position_x, position_y: u.position_y } : i;
      }),
    };
  }),

  moveGroupLocal: (id, position_x, position_y) => set((s) => ({
    groups: s.groups.map((g) => (g.id === id ? { ...g, position_x, position_y } : g)),
  })),

  // ---- selection ----
  select: (ids, { additive = false } = {}) => set((s) => {
    const next = additive ? new Set(s.selectedIds) : new Set();
    ids.forEach((id) => next.add(id));
    return { selectedIds: next };
  }),

  toggleSelect: (id) => set((s) => {
    const next = new Set(s.selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { selectedIds: next };
  }),

  clearSelection: () => set((s) => (s.selectedIds.size ? { selectedIds: new Set() } : {})),

  // ---- viewport ----
  setViewport: (viewport) => set({ viewport }),

  panBy: (dx, dy) => set((s) => ({
    viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy },
  })),

  /** Zoom keeping the given screen point fixed (cursor / pinch center). */
  zoomAt: (sx, sy, factor) => set((s) => {
    const zoom = clampZoom(s.viewport.zoom * factor);
    if (zoom === s.viewport.zoom) return {};
    const w = screenToWorld(s.viewport, sx, sy);
    return { viewport: { zoom, x: sx - w.x * zoom, y: sy - w.y * zoom } };
  }),

  /** Center the viewport on a world point at the given (or current) zoom. */
  centerOn: (wx, wy, containerW, containerH, zoom) => set((s) => {
    const z = clampZoom(zoom ?? s.viewport.zoom);
    return {
      viewport: { zoom: z, x: containerW / 2 - wx * z, y: containerH / 2 - wy * z },
    };
  }),

  /** Fit the whole board (items + groups) into the container. */
  zoomToFit: (containerW, containerH) => set((s) => {
    const boxes = [
      ...s.items.map((i) => ({ x: i.position_x, y: i.position_y, w: ITEM_W, h: ITEM_H })),
      ...s.groups.map((g) => ({ x: g.position_x, y: g.position_y, w: g.width, h: g.height })),
    ];
    if (boxes.length === 0) return { viewport: { x: 0, y: 0, zoom: 1 } };
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = 60;
    const zoom = clampZoom(Math.min(
      (containerW - pad * 2) / Math.max(1, maxX - minX),
      (containerH - pad * 2) / Math.max(1, maxY - minY),
      1.25
    ));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return {
      viewport: { zoom, x: containerW / 2 - cx * zoom, y: containerH / 2 - cy * zoom },
    };
  }),

  setHighlight: (id) => {
    set({ highlightId: id });
    if (id != null) {
      setTimeout(() => {
        if (get().highlightId === id) set({ highlightId: null });
      }, 2200);
    }
  },
}));

export default useBrainstormStore;
