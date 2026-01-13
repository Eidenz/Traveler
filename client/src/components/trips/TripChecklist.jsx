// client/src/components/trips/TripChecklist.jsx
import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Square, PlusCircle, Edit, Trash2,
  ChevronDown, ChevronRight, Users, Circle, CheckCircle, XCircle
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { checklistAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/authStore';

const TripChecklist = ({ tripId, canEdit }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedChecklistId, setExpandedChecklistId] = useState(null);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [showNewChecklistForm, setShowNewChecklistForm] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistName, setEditingChecklistName] = useState('');
  const [newItemForm, setNewItemForm] = useState({ checklistId: null, description: '', note: '' });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemForm, setEditingItemForm] = useState({ description: '', note: '' });

  // Fetch checklists
  useEffect(() => {
    fetchChecklists();
  }, [tripId]);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await checklistAPI.getTripChecklists(tripId);
      setChecklists(response.data.checklists || []);

      // Auto-expand first checklist if none is expanded
      if (!expandedChecklistId && response.data.checklists.length > 0) {
        const firstChecklistId = response.data.checklists[0].id;
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
      setChecklists(prev => prev.map(checklist =>
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
      const response = await checklistAPI.createChecklist(tripId, newChecklistName);
      const newChecklist = response.data.checklist;
      setChecklists(prev => [...prev, { ...newChecklist, items: [] }]);
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
      setChecklists(prev => prev.map(checklist =>
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
      setChecklists(prev => prev.filter(c => c.id !== checklistId));
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

      setChecklists(prev => prev.map(checklist =>
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

      setChecklists(prev => prev.map(checklist =>
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
      setChecklists(prev => prev.map(checklist =>
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
    try {
      const newStatus = item.current_user_status === 'checked' ? 'pending' : 'checked';
      const response = await checklistAPI.updateUserItemStatus(item.id, newStatus, tripId);

      setChecklists(prev => prev.map(checklist =>
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

  const getCompletionPercentage = (checklist) => {
    if (!checklist.items || checklist.items.length === 0) {
      const total = checklist.total_items || 0;
      if (total === 0) return 0;
      const completed = checklist.completed_items || 0;
      return Math.round((completed / total) * 100);
    }

    const totalItems = checklist.items.length;
    if (totalItems === 0) return 0;

    const totalCompletionPercentage = checklist.items.reduce((sum, item) => {
      return sum + (item.completion?.percentage || 0);
    }, 0);

    return Math.round(totalCompletionPercentage / totalItems);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add Checklist Button */}
      {canEdit && !showNewChecklistForm && (
        <button
          onClick={() => setShowNewChecklistForm(true)}
          className="w-full p-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Checklist
        </button>
      )}

      {/* New Checklist Form */}
      {canEdit && showNewChecklistForm && (
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
      {checklists.length === 0 ? (
        <div className="text-center py-12">
          <CheckSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No checklists yet</p>
          {canEdit && (
            <Button onClick={() => setShowNewChecklistForm(true)} className="mt-4" size="sm">
              Add Checklist
            </Button>
          )}
        </div>
      ) : (
        checklists.map(checklist => (
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
                    <div className="flex items-center gap-2 flex-1">
                      {expandedChecklistId === checklist.id ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <h3 className="font-medium text-gray-900 dark:text-white">{checklist.name}</h3>
                    </div>

                    {canEdit && (
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

                  {/* Progress */}
                  <div className="mt-2 ml-6">
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>
                        {checklist.items?.filter(i => i.completion?.is_complete).length || 0} / {checklist.total_items || 0} complete
                      </span>
                      <span>{getCompletionPercentage(checklist)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${getCompletionPercentage(checklist)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Checklist Items */}
            {expandedChecklistId === checklist.id && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                {/* Add Item Button */}
                {canEdit && newItemForm.checklistId !== checklist.id && (
                  <button
                    onClick={() => setNewItemForm({ checklistId: checklist.id, description: '', note: '' })}
                    className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:text-accent hover:bg-accent/5 transition-colors flex items-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add item
                  </button>
                )}

                {/* New Item Form */}
                {canEdit && newItemForm.checklistId === checklist.id && (
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
                              {item.completion && item.completion.total_members > 0 && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Users className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">
                                    {item.completion.checked_count}/{item.completion.total_members}
                                  </span>
                                </div>
                              )}
                            </div>

                            {canEdit && (
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