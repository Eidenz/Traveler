// client/src/components/brainstorm/board/BoardGroupBox.jsx
// A group rectangle in world space. The header is the drag handle (moving a
// group moves its member items — BoardCanvas handles the gesture); the
// bottom-right corner is the resize handle. Presentational otherwise.

import React from 'react';
import { GripHorizontal, Palette, Trash2 } from 'lucide-react';
import { groupFill } from './boardColors';

const BoardGroupBox = ({ group, memberCount, canEdit, isDark, onOpenColor, onDelete, onRename }) => (
  <div
    className="absolute rounded-2xl border-2 border-dashed transition-colors"
    style={{
      left: group.position_x,
      top: group.position_y,
      width: group.width,
      height: group.height,
      background: groupFill(group.color === '#e5e7eb' ? null : group.color, isDark),
      borderColor: group.color && group.color !== '#e5e7eb' ? `${group.color}66` : 'rgba(148,163,184,0.35)',
    }}
  >
    {/* Header — the drag handle */}
    <div
      data-group-handle={group.id}
      className={`board-group-header flex items-center gap-2 px-3 py-1.5 rounded-t-2xl ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <GripHorizontal className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span
        data-group-title={group.id}
        className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate flex-1"
        onDoubleClick={canEdit ? () => onRename?.(group) : undefined}
      >
        {group.title || 'Group'}
      </span>
      <span className="text-[10px] text-gray-400 flex-shrink-0">{memberCount}</span>
      {canEdit && (
        <span className="hidden sm:flex items-center gap-0.5 opacity-0 board-group-actions transition-opacity flex-shrink-0">
          <button
            type="button"
            data-no-drag
            onClick={() => onOpenColor?.(group)}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            title="Color"
          >
            <Palette className="w-3 h-3 text-gray-500" />
          </button>
          <button
            type="button"
            data-no-drag
            onClick={() => onDelete?.(group)}
            className="p-1 rounded hover:bg-red-500/20"
            title="Delete group (items are kept)"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </span>
      )}
    </div>

    {/* Resize handle */}
    {canEdit && (
      <div
        data-group-resize={group.id}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize rounded-tl-lg opacity-40 hover:opacity-100"
        style={{
          background:
            'linear-gradient(135deg, transparent 50%, rgba(148,163,184,0.9) 50%)',
        }}
      />
    )}
  </div>
);

export default React.memo(BoardGroupBox);
