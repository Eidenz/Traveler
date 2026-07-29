// client/src/components/brainstorm/board/BoardCanvas.jsx
// The canvas engine. One world-space layer under a single CSS transform;
// every input arrives as pointer events, so mouse, touch and pen share one
// code path:
//
//   drag on empty      pan            (mouse: left-drag, touch: one finger)
//   shift+drag empty   marquee select (desktop)
//   wheel              pan · ctrl/pinch-wheel zooms at cursor
//   two fingers        pinch zoom + pan
//   drag on item       mouse: moves only if the card is selected (click to
//                      select first) — dragging an unselected card pans, so
//                      sweeping across a crowded board never displaces cards
//                      (touch: hold ~300ms to lift, otherwise the finger pans)
//   drag group header  move group + all member items (touch: hold to lift)
//   click / tap        select (shift toggles) · double: edit item / quick-add
//   corner handle      resize group
//
// The canvas is deliberately dumb about persistence: it updates the store
// optimistically during gestures and reports final results through
// callbacks; the page decides what to send to the API/socket.

import React, { useRef, useState, useEffect, useCallback } from 'react';
import useBrainstormStore, { screenToWorld, ITEM_W, ITEM_H } from '../../../stores/brainstormStore';
import BoardItemCard from './BoardItemCard';
import BoardGroupBox from './BoardGroupBox';

const DRAG_THRESHOLD = 4; // px before a press becomes a drag
const DOUBLE_MS = 350;
const CULL_MARGIN = 400; // world px rendered beyond the viewport edges
const MIN_GROUP_W = 180;
const MIN_GROUP_H = 140;

