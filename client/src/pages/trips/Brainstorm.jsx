// client/src/pages/trips/Brainstorm.jsx
// Brainstorm board page (rewritten): orchestrates the board store, the
// BoardCanvas engine, the Mapbox side panel, realtime, and persistence.
// Gesture handling lives in BoardCanvas; board state in brainstormStore.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, FolderPlus, Search, ZoomIn, ZoomOut, Maximize,
  Map as MapIcon, X, Trash2, Ungroup, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { tripAPI, brainstormAPI } from '../../services/api';
import { hasMapbox } from '../../config/env';
import { useSocket } from '../../contexts/SocketContext';
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates';
import usePanelWidth from '../../hooks/usePanelWidth';
import useBrainstormStore, { screenToWorld, ITEM_W, ITEM_H } from '../../stores/brainstormStore';

import BoardCanvas from '../../components/brainstorm/board/BoardCanvas';
import ColorPalette from '../../components/brainstorm/board/ColorPalette';
import BrainstormMap from '../../components/brainstorm/BrainstormMap';
import BrainstormItemModal from '../../components/brainstorm/BrainstormItemModal';

const Brainstorm = ({ tripId: propTripId, fromDashboard = false }) => {
  const { tripId: routeTripId, token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { connectWithPublicToken } = useSocket();

  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalDefaults, setModalDefaults] = useState({ type: 'idea', location: null, spawn: null });
  const [colorTargetGroup, setColorTargetGroup] = useState(null);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const requestedTripId = propTripId || routeTripId;
  const tripId = requestedTripId || trip?.id;
  const canvasContainerRef = useRef(null);

  // Store
  const items = useBrainstormStore((s) => s.items);
  const selectedIds = useBrainstormStore((s) => s.selectedIds);
  const viewport = useBrainstormStore((s) => s.viewport);
  const {
    setBoard, upsertItem, removeItem, upsertGroup, removeGroup,
    moveItemsLocal, select, clearSelection, zoomAt, zoomToFit, centerOn, setHighlight,
  } = useBrainstormStore.getState();

  // Desktop split between canvas and map
  const { panelWidth, setPanelWidth, persistPanelWidth } = usePanelWidth('brainstormPanelWidth', {
    min: 400,
    defaultWidth: 640,
  });
  const [isResizing, setIsResizing] = useState(false);

  // ---- permissions -------------------------------------------------------
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const canEdit = !token && !!members.find(
    (m) => m.id === user.id && (m.role === 'owner' || m.role === 'editor')
  );

  // ---- data --------------------------------------------------------------
  useEffect(() => {
    if (token) connectWithPublicToken(token);
  }, [token, connectWithPublicToken]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (token) {
        const tripRes = await tripAPI.getTripByPublicToken(token);
        if (!tripRes.data.trip.is_brainstorm_public) {
          toast.error(t('brainstorm.notPublic', 'Brainstorming is not public for this trip'));
          navigate(`/trip/public/${token}`);
          return;
        }
        setTrip(tripRes.data.trip);
        setMembers(tripRes.data.members || []);
        const boardRes = await brainstormAPI.getPublicBrainstormItems(token);
        setBoard(boardRes.data.items || [], boardRes.data.groups || []);
      } else if (requestedTripId) {
        const [tripRes, itemsRes, groupsRes] = await Promise.all([
          tripAPI.getTripById(requestedTripId),
          brainstormAPI.getBrainstormItems(requestedTripId),
          brainstormAPI.getBrainstormGroups(requestedTripId),
        ]);
        setTrip(tripRes.data.trip);
        setMembers(tripRes.data.members || []);
        setBoard(itemsRes.data.items || [], groupsRes.data.groups || []);
      }
      // Land on the whole board
      requestAnimationFrame(() => {
        const el = canvasContainerRef.current;
        if (el) useBrainstormStore.getState().zoomToFit(el.clientWidth, el.clientHeight);
      });
    } catch (error) {
      console.error('Error fetching board:', error);
      toast.error(t('errors.failedFetch', 'Failed to load data'));
      navigate(token ? `/trip/public/${token}` : '/trips');
    } finally {
      setLoading(false);
    }
  }, [requestedTripId, token, navigate, t, setBoard]);

  useEffect(() => {
    fetchData();
    return () => setBoard([], []);
  }, [fetchData, setBoard]);

  // ---- realtime ----------------------------------------------------------
  const realtimeHandlers = useMemo(() => ({
    onBrainstormCreate: (item) => upsertItem(item),
    onBrainstormUpdate: (item) => upsertItem(item),
    onBrainstormDelete: (itemId) => removeItem(itemId),
    onBrainstormMove: ({ itemId, position_x, position_y }) =>
      moveItemsLocal([{ id: itemId, position_x, position_y }]),
    onBrainstormBatchMove: ({ positions, group }) => {
      if (positions?.length) moveItemsLocal(positions);
      if (group) upsertGroup(group);
    },
    onBrainstormGroupCreate: (group) => upsertGroup(group),
    onBrainstormGroupUpdate: (group) => upsertGroup(group),
    onBrainstormGroupDelete: (groupId) => removeGroup(groupId),
  }), [upsertItem, removeItem, moveItemsLocal, upsertGroup, removeGroup]);

  const {
    emitBrainstormCreate, emitBrainstormUpdate, emitBrainstormDelete,
    emitBrainstormMove, emitBrainstormBatchMove,
    emitBrainstormGroupCreate, emitBrainstormGroupUpdate, emitBrainstormGroupDelete,
  } = useRealtimeUpdates(tripId, realtimeHandlers);

  // ---- persistence callbacks from the canvas -----------------------------
  const handlePersistMoves = useCallback(async (updates, groupPatch) => {
    try {
      if (updates.length === 1 && !groupPatch) {
        const u = updates[0];
        await brainstormAPI.updateItemPosition(u.id, u.position_x, u.position_y, tripId);
        emitBrainstormMove(u.id, u.position_x, u.position_y);
        return;
      }
      if (updates.length > 0) await brainstormAPI.batchUpdatePositions(updates, tripId);
      let fullGroup = null;
      if (groupPatch) {
        const current = useBrainstormStore.getState().groups.find((g) => g.id === groupPatch.id);
        const res = await brainstormAPI.updateBrainstormGroup(groupPatch.id, { ...current, ...groupPatch });
        fullGroup = res.data.group || { ...current, ...groupPatch };
      }
      emitBrainstormBatchMove(updates, fullGroup);
    } catch (error) {
      console.error('Error persisting positions:', error);
      toast.error(t('brainstorm.saveFailed', 'Failed to save item'));
    }
  }, [tripId, emitBrainstormMove, emitBrainstormBatchMove, t]);

  const handleMembershipChanges = useCallback(async (changes) => {
    for (const { itemId, groupId } of changes) {
      try {
        const res = await brainstormAPI.updateBrainstormItem(
          itemId,
          { group_id: groupId ?? '' }, // '' ungroups (FormData drops null)
          tripId
        );
        upsertItem(res.data.item);
        emitBrainstormUpdate(res.data.item);
      } catch (error) {
        console.error('Error updating membership:', error);
      }
    }
  }, [tripId, upsertItem, emitBrainstormUpdate]);

  // ---- item CRUD ---------------------------------------------------------
  const viewportCenterWorld = () => {
    const el = canvasContainerRef.current;
    const vp = useBrainstormStore.getState().viewport;
    if (!el) return { x: 100, y: 100 };
    return screenToWorld(vp, el.clientWidth / 2, el.clientHeight / 2);
  };

  const openCreateModal = (type = 'idea', location = null, spawn = null) => {
    setEditingItem(null);
    setModalDefaults({ type, location, spawn });
    setIsModalOpen(true);
  };

  const handleQuickAdd = useCallback((worldPoint) => {
    openCreateModal('idea', null, worldPoint);
  }, []);

  const handleMapClick = useCallback((lngLat, locationName) => {
    if (!canEdit) return;
    openCreateModal('place', {
      latitude: lngLat.lat,
      longitude: lngLat.lng,
      location_name: locationName || '',
    }, null);
    setMobileMapOpen(false);
  }, [canEdit]);

  const handleEditItem = useCallback((item) => {
    if (!canEdit) return;
    setEditingItem(item);
    setModalDefaults({ type: item.type, location: null, spawn: null });
    setIsModalOpen(true);
  }, [canEdit]);

  const handleModalSave = async (itemData) => {
    try {
      if (editingItem && !editingItem.prefill) {
        const res = await brainstormAPI.updateBrainstormItem(editingItem.id, itemData, tripId);
        upsertItem(res.data.item);
        emitBrainstormUpdate(res.data.item);
        toast.success(t('brainstorm.updated', 'Item updated'));
      } else {
        const spawn = modalDefaults.spawn || (() => {
          const c = viewportCenterWorld();
          return { x: c.x - ITEM_W / 2, y: c.y - ITEM_H / 2 };
        })();
        const res = await brainstormAPI.createBrainstormItem(tripId, {
          ...itemData,
          position_x: Math.round(spawn.x),
          position_y: Math.round(spawn.y),
        });
        const newItem = res.data.item;
        upsertItem(newItem);
        emitBrainstormCreate(newItem);
        setHighlight(newItem.id);
        toast.success(t('brainstorm.created', 'Item created'));
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(error.response?.data?.message || t('brainstorm.saveFailed', 'Failed to save item'));
    }
  };

  // ---- groups ------------------------------------------------------------
  const handleAddGroup = async () => {
    try {
      const c = viewportCenterWorld();
      const res = await brainstormAPI.createBrainstormGroup(tripId, {
        title: t('brainstorm.newGroup', 'New Group'),
        position_x: Math.round(c.x - 200),
        position_y: Math.round(c.y - 150),
        width: 400,
        height: 300,
      });
      upsertGroup(res.data.group);
      emitBrainstormGroupCreate(res.data.group);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error(t('brainstorm.saveFailed', 'Failed to save item'));
    }
  };

  const persistGroup = useCallback(async (group, patch) => {
    try {
      const merged = { ...group, ...patch };
      upsertGroup(merged);
      const res = await brainstormAPI.updateBrainstormGroup(group.id, merged);
      const saved = res.data.group || merged;
      upsertGroup(saved);
      emitBrainstormGroupUpdate(saved);
    } catch (error) {
      console.error('Error updating group:', error);
    }
  }, [upsertGroup, emitBrainstormGroupUpdate]);

  const handleGroupResize = useCallback((group, width, height) => {
    persistGroup(group, { width, height });
  }, [persistGroup]);

  const handleRenameGroup = useCallback((group) => {
    const title = window.prompt(t('brainstorm.renameGroup', 'Group name'), group.title || '');
    if (title !== null && title.trim() !== '') persistGroup(group, { title: title.trim() });
  }, [persistGroup, t]);

  const handleDeleteGroup = useCallback(async (group) => {
    if (!confirm(t('brainstorm.deleteGroupConfirm', 'Delete this group? Its items are kept.'))) return;
    try {
      await brainstormAPI.deleteBrainstormGroup(group.id);
      removeGroup(group.id);
      emitBrainstormGroupDelete(group.id);
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  }, [t, removeGroup, emitBrainstormGroupDelete]);

  // ---- bulk actions on the selection -------------------------------------
  const applyToSelection = async (patch, label) => {
    setIsBusy(true);
    try {
      for (const id of selectedIds) {
        const res = await brainstormAPI.updateBrainstormItem(id, patch, tripId);
        upsertItem(res.data.item);
        emitBrainstormUpdate(res.data.item);
      }
      if (label) toast.success(label);
    } catch (error) {
      console.error('Bulk update failed:', error);
      toast.error(t('brainstorm.saveFailed', 'Failed to save item'));
    } finally {
      setIsBusy(false);
    }
  };

  const deleteSelection = async () => {
    if (!confirm(t('brainstorm.deleteSelectedConfirm', 'Delete the selected items?'))) return;
    setIsBusy(true);
    try {
      for (const id of selectedIds) {
        await brainstormAPI.deleteBrainstormItem(id, tripId);
        removeItem(id);
        emitBrainstormDelete(id);
      }
      clearSelection();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      toast.error(t('errors.deleteFailed', { item: 'items' }));
    } finally {
      setIsBusy(false);
    }
  };

  // ---- search ------------------------------------------------------------
  const matchesQuery = (item, q) =>
    [item.title, item.content, item.location_name, item.url]
      .some((f) => f && f.toLowerCase().includes(q));

  const dimmedIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(items.filter((i) => !matchesQuery(i, q)).map((i) => i.id));
  }, [items, searchQuery]);

  const flyToFirstMatch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = items.find((i) => matchesQuery(i, q));
    const el = canvasContainerRef.current;
    if (match && el) {
      centerOn(
        match.position_x + ITEM_W / 2,
        match.position_y + ITEM_H / 2,
        el.clientWidth,
        el.clientHeight,
        Math.max(useBrainstormStore.getState().viewport.zoom, 0.8)
      );
      setHighlight(match.id);
      select([match.id]);
    }
  };

  // ---- desktop panel resize ---------------------------------------------
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e) => {
      const rect = canvasContainerRef.current?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      setPanelWidth(Math.max(400, e.clientX - rect.left));
    };
    const onUp = () => {
      setIsResizing(false);
      persistPanelWidth();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setPanelWidth, persistPanelWidth]);

  // ---- render ------------------------------------------------------------
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  const backLink = token
    ? `/trip/public/${token}`
    : fromDashboard ? '/brainstorm' : `/trips/${tripId}`;
  const showMapPanel = hasMapbox;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20">
        <Link
          to={backLink}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('common.back', 'Back')}</span>
        </Link>
        <h1 className="font-display font-semibold text-gray-900 dark:text-white whitespace-nowrap">
          {t('brainstorm.title', 'Brainstorm')}
        </h1>

        {/* Search */}
        <div className="flex-1 max-w-sm ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && flyToFirstMatch()}
            placeholder={t('brainstorm.searchPlaceholder', 'Search the board…')}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <span className="hidden lg:block text-sm text-gray-400 truncate max-w-[180px]">{trip?.name}</span>
      </div>

      {/* Body */}
      <div className="flex-1 flex relative min-h-0">
        {/* Canvas pane */}
        <div
          ref={canvasContainerRef}
          className="relative h-full flex-shrink-0 max-md:!w-full"
          style={{ width: showMapPanel ? `${panelWidth}px` : '100%' }}
        >
          <div className="absolute inset-0">
            <BoardCanvas
              canEdit={canEdit}
              dimmedIds={dimmedIds}
              onPersistMoves={handlePersistMoves}
              onMembershipChanges={handleMembershipChanges}
              onEditItem={handleEditItem}
              onQuickAdd={handleQuickAdd}
              onGroupResize={handleGroupResize}
              onOpenGroupColor={setColorTargetGroup}
              onDeleteGroup={handleDeleteGroup}
              onRenameGroup={handleRenameGroup}
            />

            {/* Zoom controls */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10">
              <button
                onClick={() => {
                  const el = canvasContainerRef.current;
                  zoomAt(el.clientWidth / 2, el.clientHeight / 2, 0.9);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t('brainstorm.zoomOut', 'Zoom out')}
              >
                <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-center">
                {Math.round(viewport.zoom * 100)}%
              </span>
              <button
                onClick={() => {
                  const el = canvasContainerRef.current;
                  zoomAt(el.clientWidth / 2, el.clientHeight / 2, 1.12);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t('brainstorm.zoomIn', 'Zoom in')}
              >
                <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={() => {
                  const el = canvasContainerRef.current;
                  zoomToFit(el.clientWidth, el.clientHeight);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={t('brainstorm.zoomToFit', 'Fit board')}
              >
                <Maximize className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Add buttons */}
            {canEdit && (
              <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 z-10">
                <button
                  onClick={handleAddGroup}
                  className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  title={t('brainstorm.addGroup', 'Add group')}
                >
                  <FolderPlus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => openCreateModal()}
                  className="p-3.5 rounded-xl bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-hover"
                  title={t('brainstorm.addItem', 'Add item')}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Mobile map toggle */}
            {showMapPanel && (
              <button
                onClick={() => setMobileMapOpen(true)}
                className="md:hidden absolute top-3 right-3 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10"
                title={t('brainstorm.showMap', 'Show map')}
              >
                <MapIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            )}

            {/* Selection action bar */}
            {canEdit && selectedIds.size > 0 && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl z-10 max-w-[95%]">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  {selectedIds.size} {t('brainstorm.selected', 'selected')}
                </span>
                <ColorPalette
                  value={undefined}
                  onChange={(color) => applyToSelection({ color: color ?? '' })}
                />
                <button
                  disabled={isBusy}
                  onClick={() => applyToSelection({ group_id: '' }, t('brainstorm.ungrouped', 'Removed from groups'))}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
                  title={t('brainstorm.ungroup', 'Remove from group')}
                >
                  <Ungroup className="w-4 h-4 text-gray-500" />
                </button>
                <button
                  disabled={isBusy}
                  onClick={deleteSelection}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40"
                  title={t('common.delete', 'Delete')}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
                <button
                  onClick={clearSelection}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}

            {/* Group color popover */}
            {colorTargetGroup && (
              <div
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/20"
                onClick={() => setColorTargetGroup(null)}
              >
                <div
                  className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    {colorTargetGroup.title || t('brainstorm.groupColor', 'Group color')}
                  </p>
                  <ColorPalette
                    value={colorTargetGroup.color === '#e5e7eb' ? null : colorTargetGroup.color}
                    onChange={(color) => {
                      persistGroup(colorTargetGroup, { color: color ?? '' });
                      setColorTargetGroup(null);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider (desktop) */}
        {showMapPanel && (
          <div
            onPointerDown={() => setIsResizing(true)}
            className="hidden md:block w-1.5 h-full cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-accent transition-colors flex-shrink-0"
          />
        )}

        {/* Map pane (desktop) */}
        {showMapPanel && (
          <div className="hidden md:block flex-1 relative min-w-0">
            <BrainstormMap
              items={items}
              trip={trip}
              canEdit={canEdit}
              onMapClick={handleMapClick}
              onItemClick={handleEditItem}
            />
          </div>
        )}
      </div>

      {/* Mobile fullscreen map */}
      {showMapPanel && mobileMapOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-gray-900">
          <BrainstormMap
            items={items}
            trip={trip}
            canEdit={canEdit}
            onMapClick={handleMapClick}
            onItemClick={(item) => {
              setMobileMapOpen(false);
              handleEditItem(item);
            }}
            showAddHint={false}
          />
          {/* Fat, thumb-reachable exit — the top corners belong to the
              map's search bar */}
          <button
            onClick={() => setMobileMapOpen(false)}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-medium shadow-xl border border-gray-200 dark:border-gray-700 z-50 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('brainstorm.backToCanvas', 'Back to canvas')}
          </button>
        </div>
      )}

      {/* Item editor */}
      <BrainstormItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleModalSave}
        editingItem={editingItem}
        defaultType={modalDefaults.type}
        defaultLocation={modalDefaults.location}
      />
    </div>
  );
};

export default Brainstorm;
