// client/src/components/brainstorm/board/ColorPalette.jsx
// Compact color swatch row used by item/group context UI.

import React from 'react';
import { Ban } from 'lucide-react';
import { ITEM_COLORS } from './boardColors';

const ColorPalette = ({ value, onChange, colors = ITEM_COLORS }) => (
  <div className="flex items-center gap-1 flex-wrap">
    {colors.map((c) => (
      <button
        key={c.id ?? 'none'}
        type="button"
        title={c.name}
        onClick={() => onChange(c.value)}
        className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-transform hover:scale-110 ${
          value === c.value || (!value && !c.value)
            ? 'border-gray-900 dark:border-white scale-110'
            : 'border-transparent'
        }`}
        style={c.value ? { background: c.value } : undefined}
      >
        {!c.value && <Ban className="w-3.5 h-3.5 text-gray-400" />}
      </button>
    ))}
  </div>
);

export default ColorPalette;