const BoardCanvas = ({
  canEdit = false,
  dimmedIds = null, // Set of item ids to dim (search filtering), or null
  onPersistMoves, // (itemUpdates, groupPatch|null) => void
  onMembershipChanges, // ([{itemId, groupId}]) => void
  onEditItem, // (item) => void
  onQuickAdd, // ({x, y} world) => void
  onGroupResize, // (group, width, height) => void
  onOpenGroupColor,
  onDeleteGroup,
  onRenameGroup,
}) => {
  const items = useBrainstormStore((s) => s.items);
  const groups = useBrainstormStore((s) => s.groups);
  const selectedIds = useBrainstormStore((s) => s.selectedIds);
  const viewport = useBrainstormStore((s) => s.viewport);
  const highlightId = useBrainstormStore((s) => s.highlightId);

  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [marquee, setMarquee] = useState(null); // screen-space {x1,y1,x2,y2}
  const [liftedItemId, setLiftedItemId] = useState(null); // touch drag-armed cue
  const gesture = useRef(null);
  const pointers = useRef(new Map());
  const lastTap = useRef({ time: 0, key: null });
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const localPoint = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const store = useBrainstormStore.getState;

  // ---- gesture start -----------------------------------------------------
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('[data-no-drag]')) return; // header buttons etc.

    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    containerRef.current.setPointerCapture(e.pointerId);

    // Second finger: whatever was happening becomes a pinch
    if (pointers.current.size === 2) {
      if (gesture.current?.timer) clearTimeout(gesture.current.timer);
      setLiftedItemId(null);
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        type: 'pinch',
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      setMarquee(null);
      return;
    }

    const itemEl = e.target.closest('[data-item-id]');
    const resizeEl = e.target.closest('[data-group-resize]');
    const handleEl = e.target.closest('[data-group-handle]');

    let plan;
    if (resizeEl && canEdit) {
      const group = store().groups.find((g) => g.id === Number(resizeEl.dataset.groupResize));
      plan = { type: 'resize-group', group, startW: group.width, startH: group.height };
    } else if (handleEl && canEdit) {
      const group = store().groups.find((g) => g.id === Number(handleEl.dataset.groupHandle));
      const memberIds = store().items.filter((i) => i.group_id === group.id).map((i) => i.id);
      plan = {
        type: 'drag-group',
        group,
        groupStart: { x: group.position_x, y: group.position_y },
        memberIds,
        startPositions: new Map(
          store().items
            .filter((i) => memberIds.includes(i.id))
            .map((i) => [i.id, { x: i.position_x, y: i.position_y }])
        ),
      };
    } else if (itemEl) {
      const id = Number(itemEl.dataset.itemId);
      const sel = store().selectedIds;
      // Mouse: only selected cards drag (select-then-move) — a drag starting
      // on an unselected card pans the canvas instead. Touch keeps its
      // hold-to-lift, which may lift an unselected card directly.
      const isTouch = e.pointerType === 'touch';
      const dragIds = canEdit
        ? (sel.has(id) ? [...sel] : (isTouch ? [id] : []))
        : [];
      plan = {
        type: 'drag-items',
        itemId: id,
        dragIds,
        shift: e.shiftKey,
        startPositions: new Map(
          store().items
            .filter((i) => dragIds.includes(i.id))
            .map((i) => [i.id, { x: i.position_x, y: i.position_y }])
        ),
      };
    } else if (e.shiftKey && e.pointerType === 'mouse') {
      plan = { type: 'marquee' };
    } else {
      plan = { type: 'pan' };
    }

    // Touch: item/group drags require a short hold, so a finger that starts
    // moving right away pans the canvas instead of yanking a card around
    const isDragPlan =
      (plan.type === 'drag-items' && plan.dragIds.length > 0) || plan.type === 'drag-group';
    if (e.pointerType === 'touch' && isDragPlan) {
      const press = { type: 'touch-press', upgrade: plan, startScreen: p, last: p, moved: false };
      press.timer = setTimeout(() => {
        const g = gesture.current;
        if (g === press && !g.moved) {
          gesture.current = { ...plan, startScreen: g.last, last: g.last, moved: false };
          if (plan.type === 'drag-items') setLiftedItemId(plan.itemId);
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }, 300);
      gesture.current = press;
      return;
    }

    gesture.current = { ...plan, startScreen: p, last: p, moved: false };
  };

  // ---- gesture move ------------------------------------------------------
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const p = localPoint(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);

    if (g.type === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (g.startDist > 0 && dist > 0) {
        store().zoomAt(mid.x, mid.y, dist / g.startDist);
        g.startDist = dist;
      }
      store().panBy(mid.x - g.lastMid.x, mid.y - g.lastMid.y);
      g.lastMid = mid;
      return;
    }

    const dx = p.x - g.last.x;
    const dy = p.y - g.last.y;
    const total = Math.hypot(p.x - g.startScreen.x, p.y - g.startScreen.y);
    if (!g.moved && total < DRAG_THRESHOLD) return;

    // Finger moved before the hold fired: it's a pan, not a drag
    if (g.type === 'touch-press') {
      clearTimeout(g.timer);
      gesture.current = { type: 'pan', startScreen: g.startScreen, last: g.last, moved: true };
      store().panBy(dx, dy);
      gesture.current.last = p;
      return;
    }

    g.moved = true;
    g.last = p;

    const zoom = store().viewport.zoom;

    if (g.type === 'pan') {
      store().panBy(dx, dy);
    } else if (g.type === 'marquee') {
      setMarquee({ x1: g.startScreen.x, y1: g.startScreen.y, x2: p.x, y2: p.y });
    } else if (g.type === 'drag-items' && g.dragIds.length === 0) {
      // Read-only viewers: dragging over an item still pans the canvas
      store().panBy(dx, dy);
    } else if (g.type === 'drag-items' && g.dragIds.length > 0) {
      const wdx = (p.x - g.startScreen.x) / zoom;
      const wdy = (p.y - g.startScreen.y) / zoom;
      store().moveItemsLocal(
        g.dragIds.map((id) => {
          const s = g.startPositions.get(id);
          return { id, position_x: s.x + wdx, position_y: s.y + wdy };
        })
      );
    } else if (g.type === 'drag-group') {
      const wdx = (p.x - g.startScreen.x) / zoom;
      const wdy = (p.y - g.startScreen.y) / zoom;
      store().moveGroupLocal(g.group.id, g.groupStart.x + wdx, g.groupStart.y + wdy);
      store().moveItemsLocal(
        g.memberIds.map((id) => {
          const s = g.startPositions.get(id);
          return { id, position_x: s.x + wdx, position_y: s.y + wdy };
        })
      );
    } else if (g.type === 'resize-group') {
      const wdx = (p.x - g.startScreen.x) / zoom;
      const wdy = (p.y - g.startScreen.y) / zoom;
      store().upsertGroup({
        id: g.group.id,
        width: Math.max(MIN_GROUP_W, g.startW + wdx),
        height: Math.max(MIN_GROUP_H, g.startH + wdy),
      });
    }
  };

  // ---- gesture end -------------------------------------------------------
  const groupAtPoint = (wx, wy) => {
    // Topmost (last) group whose rect contains the point
    const gs = store().groups;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      if (wx >= g.position_x && wx <= g.position_x + g.width &&
          wy >= g.position_y && wy <= g.position_y + g.height) return g;
    }
    return null;
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (!g) return;
    if (g.type === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    setLiftedItemId(null);
    const p = localPoint(e);
    const st = store();

    // A hold that never fired and never moved is a tap on its target
    if (g.type === 'touch-press') {
      clearTimeout(g.timer);
      const up = g.upgrade;
      if (up.type === 'drag-items') {
        const now = Date.now();
        const key = `item-${up.itemId}`;
        const item = st.items.find((i) => i.id === up.itemId);
        if (now - lastTap.current.time < DOUBLE_MS && lastTap.current.key === key) {
          lastTap.current = { time: 0, key: null };
          if (item) onEditItem?.(item);
        } else {
          lastTap.current = { time: now, key };
          st.select([up.itemId]);
        }
      }
      return;
    }

    if (!g.moved) {
      // Click / tap
      const now = Date.now();
      if (g.type === 'drag-items') {
        const item = st.items.find((i) => i.id === g.itemId);
        const key = `item-${g.itemId}`;
        if (now - lastTap.current.time < DOUBLE_MS && lastTap.current.key === key) {
          lastTap.current = { time: 0, key: null };
          if (item) onEditItem?.(item);
        } else {
          lastTap.current = { time: now, key };
          if (g.shift) st.toggleSelect(g.itemId);
          else st.select([g.itemId]);
        }
      } else if (g.type === 'pan') {
        const key = 'bg';
        if (now - lastTap.current.time < DOUBLE_MS && lastTap.current.key === key) {
          lastTap.current = { time: 0, key: null };
          if (canEdit) onQuickAdd?.(screenToWorld(st.viewport, p.x, p.y));
        } else {
          lastTap.current = { time: now, key };
          st.clearSelection();
        }
      }
      setMarquee(null);
      return;
    }

    // Drag finished
    if (g.type === 'marquee' && marquee) {
      const w1 = screenToWorld(st.viewport, Math.min(marquee.x1, marquee.x2), Math.min(marquee.y1, marquee.y2));
      const w2 = screenToWorld(st.viewport, Math.max(marquee.x1, marquee.x2), Math.max(marquee.y1, marquee.y2));
      const hit = st.items
        .filter((i) => {
          const cx = i.position_x + ITEM_W / 2;
          const cy = i.position_y + ITEM_H / 2;
          return cx >= w1.x && cx <= w2.x && cy >= w1.y && cy <= w2.y;
        })
        .map((i) => i.id);
      st.select(hit, { additive: e.shiftKey });
      setMarquee(null);
    } else if (g.type === 'drag-items' && g.dragIds.length > 0) {
      const updates = g.dragIds.map((id) => {
        const i = st.items.find((it) => it.id === id);
        return { id, position_x: Math.round(i.position_x), position_y: Math.round(i.position_y) };
      });
      onPersistMoves?.(updates, null);

      // Membership from drop location: an item's center inside a group joins
      // it, outside every group leaves. Group-drags skip this (members stay).
      const changes = [];
      for (const id of g.dragIds) {
        const i = st.items.find((it) => it.id === id);
        const target = groupAtPoint(i.position_x + ITEM_W / 2, i.position_y + ITEM_H / 2);
        const targetId = target ? target.id : null;
        if ((i.group_id ?? null) !== targetId) changes.push({ itemId: id, groupId: targetId });
      }
      if (changes.length > 0) onMembershipChanges?.(changes);
    } else if (g.type === 'drag-group') {
      const grp = st.groups.find((x) => x.id === g.group.id);
      const updates = g.memberIds.map((id) => {
        const i = st.items.find((it) => it.id === id);
        return { id, position_x: Math.round(i.position_x), position_y: Math.round(i.position_y) };
      });
      onPersistMoves?.(updates, {
        id: grp.id,
        position_x: Math.round(grp.position_x),
        position_y: Math.round(grp.position_y),
      });
    } else if (g.type === 'resize-group') {
      const grp = st.groups.find((x) => x.id === g.group.id);
      onGroupResize?.(grp, Math.round(grp.width), Math.round(grp.height));
    }
  };

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const p = localPoint(e);
    if (e.ctrlKey || e.metaKey) {
      // Pinch-trackpads and ctrl+wheel zoom at the cursor
      useBrainstormStore.getState().zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.005));
    } else {
      useBrainstormStore.getState().panBy(-e.deltaX, -e.deltaY);
    }
  }, []);

  // React attaches wheel listeners passively; zooming needs preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ---- render ------------------------------------------------------------
  // Cull items far outside the viewport; groups are few and always rendered
  const tl = screenToWorld(viewport, -CULL_MARGIN, -CULL_MARGIN);
  const br = screenToWorld(viewport, size.w + CULL_MARGIN, size.h + CULL_MARGIN);
  const visibleItems = items.filter(
    (i) =>
      i.position_x + ITEM_W > tl.x && i.position_x < br.x &&
      i.position_y + ITEM_H > tl.y && i.position_y < br.y
  );
  const memberCounts = new Map();
  items.forEach((i) => {
    if (i.group_id != null) memberCounts.set(i.group_id, (memberCounts.get(i.group_id) || 0) + 1);
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden touch-none select-none bg-gray-100 dark:bg-gray-900 board-dot-grid"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {groups.map((group) => (
          <BoardGroupBox
            key={group.id}
            group={group}
            memberCount={memberCounts.get(group.id) || 0}
            canEdit={canEdit}
            isDark={isDark}
            onOpenColor={onOpenGroupColor}
            onDelete={onDeleteGroup}
            onRename={onRenameGroup}
          />
        ))}

        {visibleItems.map((item) => (
          <div
            key={item.id}
            data-item-id={item.id}
            className={`absolute ${canEdit && selectedIds.has(item.id)
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-pointer'}`}
            style={{ left: item.position_x, top: item.position_y }}
          >
            <BoardItemCard
              item={item}
              selected={selectedIds.has(item.id)}
              highlighted={highlightId === item.id}
              dimmed={dimmedIds ? dimmedIds.has(item.id) : false}
              lifted={liftedItemId === item.id}
            />
          </div>
        ))}
      </div>

      {/* Marquee (screen space) */}
      {marquee && (
        <div
          className="absolute border-2 border-accent/60 bg-accent/10 rounded pointer-events-none"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />
      )}
    </div>
  );
};

export default BoardCanvas;
