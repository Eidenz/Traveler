// Shared palette for brainstorm items and groups. `null` means "no color"
// (default card / neutral group). Kept small on purpose — a curated set
// reads better on a crowded board than a full color wheel.

export const ITEM_COLORS = [
  { id: null, name: 'None', value: null },
  { id: 'red', name: 'Red', value: '#ef4444' },
  { id: 'orange', name: 'Orange', value: '#f97316' },
  { id: 'amber', name: 'Amber', value: '#f59e0b' },
  { id: 'emerald', name: 'Green', value: '#10b981' },
  { id: 'sky', name: 'Sky', value: '#0ea5e9' },
  { id: 'violet', name: 'Violet', value: '#8b5cf6' },
  { id: 'pink', name: 'Pink', value: '#ec4899' },
  { id: 'slate', name: 'Slate', value: '#64748b' },
];

// Groups use the same hues but are rendered as translucent fills
export const GROUP_COLORS = ITEM_COLORS;

/** Translucent fill for a group rectangle. */
export const groupFill = (hex, dark = false) =>
  hex ? `${hex}${dark ? '2e' : '24'}` : (dark ? '#ffffff10' : '#00000008');
