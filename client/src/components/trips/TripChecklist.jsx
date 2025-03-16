// client/src/components/trips/TripChecklist.jsx
import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Square, User, Clock, PlusCircle, Edit, 
  Trash2, Save, X, MoreHorizontal, AlertCircle, AlertTriangle,
  CheckCircle, XCircle, Circle, Users
} from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { checklistAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { getImageUrl } from '../../utils/imageUtils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../stores/authStore';

// Extend dayjs with relative time
dayjs.extend(relativeTime);

const TripChecklist = ({ tripId, canEdit }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  
  // State
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newItemForm, setNewItemForm] = useState({
    checklistId: null,
    description: '',
    note: ''
  });
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistName, setEditingChecklistName] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemForm, setEditingItemForm] = useState({
    description: '',
    note: ''
  });
  const [expandedChecklists, setExpandedChecklists] = useState({});
  const [selectedChecklistId, setSelectedChecklistId] = useState(null);
  const [showActionMenus, setShowActionMenus] = useState({});
  const [showUserStatuses, setShowUserStatuses] = useState({});
  
  // Fetch checklists when component mounts
  useEffect(() => {
    fetchChecklists();
  }, [tripId]);

  // When a checklist is selected, expand it
  useEffect(() => {
    if (selectedChecklistId) {
      setExpandedChecklists(prev => ({
        ...prev,
        [selectedChecklistId]: true
      }));
    }
  }, [selectedChecklistId]);
  
  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await checklistAPI.getTripChecklists(tripId);
      setChecklists(response.data.checklists || []);
      
      // Initialize expanded state for all checklists
      const expanded = {};
      response.data.checklists.forEach(checklist => {
        // Expand the first checklist by default if there's no selected one
        expanded[checklist.id] = checklist.id === selectedChecklistId || 
          (!selectedChecklistId && response.data.checklists.indexOf(checklist) === 0);
      });
      
      setExpandedChecklists(expanded);
      
      // Select the first checklist if none is selected and one exists
      if (!selectedChecklistId && response.data.checklists.length > 0) {
        setSelectedChecklistId(response.data.checklists[0].id);
        await fetchChecklistItems(response.data.checklists[0].id);
      }
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error(t('errors.loadFailed', { item: 'checklists' }));
    } finally {
      setLoading(false);
    }
  };
  
  const fetchChecklistItems = async (checklistId) => {
    try {
      const response = await checklistAPI.getChecklist(checklistId);
      
      // Update the checklist with its items
      setChecklists(prev => prev.map(checklist => 
        checklist.id === checklistId 
          ? { ...checklist, items: response.data.items || [] } 
          : checklist
      ));
    } catch (error) {
      console.error(`Error fetching checklist items for ${checklistId}:`, error);
      toast.error(t('errors.loadFailed', { item: 'checklist items' }));
    }
  };
  
  const handleCreateChecklist = async (e) => {
    e.preventDefault();
    
    if (!newChecklistName.trim()) {
      toast.error(t('errors.required', { field: 'Checklist name' }));
      return;
    }
    
    try {
      const response = await checklistAPI.createChecklist(tripId, newChecklistName);
      
      // Add the new checklist to state
      const newChecklist = response.data.checklist;
      setChecklists(prev => [...prev, { ...newChecklist, items: [] }]);
      
      // Select and expand the new checklist
      setSelectedChecklistId(newChecklist.id);
      setExpandedChecklists(prev => ({
        ...prev,
        [newChecklist.id]: true
      }));
      
      setNewChecklistName('');
      toast.success('Checklist created successfully');
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast.error(error.response?.data?.message || 'Failed to create checklist');
    }
  };
  
  const handleUpdateChecklist = async (checklistId) => {
    if (!editingChecklistName.trim()) {
      toast.error(t('errors.required', { field: 'Checklist name' }));
      return;
    }
    
    try {
      const response = await checklistAPI.updateChecklist(checklistId, editingChecklistName, tripId);
      
      // Update checklist in state
      setChecklists(prev => prev.map(checklist => 
        checklist.id === checklistId 
          ? { ...checklist, name: response.data.checklist.name } 
          : checklist
      ));
      
      setEditingChecklistId(null);
      setEditingChecklistName('');
      toast.success('Checklist updated successfully');
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error(error.response?.data?.message || 'Failed to update checklist');
    }
  };
  
  const handleDeleteChecklist = async (checklistId) => {
    try {
      await checklistAPI.deleteChecklist(checklistId, tripId);
      
      // Remove checklist from state
      setChecklists(prev => prev.filter(checklist => checklist.id !== checklistId));
      
      // If the deleted checklist was selected, select another one
      if (selectedChecklistId === checklistId) {
        const remainingChecklists = checklists.filter(cl => cl.id !== checklistId);
        if (remainingChecklists.length > 0) {
          setSelectedChecklistId(remainingChecklists[0].id);
        } else {
          setSelectedChecklistId(null);
        }
      }
      
      toast.success('Checklist deleted successfully');
    } catch (error) {
      console.error('Error deleting checklist:', error);
      toast.error(error.response?.data?.message || 'Failed to delete checklist');
    }
  };
  
  const handleEditChecklist = (checklist) => {
    setEditingChecklistId(checklist.id);
    setEditingChecklistName(checklist.name);
    setShowActionMenus({});
  };
  
  const handleCancelEditChecklist = () => {
    setEditingChecklistId(null);
    setEditingChecklistName('');
  };
  
  const handleAddItem = (checklistId) => {
    setNewItemForm({
      checklistId,
      description: '',
      note: ''
    });
  };
  
  const handleCreateItem = async (e) => {
    e.preventDefault();
    
    if (!newItemForm.description.trim()) {
      toast.error(t('errors.required', { field: 'Item description' }));
      return;
    }
    
    try {
      const response = await checklistAPI.createChecklistItem(
        newItemForm.checklistId, 
        { 
          description: newItemForm.description,
          note: newItemForm.note
        },
        tripId
      );
      
      // Add the new item to its checklist
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
                  skipped_count: 0,
                  percentage: 0,
                  is_complete: false
                }
              }],
              total_items: (checklist.total_items || 0) + 1
            } 
          : checklist
      ));
      
      // Reset the form
      setNewItemForm({
        checklistId: null,
        description: '',
        note: ''
      });
      
      toast.success('Item added successfully');
    } catch (error) {
      console.error('Error creating checklist item:', error);
      toast.error(error.response?.data?.message || 'Failed to add item');
    }
  };
  
  const handleEditItem = (item) => {
    setEditingItemId(item.id);
    setEditingItemForm({
      description: item.description,
      note: item.note || ''
    });
  };
  
  const handleUpdateItem = async (checklistId, itemId) => {
    if (!editingItemForm.description.trim()) {
      toast.error(t('errors.required', { field: 'Item description' }));
      return;
    }
    
    try {
      const response = await checklistAPI.updateChecklistItem(
        itemId, 
        {
          description: editingItemForm.description,
          note: editingItemForm.note
        },
        tripId
      );
      
      // Preserve user_statuses and completion info in the updated item
      const currentItem = checklists
        .find(c => c.id === checklistId)?.items
        .find(i => i.id === itemId);
      
      // Update the item in state
      setChecklists(prev => prev.map(checklist => 
        checklist.id === checklistId 
          ? { 
              ...checklist, 
              items: (checklist.items || []).map(item => 
                item.id === itemId ? {
                  ...response.data.item,
                  user_statuses: currentItem?.user_statuses || [],
                  current_user_status: currentItem?.current_user_status || t('checklists.pending'),
                  completion: currentItem?.completion || {
                    total_members: 0,
                    checked_count: 0,
                    skipped_count: 0,
                    percentage: 0,
                    is_complete: false
                  }
                } : item
              )
            } 
          : checklist
      ));
      
      setEditingItemId(null);
      setEditingItemForm({
        description: '',
        note: ''
      });
      
      toast.success(t('checklists.itemUpdated'));
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error(error.response?.data?.message || 'Failed to update item');
    }
  };
  
  const handleDeleteItem = async (checklistId, itemId) => {
    try {
      await checklistAPI.deleteChecklistItem(itemId, tripId);
      
      // Remove the item from state
      setChecklists(prev => prev.map(checklist => 
        checklist.id === checklistId 
          ? { 
              ...checklist, 
              items: (checklist.items || []).filter(item => item.id !== itemId),
              total_items: (checklist.total_items || 0) - 1
            } 
          : checklist
      ));
      
      toast.success(t('checklists.itemDeleted'));
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      toast.error(error.response?.data?.message || 'Failed to delete item');
    }
  };
  
  const handleToggleUserStatus = async (checklistId, item) => {
    try {
      // Toggle between checked and pending
      const newStatus = item.current_user_status === 'checked' ? 'pending' : 'checked';
      
      const response = await checklistAPI.updateUserItemStatus(item.id, newStatus, tripId);
      
      // Update the item in state
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
      
      toast.success(`Item ${newStatus === 'checked' ? 'checked' : 'unchecked'}`);
    } catch (error) {
      console.error('Error updating checklist item status:', error);
      toast.error(error.response?.data?.message || 'Failed to update item status');
    }
  };
  
  const handleToggleSkipStatus = async (checklistId, item) => {
    try {
      // Toggle between skipped and pending
      const newStatus = item.current_user_status === 'skipped' ? 'pending' : 'skipped';
      
      const response = await checklistAPI.updateUserItemStatus(item.id, newStatus, tripId);
      
      // Update the item in state
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
      
      toast.success(`Item ${newStatus === 'skipped' ? t('checklists.skipped') : t('checklists.unskipped')}`);
    } catch (error) {
      console.error('Error updating checklist item status:', error);
      toast.error(error.response?.data?.message || 'Failed to update item status');
    }
  };
  
  const toggleChecklist = async (checklistId) => {
    setExpandedChecklists(prev => ({
      ...prev,
      [checklistId]: !prev[checklistId]
    }));
    
    // Fetch items if expanding and items don't exist yet
    if (!expandedChecklists[checklistId]) {
      const checklist = checklists.find(c => c.id === checklistId);
      if (!checklist.items) {
        await fetchChecklistItems(checklistId);
      }
    }
    
    setSelectedChecklistId(checklistId);
  };
  
  const toggleActionMenu = (id) => {
    setShowActionMenus(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const toggleUserStatusList = (itemId) => {
    setShowUserStatuses(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  // Calculate completion percentage for a checklist
  const getCompletionPercentage = (checklist) => {
    // First check if we have items with completion data
    if (!checklist.items || checklist.items.length === 0) {
      // Fall back to the original calculation if we don't have item-level data
      const total = checklist.total_items || 0;
      if (total === 0) return 0;
      
      const completed = checklist.completed_items || 0;
      const skipped = checklist.skipped_items || 0;
      return Math.round(((completed + skipped) / total) * 100);
    }
    
    // If we have the items array with completion data, calculate based on that
    const totalItems = checklist.items.length;
    if (totalItems === 0) return 0;
    
    // Sum up the completion percentages of all items and average them
    const totalCompletionPercentage = checklist.items.reduce((sum, item) => {
      return sum + (item.completion?.percentage || 0);
    }, 0);
    
    return Math.round(totalCompletionPercentage / totalItems);
  };
  
  if (loading && checklists.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Checklists Column */}
      <div className="md:col-span-1">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">{t('checklists.title')}</h2>
          {canEdit && (
            <Button
              variant="primary"
              size="sm"
              icon={<PlusCircle className="h-4 w-4" />}
              onClick={() => setNewChecklistName('')}
            >
              {t('checklists.add')}
            </Button>
          )}
        </div>
        
        {/* Add New Checklist Form */}
        {canEdit && newChecklistName !== null && (
          <div className="mb-4">
            <form onSubmit={handleCreateChecklist} className="space-y-2">
              <Input
                placeholder="New checklist name"
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                autoFocus
              />
              <div className="flex space-x-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="flex-1"
                >
                  {t('common.create')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setNewChecklistName(null)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        )}
        
        {/* Checklists List */}
        <div className="space-y-3">
          {checklists.length > 0 ? (
            checklists.map(checklist => (
              <div
                key={checklist.id}
                className={`
                  p-3 rounded-lg transition-colors cursor-pointer
                  ${selectedChecklistId === checklist.id 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400' 
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'}
                `}
                onClick={() => toggleChecklist(checklist.id)}
              >
                {editingChecklistId === checklist.id ? (
                  // Edit Checklist Form
                  <div className="space-y-2">
                    <Input
                      value={editingChecklistName}
                      onChange={(e) => setEditingChecklistName(e.target.value)}
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleUpdateChecklist(checklist.id)}
                      >
                        {t('common.save')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCancelEditChecklist}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Checklist Display
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">{checklist.name}</h3>
                      
                      {/* Action Menu */}
                      {canEdit && (
                        <div className="relative ml-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActionMenu(checklist.id);
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </button>
                          
                          {showActionMenus[checklist.id] && (
                            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                              <div className="py-1">
                                <button
                                  type="button"
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditChecklist(checklist);
                                  }}
                                >
                                  <Edit className="h-4 w-4 inline mr-2" />
                                  {t('common.edit')}
                                </button>
                                <button
                                  type="button"
                                  className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteChecklist(checklist.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 inline mr-2" />
                                  {t('common.delete')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Progress Bar - will be calculated differently now */}
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {checklist.items?.filter(item => item.completion && item.completion.is_complete).length || 0} of {checklist.total_items || 0} {t('checklists.complete')}
                        </span>
                        <span>{getCompletionPercentage(checklist)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${getCompletionPercentage(checklist)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <CheckSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                {t('checklists.noChecklists')}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                {t('checklists.noChecklistsMessage')}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Selected Checklist Items Column */}
      <div className="md:col-span-2">
        {selectedChecklistId ? (
          <ChecklistDetail
            checklist={checklists.find(c => c.id === selectedChecklistId)}
            canEdit={canEdit}
            currentUser={user}
            newItemForm={newItemForm}
            setNewItemForm={setNewItemForm}
            handleAddItem={handleAddItem}
            handleCreateItem={handleCreateItem}
            editingItemId={editingItemId}
            editingItemForm={editingItemForm}
            setEditingItemForm={setEditingItemForm}
            handleEditItem={handleEditItem}
            handleUpdateItem={handleUpdateItem}
            handleDeleteItem={handleDeleteItem}
            handleToggleUserStatus={handleToggleUserStatus}
            handleToggleSkipStatus={handleToggleSkipStatus}
            showUserStatuses={showUserStatuses}
            toggleUserStatusList={toggleUserStatusList}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CheckSquare className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('checklists.selectChecklist')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {t('checklists.selectChecklistMessage')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Separate component for checklist items
const ChecklistDetail = ({
  checklist,
  canEdit,
  currentUser,
  newItemForm,
  setNewItemForm,
  handleAddItem,
  handleCreateItem,
  editingItemId,
  editingItemForm,
  setEditingItemForm,
  handleEditItem,
  handleUpdateItem,
  handleDeleteItem,
  handleToggleUserStatus,
  handleToggleSkipStatus,
  showUserStatuses,
  toggleUserStatusList
}) => {
  const [showNotes, setShowNotes] = useState({});
  const { t } = useTranslation();
  
  if (!checklist) return null;
  
  const toggleNote = (itemId) => {
    setShowNotes(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  // Group items by their completion status
  const pendingItems = (checklist.items || []).filter(item => 
    !item.completion?.is_complete && item.current_user_status !== 'checked' && item.current_user_status !== 'skipped'
  );
  
  const userActionedItems = (checklist.items || []).filter(item => 
    !item.completion?.is_complete && (item.current_user_status === 'checked' || item.current_user_status === 'skipped')
  );
  
  const completedItems = (checklist.items || []).filter(item => 
    item.completion?.is_complete
  );
  
  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">{checklist.name}</h2>
        
        {canEdit && (
          <Button
            variant="primary"
            size="sm"
            icon={<PlusCircle className="h-4 w-4" />}
            onClick={() => handleAddItem(checklist.id)}
          >
            {t('checklists.addItem')}
          </Button>
        )}
      </div>
      
      {/* Add New Item Form */}
      {canEdit && newItemForm.checklistId === checklist.id && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form onSubmit={handleCreateItem}>
              <div className="space-y-3">
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
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setNewItemForm({ checklistId: null, description: '', note: '' })}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  {t('checklists.addItem')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      
      {/* Items List */}
      <div className="space-y-6">
        {/* Pending Items - Items that the current user hasn't checked or skipped */}
        {pendingItems.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('checklists.todoItems')}</h3>
            <div className="space-y-2">
              {pendingItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  showNote={showNotes[item.id]}
                  toggleNote={() => toggleNote(item.id)}
                  canEdit={canEdit}
                  isEditing={editingItemId === item.id}
                  editingForm={editingItemForm}
                  setEditingForm={setEditingItemForm}
                  onEdit={() => handleEditItem(item)}
                  onSave={() => handleUpdateItem(checklist.id, item.id)}
                  onDelete={() => handleDeleteItem(checklist.id, item.id)}
                  onToggleStatus={() => handleToggleUserStatus(checklist.id, item)}
                  onToggleSkip={() => handleToggleSkipStatus(checklist.id, item)}
                  currentUser={currentUser}
                  showUserStatuses={showUserStatuses[item.id]}
                  toggleUserStatusList={() => toggleUserStatusList(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Items that the current user has actioned but aren't fully complete */}
        {userActionedItems.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">{t('checklists.actioned')}</h3>
            <div className="space-y-2">
              {userActionedItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  showNote={showNotes[item.id]}
                  toggleNote={() => toggleNote(item.id)}
                  canEdit={canEdit}
                  isEditing={editingItemId === item.id}
                  editingForm={editingItemForm}
                  setEditingForm={setEditingItemForm}
                  onEdit={() => handleEditItem(item)}
                  onSave={() => handleUpdateItem(checklist.id, item.id)}
                  onDelete={() => handleDeleteItem(checklist.id, item.id)}
                  onToggleStatus={() => handleToggleUserStatus(checklist.id, item)}
                  onToggleSkip={() => handleToggleSkipStatus(checklist.id, item)}
                  currentUser={currentUser}
                  showUserStatuses={showUserStatuses[item.id]}
                  toggleUserStatusList={() => toggleUserStatusList(item.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Completed Items - Items that everyone has actioned */}
        {completedItems.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">{t('checklists.completedItems')}</h3>
            <div className="space-y-2">
              {completedItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  showNote={showNotes[item.id]}
                  toggleNote={() => toggleNote(item.id)}
                  canEdit={canEdit}
                  isEditing={editingItemId === item.id}
                  editingForm={editingItemForm}
                  setEditingForm={setEditingItemForm}
                  onEdit={() => handleEditItem(item)}
                  onSave={() => handleUpdateItem(checklist.id, item.id)}
                  onDelete={() => handleDeleteItem(checklist.id, item.id)}
                  onToggleStatus={() => handleToggleUserStatus(checklist.id, item)}
                  onToggleSkip={() => handleToggleSkipStatus(checklist.id, item)}
                  currentUser={currentUser}
                  showUserStatuses={showUserStatuses[item.id]}
                  toggleUserStatusList={() => toggleUserStatusList(item.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Empty state */}
        {!checklist.items || checklist.items.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <CheckSquare className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('checklists.noItems')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('checklists.noItemsMessage')}
            </p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddItem(checklist.id)}
                icon={<PlusCircle className="h-4 w-4" />}
              >
                {t('checklists.addItem')}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Individual item card component
const ItemCard = ({
  item,
  showNote,
  toggleNote,
  canEdit,
  isEditing,
  editingForm,
  setEditingForm,
  onEdit,
  onSave,
  onDelete,
  onToggleStatus,
  onToggleSkip,
  currentUser,
  showUserStatuses,
  toggleUserStatusList
}) => {
  const hasNote = item.note && item.note.trim().length > 0;
  const { t } = useTranslation();
  
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return dayjs(timestamp).fromNow();
  };

  const UserCompletionVisual = ({ item }) => {
    // Only show if we have user statuses
    if (!item.user_statuses || item.user_statuses.length === 0) {
      return null;
    }
    
    // Get users who have checked or skipped the item
    const actioned = item.user_statuses.filter(
      status => status.status === 'checked' || status.status === 'skipped'
    );
    
    // If no one has actioned this item yet, don't show anything
    if (actioned.length === 0) {
      return null;
    }
    
    // Show up to 5 avatars max
    const MAX_AVATARS = 5;
    const displayAvatars = actioned.slice(0, MAX_AVATARS);
    const extraCount = actioned.length > MAX_AVATARS ? actioned.length - MAX_AVATARS : 0;
    
    return (
      <div className="mt-2 flex items-center">
        <div className="flex -space-x-2 mr-2">
          {displayAvatars.map((status, index) => (
            <div 
              key={status.user_id}
              className={`
                h-6 w-6 rounded-full border-2 
                ${status.status === 'checked' 
                  ? 'border-blue-400 bg-white dark:bg-gray-700' 
                  : 'border-yellow-400 bg-white dark:bg-gray-700'}
              `}
              style={{ zIndex: displayAvatars.length - index }}
              title={`${status.name} (${status.status === 'checked' ? 'Completed' : 'Skipped'})`}
            >
              {status.profile_image ? (
                <img 
                  src={getImageUrl(status.profile_image)} 
                  alt={status.name} 
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <User className="h-full w-full p-1 text-gray-500 dark:text-gray-400" />
              )}
            </div>
          ))}
          
          {extraCount > 0 && (
            <div className="h-6 w-6 rounded-full border-2 border-gray-300 bg-gray-200 dark:bg-gray-600 dark:border-gray-500 flex items-center justify-center">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">+{extraCount}</span>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {item.completion?.checked_count > 0 && (
            <span className="mr-2 inline-flex items-center">
              <CheckCircle className="h-3 w-3 text-blue-500 mr-1" />
              {item.completion.checked_count}
            </span>
          )}
          {item.completion?.skipped_count > 0 && (
            <span className="inline-flex items-center">
              <XCircle className="h-3 w-3 text-yellow-500 mr-1" />
              {item.completion.skipped_count}
            </span>
          )}
        </div>
      </div>
    );
  };
  
  // Check if item is fully completed
  const isComplete = item.completion?.is_complete;
  
  // Get the current user's status
  const userStatus = item.current_user_status || 'pending';
  
  // Get item completion percentage
  const completionPercentage = item.completion?.percentage || 0;
  
  if (isEditing) {
    return (
      <Card className="border-l-4 border-blue-500 animate-pulse">
        <CardContent className="p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}>
            <div className="space-y-3">
              <Input
                placeholder="Item description"
                value={editingForm.description}
                onChange={(e) => setEditingForm(prev => ({ ...prev, description: e.target.value }))}
                autoFocus
              />
              <Input
                placeholder="Optional note"
                value={editingForm.note}
                onChange={(e) => setEditingForm(prev => ({ ...prev, note: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onEdit(null)}
                icon={<X className="h-4 w-4" />}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={<Save className="h-4 w-4" />}
              >
                {t('common.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`
      transition-all hover:shadow-md
      ${isComplete ? 'border-l-4 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/20' : ''}
      ${userStatus === 'checked' && !isComplete ? 'border-l-4 border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''}
      ${userStatus === 'skipped' && !isComplete ? 'border-l-4 border-yellow-500 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' : ''}
    `}>
      <CardContent className="p-4">
        <div className="flex justify-between">
          <div className="flex items-start flex-1 min-w-0">
            <div 
              className="flex-shrink-0 mr-3 mt-1 cursor-pointer" 
              onClick={onToggleStatus}
            >
              {userStatus === 'checked' ? (
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : userStatus === 'skipped' ? (
                <XCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div 
                className={`
                  font-medium break-words pr-2
                  ${isComplete ? 'text-green-600 dark:text-green-400' : ''}
                  ${userStatus === 'checked' && !isComplete ? 'text-blue-600 dark:text-blue-400' : ''}
                  ${userStatus === 'skipped' && !isComplete ? 'text-yellow-600 dark:text-yellow-400 italic' : ''}
                `}
              >
                {item.description}
              </div>
              
              {/* Progress bar for multi-user completion */}
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>
                    {Math.round(item.completion?.percentage || 0)}% {t('checklists.complete')}
                  </span>
                  <button 
                    onClick={toggleUserStatusList}
                    className="text-xs flex items-center text-blue-600 dark:text-blue-400"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    {item.completion?.checked_count + item.completion?.skipped_count || 0}/{item.completion?.total_members || 0}
                  </button>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isComplete 
                        ? 'bg-green-500' 
                        : userStatus !== 'pending'
                          ? 'bg-blue-500' 
                          : 'bg-gray-400'
                    }`}
                    style={{ width: `${completionPercentage}%` }}
                  ></div>
                </div>
              </div>

              <UserCompletionVisual item={item} />
              
              {/* User status list - who has checked/skipped the item */}
              {showUserStatuses && item.user_statuses && item.user_statuses.length > 0 && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
                  <div className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">{t('checklists.whoChecked')}</div>
                  <div className="space-y-1">
                    {item.user_statuses.map(status => (
                      <div key={status.user_id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden mr-2">
                            {status.profile_image ? (
                              <img 
                                src={getImageUrl(status.profile_image)} 
                                alt={status.name} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <User className="h-full w-full p-0.5 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>
                          <span className="text-xs">{status.name}</span>
                        </div>
                        <div>
                          {status.status === 'checked' ? (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          ) : status.status === 'skipped' ? (
                            <XCircle className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <Circle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* User and timestamp info */}
              {(item.updated_by_name || hasNote) && (
                <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-2">
                  {item.updated_by_name && (
                    <div className="flex items-center" title={`Last updated by ${item.updated_by_name}`}>
                      <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mr-1">
                        {item.updated_by_image ? (
                          <img 
                            src={getImageUrl(item.updated_by_image)} 
                            alt={item.updated_by_name} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-full w-full p-0.5 text-gray-500 dark:text-gray-400" />
                        )}
                      </div>
                      <span className="truncate max-w-[100px]">{item.updated_by_name}</span>
                    </div>
                  )}
                  
                  {item.updated_at && (
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      <span>{formatDate(item.updated_at)}</span>
                    </div>
                  )}
                  
                  {hasNote && (
                    <button 
                      type="button"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={toggleNote}
                    >
                      {showNote ? 'Hide note' : 'Show note'}
                    </button>
                  )}
                </div>
              )}
              
              {/* Note content */}
              {showNote && hasNote && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">
                  {item.note}
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-start space-x-1 ml-2">
            {/* Skip button */}
            {userStatus !== 'skipped' && (
              <button
                type="button"
                onClick={onToggleSkip}
                className="p-1.5 rounded-full text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                title="Skip this item"
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
            )}
            
            {userStatus === 'skipped' && (
              <button
                type="button"
                onClick={onToggleSkip}
                className="p-1.5 rounded-full text-yellow-500 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Unmark as skipped"
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
            )}
            
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TripChecklist;