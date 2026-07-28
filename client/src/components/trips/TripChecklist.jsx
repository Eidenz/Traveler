// client/src/components/trips/TripChecklist.jsx
import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Square, PlusCircle, Edit, Trash2,
  ChevronDown, ChevronRight, Users, Circle, CheckCircle, XCircle, Lock
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { checklistAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const TripChecklist = ({ tripId, canEdit, checklists: externalChecklists, onChange, isOfflineMode = false }) => {
  const { t } = useTranslation();

  const [internalChecklists, setInternalChecklists] = useState([]);
  // Use external checklists if provided, otherwise use internal state
  const checklists = externalChecklists ?? internalChecklists;
  // 'shared' checklists are visible to all members, 'personal' only to their creator
  const [scope, setScope] = useState('shared');
  const [loading, setLoading] = useState(true);
  const [expandedChecklistId, setExpandedChecklistId] = useState(null);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [showNewChecklistForm, setShowNewChecklistForm] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistName, setEditingChecklistName] = useState('');
  const [newItemForm, setNewItemForm] = useState({ checklistId: null, description: '', note: '' });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemForm, setEditingItemForm] = useState({ description: '', note: '' });

  // Notify parent of checklists count change
  const notifyChange = (newChecklists) => {
    if (onChange) {
      onChange(newChecklists);
    }
  };

  // Update internal state and notify parent
  const updateChecklists = (newChecklists) => {
    if (externalChecklists === undefined) {
      setInternalChecklists(newChecklists);
    }
    notifyChange(newChecklists);
  };

  // Fetch checklists (offline mode uses the pre-loaded snapshot instead)
  useEffect(() => {
    if (isOfflineMode) {
      setLoading(false);
      return;
    }
    fetchChecklists();
  }, [tripId, isOfflineMode]);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await checklistAPI.getTripChecklists(tripId);
      const fetchedChecklists = response.data.checklists || [];
      updateChecklists(fetchedChecklists);

      // Auto-expand first checklist if none is expanded
      if (!expandedChecklistId && fetchedChecklists.length > 0) {
        const firstChecklistId = fetchedChecklists[0].id;
        setExpandedChecklistId(firstChecklistId);
        await fetchChecklistItems(firstChecklistId);
      }
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklistItems = async (checklistId) => {
    try {
      const response = await checklistAPI.getChecklist(checklistId);
      updateChecklists(prev => prev.map(checklist =>
        checklist.id === checklistId
          ? { ...checklist, items: response.data.items || [] }
          : checklist
      ));
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load checklist items');
    }
  };

  const toggleChecklist = async (checklistId) => {
    if (expandedChecklistId === checklistId) {
      setExpandedChecklistId(null);
    } else {
      setExpandedChecklistId(checklistId);
      const checklist = checklists.find(c => c.id === checklistId);
      if (!checklist.items) {
        await fetchChecklistItems(checklistId);
      }
    }
  };

  const handleCreateChecklist = async (e) => {
    e.preventDefault();
    if (!newChecklistName.trim()) {
      toast.error('Please enter a checklist name');
      return;
    }

    try {
      const response = await checklistAPI.createChecklist(tripId, newChecklistName, scope === 'personal');
      const newChecklist = response.data.checklist;
      updateChecklists(prev => [...prev, { ...newChecklist, items: [] }]);
      setExpandedChecklistId(newChecklist.id);
      setNewChecklistName('');
      setShowNewChecklistForm(false);
      toast.success('Checklist created');
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast.error('Failed to create checklist');
    }
  };

  const handleUpdateChecklist = async (checklistId) => {
    if (!editingChecklistName.trim()) {
      toast.error('Please enter a checklist name');
      return;
    }

    try {
      const response = await checklistAPI.updateChecklist(checklistId, editingChecklistName, tripId);
      updateChecklists(prev => prev.map(checklist =>
        checklist.id === checklistId
          ? { ...checklist, name: response.data.checklist.name }
          : checklist
      ));
      setEditingChecklistId(null);
      setEditingChecklistName('');
      toast.success('Checklist updated');
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Failed to update checklist');
    }
  };

  const handleDeleteChecklist = async (checklistId) => {
    if (!confirm('Delete this checklist?')) return;

    try {
      await checklistAPI.deleteChecklist(checklistId, tripId);
      updateChecklists(prev => prev.filter(c => c.id !== checklistId));
      if (expandedChecklistId === checklistId) {
        setExpandedChecklistId(null);
      }
      toast.success('Checklist deleted');
    } catch (error) {
      console.error('Error deleting checklist:', error);
      toast.error('Failed to delete checklist');
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!newItemForm.description.trim()) {
      toast.error('Please enter an item description');
      return;
    }

    try {
      const response = await checklistAPI.createChecklistItem(
        newItemForm.checklistId,
        { description: newItemForm.description, note: newItemForm.note },
        tripId
      );

      updateChecklists(prev => prev.map(checklist =>
        checklist.id === newItemForm.checklistId
          ? {
            ...checklist,
            items: [...(checklist.items || []), {
              ...response.data.item,
              user_statuses: [],
              current_user_status: 'pending',
              completion: {
                total_members: 0,
                checked_count: 0,
                percentage: 0,
                is_complete: false
              }
            }],
            total_items: (checklist.total_items || 0) + 1
          }
          : checklist
      ));

      setNewItemForm({ checklistId: null, description: '', note: '' });
      toast.success('Item added');
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to add item');
    }
  };

  const handleUpdateItem = async (checklistId, itemId) => {
    if (!editingItemForm.description.trim()) {
      toast.error('Please enter an item description');
      return;
    }

    try {
      const response = await checklistAPI.updateChecklistItem(
        itemId,
        { description: editingItemForm.description, note: editingItemForm.note },
        tripId
      );

      const currentItem = checklists
        .find(c => c.id === checklistId)?.items
        .find(i => i.id === itemId);

      updateChecklists(prev => prev.map(checklist =>
        checklist.id === checklistId
          ? {
            ...checklist,
            items: (checklist.items || []).map(item =>
              item.id === itemId ? {
                ...response.data.item,
                user_statuses: currentItem?.user_statuses || [],
                current_user_status: currentItem?.current_user_status || 'pending',
                completion: currentItem?.completion
              } : item
            )
          }
          : checklist
      ));

      setEditingItemId(null);
      setEditingItemForm({ description: '', note: '' });
      toast.success('Item updated');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (checklistId, itemId) => {
    if (!confirm('Delete this item?')) return;

    try {
      await checklistAPI.deleteChecklistItem(itemId, tripId);
      updateChecklists(prev => prev.map(checklist =>
        checklist.id === checklistId
          ? {
            ...checklist,
            items: (checklist.items || []).filter(item => item.id !== itemId),
            total_items: (checklist.total_items || 0) - 1
          }
          : checklist
      ));
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleToggleStatus = async (checklistId, item) => {
    if (isOfflineMode) {
      toast.error(t('offline.checklistReadOnly', 'Checklists are read-only while offline'));
      return;
    }
    try {
      const newStatus = item.current_user_status === 'checked' ? 'pending' : 'checked';
      const response = await checklistAPI.updateUserItemStatus(item.id, newStatus, tripId);

      updateChecklists(prev => prev.map(checklist =>
        checklist.id === checklistId
          ? {
            ...checklist,
            items: (checklist.items || []).map(i =>
              i.id === item.id ? response.data.item : i
            )
          }
          : checklist
      ));

      toast.success(newStatus === 'checked' ? 'Item checked' : 'Item unchecked');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

  // Your own progress. Computed live from loaded items when available,
  // otherwise from the list endpoint's summary fields — so the bar renders
  // as soon as the tab opens, before any dropdown has been expanded.
  const getOwnProgress = (checklist) => {
    const useItems = Array.isArray(checklist.items);
    const total = useItems ? checklist.items.length : (checklist.total_items || 0);
    if (total === 0) return { checked: 0, total: 0, percentage: 0 };
    const checked = useItems
      ? checklist.items.filter(i => i.current_user_status === 'checked').length
      : (checklist.user_completed_items || 0);
    return { checked, total, percentage: Math.round((checked / total) * 100) };
  };

  // Whole-group progress (shown in the header badge). Live from loaded
  // items, otherwise the list endpoint's group_percentage summary.
  const getGroupPercentage = (checklist) => {
    if (Array.isArray(checklist.items) && checklist.items.length > 0) {
      const sum = checklist.items.reduce((acc, item) => acc + (item.completion?.percentage || 0), 0);
      return Math.round(sum / checklist.items.length);
    }
    return checklist.group_percentage || 0;
  };

  // Split checklists by scope (the server only ever returns the user's own personal lists)
  const sharedChecklists = checklists.filter(c => !c.is_personal);
  const personalChecklists = checklists.filter(c => !!c.is_personal);
  const visibleChecklists = scope === 'personal' ? personalChecklists : sharedChecklists;

  // Anyone can manage their own personal checklists; shared ones need edit access.
  // Everything is read-only while offline.
  const canModify = !isOfflineMode && (scope === 'personal' || canEdit);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Shared / Personal toggle */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-900 rounded-xl">
        <button
          type="button"
          onClick={() => setScope('shared')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${scope === 'shared'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('checklists.shared', 'Shared')}</span>
          {sharedChecklists.length > 0 && (
            <span className="text-xs opacity-70">({sharedChecklists.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setScope('personal')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${scope === 'personal'
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
        >
          <Lock className="w-4 h-4" />
          <span>{t('checklists.personal', 'Personal')}</span>
          {personalChecklists.length > 0 && (
            <span className="text-xs opacity-70">({personalChecklists.length})</span>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
        {scope === 'personal'
          ? t('checklists.personalDescription', 'Only visible to you')
          : t('checklists.sharedDescription', 'Visible to all trip members')
        }
      </p>

      {/* Add Checklist Button */}
      {canModify && !showNewChecklistForm && (
        <button
          onClick={() => setShowNewChecklistForm(true)}
          className="w-full p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Checklist
        </button>
      )}

      {/* New Checklist Form */}
      {canModify && showNewChecklistForm && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <form onSubmit={handleCreateChecklist} className="space-y-2">
            <Input
              placeholder="Checklist name"
              value={newChecklistName}
              onChange={(e) => setNewChecklistName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1">Create</Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowNewChecklistForm(false);
                  setNewChecklistName('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Checklists */}
      {visibleChecklists.length === 0 ? (
        <div className="text-center py-12">
          {scope === 'personal' ? (
            <Lock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          ) : (
            <CheckSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          )}
          <p className="text-gray-500 dark:text-gray-400">
            {scope === 'personal'
              ? t('checklists.noPersonal', 'No personal checklists yet')
              : t('checklists.noShared', 'No checklists yet')
            }
          </p>
          {canModify && (
            <Button onClick={() => setShowNewChecklistForm(true)} className="mt-4" size="sm">
              Add Checklist
            </Button>
          )}
        </div>
      ) : (
        visibleChecklists.map(checklist => (
          <div
            key={checklist.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
          >
            {/* Checklist Header */}
            <div
              className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => toggleChecklist(checklist.id)}
            >
              {editingChecklistId === checklist.id ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editingChecklistName}
                    onChange={(e) => setEditingChecklistName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleUpdateChecklist(checklist.id)}
                    >
                      Save
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingChecklistId(null);
                        setEditingChecklistName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {expandedChecklistId === checklist.id ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{checklist.name}</h3>
                    </div>

                    {/* Group progress badge (the bar below tracks your own checks) */}
                    {!checklist.is_personal && (
                      <span
                        title={t('checklists.groupProgress', 'Group progress')}
                        className="flex items-center gap-1 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                      >
                        <Users className="w-3 h-3" />
                        {getGroupPercentage(checklist)}%
                      </span>
                    )}

                    {canModify && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingChecklistId(checklist.id);
                            setEditingChecklistName(checklist.name);
                          }}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteChecklist(checklist.id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress — your own checks (group progress is the badge above) */}
                  {(() => {
                    const own = getOwnProgress(checklist);
                    return (
                      <div className="mt-2 ml-6">
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>
                            {checklist.is_personal
                              ? t('checklists.ownProgressPersonal', '{{checked}} / {{total}} checked', { checked: own.checked, total: own.total })
                              : t('checklists.ownProgressShared', '{{checked}} / {{total}} checked by you', { checked: own.checked, total: own.total })}
                          </span>
                          <span>{own.percentage}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${own.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Checklist Items */}
            {expandedChecklistId === checklist.id && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                {/* Add Item Button */}
                {canModify && newItemForm.checklistId !== checklist.id && (
                  <button
                    onClick={() => setNewItemForm({ checklistId: checklist.id, description: '', note: '' })}
                    className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:text-accent hover:bg-accent/5 transition-colors flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add item
                  </button>
                )}

                {/* New Item Form */}
                {canModify && newItemForm.checklistId === checklist.id && (
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <form onSubmit={handleCreateItem} className="space-y-2">
                      <Input
                        placeholder="Item description"
                        value={newItemForm.description}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, description: e.target.value }))}
                        autoFocus
                      />
                      <Input
                        placeholder="Optional note"
                        value={newItemForm.note}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, note: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" className="flex-1">Add</Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setNewItemForm({ checklistId: null, description: '', note: '' })}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Items List */}
                {checklist.items && checklist.items.length > 0 ? (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {checklist.items.map(item => (
                      <div key={item.id} className="p-3">
                        {editingItemId === item.id ? (
                          <form onSubmit={(e) => { e.preventDefault(); handleUpdateItem(checklist.id, item.id); }} className="space-y-2">
                            <Input
                              value={editingItemForm.description}
                              onChange={(e) => setEditingItemForm(prev => ({ ...prev, description: e.target.value }))}
                              autoFocus
                            />
                            <Input
                              placeholder="Optional note"
                              value={editingItemForm.note}
                              onChange={(e) => setEditingItemForm(prev => ({ ...prev, note: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" className="flex-1">Save</Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingItemId(null);
                                  setEditingItemForm({ description: '', note: '' });
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => handleToggleStatus(checklist.id, item)}
                              className="mt-0.5 flex-shrink-0"
                            >
                              {item.current_user_status === 'checked' ? (
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <Circle className="w-5 h-5 text-gray-300 hover:text-emerald-500 transition-colors" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${item.current_user_status === 'checked' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                {item.description}
                              </p>
                              {item.note && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.note}</p>
                              )}
                              {!checklist.is_personal && item.completion && item.completion.total_members > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Users className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {item.completion.checked_count}/{item.completion.total_members}
                                  </span>
                                </div>
                              )}
                            </div>

                            {canModify && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setEditingItemForm({ description: item.description, note: item.note || '' });
                                  }}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5 text-gray-500" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(checklist.id, item.id)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No items yet
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TripChecklist;