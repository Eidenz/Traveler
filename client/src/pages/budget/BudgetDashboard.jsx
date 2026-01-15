// client/src/pages/budget/BudgetDashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, X, Calendar, Plane, Home, Compass, Edit,
  Gift, Coffee, DollarSign, CreditCard, Trash2, ArrowRight,
  Map, Users, User, TrendingUp, TrendingDown, Wallet,
  ChevronLeft, PieChart, Receipt, Sparkles
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { budgetAPI, personalBudgetAPI, tripAPI } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import ExpenseForm from '../../components/budget/ExpenseForm';
import CreateBudgetForm from '../../components/budget/CreateBudgetForm';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';
import { useRealtimeUpdates } from '../../hooks/useRealtimeUpdates';

const BudgetDashboard = () => {
  const { t } = useTranslation();
  const { tripId: urlTripId } = useParams();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCreateBudgetForm, setShowCreateBudgetForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [activeExpenseTab, setActiveExpenseTab] = useState('all');
  const [activeBudgetTab, setActiveBudgetTab] = useState('shared');

  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('budgetPanelWidth');
    return saved ? parseInt(saved, 10) : 420;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const MIN_PANEL_WIDTH = 380;
  const MAX_PANEL_WIDTH = 600;

  // State for shared budget
  const [sharedBudget, setSharedBudget] = useState(null);
  const [sharedExpenses, setSharedExpenses] = useState([]);
  const [sharedCategoryTotals, setSharedCategoryTotals] = useState({});
  const [sharedTotalSpent, setSharedTotalSpent] = useState(0);

  // State for personal budget
  const [personalBudget, setPersonalBudget] = useState(null);
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [personalCategoryTotals, setPersonalCategoryTotals] = useState({});
  const [personalTotalSpent, setPersonalTotalSpent] = useState(0);

  // Fetch trips
  const fetchTrips = useCallback(async () => {
    try {
      const response = await tripAPI.getUserTrips();
      if (response.data.trips) {
        setTrips(response.data.trips);
        // Auto-select if only one trip and no URL param
        if (response.data.trips.length === 1 && !urlTripId) {
          setSelectedTrip(response.data.trips[0]);
          navigate(`/budgets/${response.data.trips[0].id}`, { replace: true });
        }
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error(t('errors.failedFetch'));
    } finally {
      setLoading(false);
    }
  }, [urlTripId, navigate, t]);

  // Fetch trips on mount
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Handle URL-based trip selection
  useEffect(() => {
    if (urlTripId && trips.length > 0) {
      const trip = trips.find(t => t.id === urlTripId);
      if (trip) {
        setSelectedTrip(trip);
      } else {
        toast.error(t('errors.tripNotFound', 'Trip not found'));
        navigate('/budgets');
      }
    }
  }, [urlTripId, trips, t, navigate]);

  const fetchSharedBudget = useCallback(async (tripId) => {
    try {
      const response = await budgetAPI.getTripBudget(tripId);
      setSharedBudget(response.data.budget);
      setSharedExpenses(response.data.expenses || []);
      setSharedCategoryTotals(response.data.categoryTotals || {});
      setSharedTotalSpent(response.data.totalSpent || 0);
    } catch (error) {
      console.error('Error fetching shared budget:', error);
    }
  }, []);

  const fetchPersonalBudget = useCallback(async (tripId) => {
    try {
      const response = await personalBudgetAPI.getTripBudget(tripId);
      setPersonalBudget(response.data.budget);
      setPersonalExpenses(response.data.expenses || []);
      setPersonalCategoryTotals(response.data.categoryTotals || {});
      setPersonalTotalSpent(response.data.totalSpent || 0);
    } catch (error) {
      console.error('Error fetching personal budget:', error);
    }
  }, []);

  // Fetch budgets when trip is selected
  useEffect(() => {
    if (selectedTrip?.id) {
      fetchSharedBudget(selectedTrip.id);
      fetchPersonalBudget(selectedTrip.id);
    }
  }, [selectedTrip?.id, fetchSharedBudget, fetchPersonalBudget]);

  // Real-time budget updates - refetch when budget or expense events are received
  const handleBudgetChange = useCallback(() => {
    if (selectedTrip?.id) {
      fetchSharedBudget(selectedTrip.id);
    }
  }, [selectedTrip?.id, fetchSharedBudget]);

  useRealtimeUpdates(selectedTrip?.id, {
    onBudgetCreate: handleBudgetChange,
    onBudgetUpdate: handleBudgetChange,
    onBudgetDelete: handleBudgetChange,
    onExpenseCreate: handleBudgetChange,
    onExpenseUpdate: handleBudgetChange,
    onExpenseDelete: handleBudgetChange,
  });

  // Panel resize handlers
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const clampedWidth = Math.min(Math.max(newWidth, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
    setPanelWidth(clampedWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem('budgetPanelWidth', panelWidth.toString());
    }
  }, [isResizing, panelWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const canEditShared = selectedTrip?.role === 'owner' || selectedTrip?.role === 'editor';

  const currentData = activeBudgetTab === 'shared'
    ? { budget: sharedBudget, expenses: sharedExpenses, categoryTotals: sharedCategoryTotals, totalSpent: sharedTotalSpent, canEdit: canEditShared }
    : { budget: personalBudget, expenses: personalExpenses, categoryTotals: personalCategoryTotals, totalSpent: personalTotalSpent, canEdit: true };

  const selectTrip = (trip) => {
    setSelectedTrip(trip);
    navigate(`/budgets/${trip.id}`);
  };

  // Budget CRUD handlers
  const handleCreateBudget = async (budgetData) => {
    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.createBudget(selectedTrip.id, budgetData)
      : personalBudgetAPI.createBudget(selectedTrip.id, budgetData);

    try {
      const response = await apiCall;
      if (activeBudgetTab === 'shared') {
        setSharedBudget(response.data.budget);
      } else {
        setPersonalBudget(response.data.budget);
      }
      setShowCreateBudgetForm(false);
      toast.success(t('budget.budgetCreated'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    }
  };

  const handleUpdateBudget = async (budgetData) => {
    const budget = activeBudgetTab === 'shared' ? sharedBudget : personalBudget;
    if (!budget) return;

    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.updateBudget(budget.id, budgetData, selectedTrip.id)
      : personalBudgetAPI.updateBudget(budget.id, budgetData);

    try {
      const response = await apiCall;
      if (activeBudgetTab === 'shared') {
        setSharedBudget(response.data.budget);
      } else {
        setPersonalBudget(response.data.budget);
      }
      setShowCreateBudgetForm(false);
      toast.success(t('budget.budgetUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    }
  };

  const handleDeleteBudget = async () => {
    const budget = activeBudgetTab === 'shared' ? sharedBudget : personalBudget;
    if (!budget) return;

    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.deleteBudget(budget.id, selectedTrip.id)
      : personalBudgetAPI.deleteBudget(budget.id);

    try {
      await apiCall;
      if (activeBudgetTab === 'shared') {
        setSharedBudget(null);
        setSharedExpenses([]);
        setSharedCategoryTotals({});
        setSharedTotalSpent(0);
      } else {
        setPersonalBudget(null);
        setPersonalExpenses([]);
        setPersonalCategoryTotals({});
        setPersonalTotalSpent(0);
      }
      setShowDeleteModal(false);
      toast.success(t('budget.budgetDeleted'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.deleteFailed'));
    }
  };

  const handleAddExpense = async (expenseData) => {
    const budget = activeBudgetTab === 'shared' ? sharedBudget : personalBudget;
    if (!budget) return;

    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.addExpense(budget.id, expenseData, selectedTrip.id)
      : personalBudgetAPI.addExpense(budget.id, expenseData);

    try {
      await apiCall;
      if (activeBudgetTab === 'shared') {
        fetchSharedBudget(selectedTrip.id);
      } else {
        fetchPersonalBudget(selectedTrip.id);
      }
      setShowExpenseForm(false);
      toast.success(t('budget.expenseAdded'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    }
  };

  const handleUpdateExpense = async (expenseData) => {
    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.updateExpense(selectedExpense.id, expenseData, selectedTrip.id)
      : personalBudgetAPI.updateExpense(selectedExpense.id, expenseData);

    try {
      await apiCall;
      if (activeBudgetTab === 'shared') {
        fetchSharedBudget(selectedTrip.id);
      } else {
        fetchPersonalBudget(selectedTrip.id);
      }
      setShowExpenseForm(false);
      setSelectedExpense(null);
      toast.success(t('budget.expenseUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.saveFailed'));
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.deleteExpense(expenseId, selectedTrip.id)
      : personalBudgetAPI.deleteExpense(expenseId);

    try {
      await apiCall;
      if (activeBudgetTab === 'shared') {
        fetchSharedBudget(selectedTrip.id);
      } else {
        fetchPersonalBudget(selectedTrip.id);
      }
      toast.success(t('budget.expenseDeleted'));
    } catch (error) {
      toast.error(error.response?.data?.message || t('errors.deleteFailed'));
    }
  };

  const editExpense = (expense) => {
    setSelectedExpense(expense);
    setShowExpenseForm(true);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      transport: <Plane className="w-5 h-5" />,
      lodging: <Home className="w-5 h-5" />,
      activities: <Compass className="w-5 h-5" />,
      food: <Coffee className="w-5 h-5" />,
      other: <Gift className="w-5 h-5" />,
    };
    return icons[category] || <CreditCard className="w-5 h-5" />;
  };

  const getCategoryStyle = (category) => {
    const styles = {
      transport: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', color: '#3b82f6' },
      lodging: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', color: '#10b981' },
      activities: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', color: '#8b5cf6' },
      food: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', color: '#f97316' },
      other: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', color: '#ec4899' },
    };
    return styles[category] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700', color: '#6b7280' };
  };

  const filteredExpenses = activeExpenseTab === 'all'
    ? currentData.expenses
    : currentData.expenses.filter(expense => expense.category === activeExpenseTab);

  // Get trip status for badge
  const getTripStatus = () => {
    if (!selectedTrip) return 'draft';
    const now = dayjs();
    const start = dayjs(selectedTrip.start_date);
    const end = dayjs(selectedTrip.end_date);
    if (now.isBefore(start)) return 'upcoming';
    if (now.isAfter(end)) return 'completed';
    return 'active';
  };

  // Loading state
  if (loading && !trips.length) {
    return (
      <div className="h-full flex items-center justify-center page-transition">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No trips state
  if (!trips.length) {
    return (
      <div className="h-full flex items-center justify-center p-4 page-transition">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-soft flex items-center justify-center">
            <Wallet className="w-10 h-10 text-accent" />
          </div>
          <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-white mb-2">
            {t('budget.title', 'Trip Budget')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t('budget.noTripsMessage', 'Create a trip first to start tracking your budget')}
          </p>
          <Link to="/trips/new">
            <Button icon={<Plus className="w-5 h-5" />}>
              {t('trips.createTrip', 'Create trip')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Trip selection state (when no URL param and multiple trips)
  if (!selectedTrip && !urlTripId && trips.length > 1) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar page-transition">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
                <Wallet className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
                  {t('budget.selectTripForBudget', 'Select a trip')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('budget.selectTripDescription', 'Choose which trip budget to manage')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map(trip => (
              <button
                key={trip.id}
                onClick={() => selectTrip(trip)}
                className="group text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="h-40 relative">
                  <img
                    src={trip.cover_image ? getImageUrl(trip.cover_image) : getFallbackImageUrl('trip')}
                    alt={trip.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4">
                    <h2 className="text-lg font-display font-semibold text-white">{trip.name}</h2>
                    <div className="flex items-center text-white/80 text-sm mt-1">
                      <Calendar className="w-4 h-4 mr-1.5" />
                      {dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D')}
                    </div>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center text-gray-500 dark:text-gray-400">
                    <Map className="w-4 h-4 mr-1.5" />
                    <span className="text-sm">{trip.location || t('common.noLocation', 'No location')}</span>
                  </div>
                  <span className="text-accent font-medium text-sm flex items-center group-hover:underline">
                    {t('budget.manage', 'Manage budget')}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Main budget view - Split layout
  const budgetPercentUsed = currentData.budget
    ? (currentData.totalSpent / currentData.budget.total_amount) * 100
    : 0;
  const isOverBudget = budgetPercentUsed > 100;
  const isNearLimit = budgetPercentUsed > 80 && !isOverBudget;

  return (
    <>
      {/* Mobile layout */}
      <div className="md:hidden h-full flex flex-col overflow-hidden page-transition">
        {/* Mobile Header */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to={`/trips/${selectedTrip?.id}`}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-display font-semibold text-gray-900 dark:text-white truncate">
                  {selectedTrip?.name}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('budget.title', 'Budget')}
                </p>
              </div>
            </div>
            {currentData.budget && currentData.canEdit && (
              <Button
                size="sm"
                onClick={() => { setSelectedExpense(null); setShowExpenseForm(true); }}
                icon={<Plus className="w-4 h-4" />}
              >
                {t('budget.add', 'Add')}
              </Button>
            )}
          </div>

          {/* Budget type tabs - mobile */}
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => setActiveBudgetTab('shared')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeBudgetTab === 'shared'
                ? 'bg-nav dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
            >
              <Users className="w-4 h-4" />
              {t('budget.shared', 'Shared')}
            </button>
            <button
              onClick={() => setActiveBudgetTab('personal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeBudgetTab === 'personal'
                ? 'bg-nav dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
            >
              <User className="w-4 h-4" />
              {t('budget.personal', 'Personal')}
            </button>
          </div>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-900">
          {!currentData.budget ? (
            <div className="p-6 flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 mb-4 rounded-full bg-accent-soft flex items-center justify-center">
                <Wallet className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-xl font-display font-medium text-gray-900 dark:text-white mb-2 text-center">
                {t('budget.setupBudget', 'Set up your budget')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-xs">
                {activeBudgetTab === 'shared' && !canEditShared
                  ? t('budget.onlyEditorsCanCreate', 'Only trip editors can create a shared budget')
                  : t('budget.setupBudgetMessage', 'Track your travel expenses and stay on top of your spending')
                }
              </p>
              <Button
                onClick={() => setShowCreateBudgetForm(true)}
                disabled={activeBudgetTab === 'shared' && !canEditShared}
                icon={<Plus className="w-5 h-5" />}
              >
                {t('budget.createBudgetButton', 'Create budget')}
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Budget summary card - mobile */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('budget.remaining', 'Remaining')}
                  </span>
                  <button
                    onClick={() => setShowCreateBudgetForm(true)}
                    className="text-sm text-accent font-medium"
                  >
                    {t('common.edit', 'Edit')}
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className={`text-3xl font-display font-bold ${isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                    {currentData.budget.currency}
                    {Math.abs(currentData.budget.total_amount - currentData.totalSpent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {isOverBudget && <TrendingDown className="w-5 h-5 text-red-500" />}
                </div>
                <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-accent'
                      }`}
                    style={{ width: `${Math.min(budgetPercentUsed, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {currentData.budget.currency}{currentData.totalSpent.toLocaleString()} {t('budget.spent', 'spent')}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {currentData.budget.currency}{currentData.budget.total_amount.toLocaleString()} {t('budget.total', 'total')}
                  </span>
                </div>
              </div>

              {/* Category breakdown - mobile */}
              <div className="grid grid-cols-3 gap-2">
                {['transport', 'lodging', 'activities', 'food', 'other'].slice(0, 3).map(category => {
                  const style = getCategoryStyle(category);
                  return (
                    <div key={category} className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
                      <div className={`w-8 h-8 mx-auto mb-1.5 rounded-lg ${style.bg} ${style.text} flex items-center justify-center`}>
                        {getCategoryIcon(category)}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                        {t(`budget.${category}`, category)}
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {currentData.budget.currency}{(currentData.categoryTotals[category] || 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Expenses list - mobile */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="font-display font-medium text-gray-900 dark:text-white">
                    {t('budget.recentExpenses', 'Recent expenses')}
                  </h2>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredExpenses.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                      {t('budget.noExpenses', 'No expenses yet')}
                    </div>
                  ) : (
                    filteredExpenses.slice(0, 5).map(expense => {
                      const style = getCategoryStyle(expense.category);
                      return (
                        <div
                          key={expense.id}
                          className="flex items-center gap-3 p-4"
                          onClick={() => currentData.canEdit && editExpense(expense)}
                        >
                          <div className={`w-10 h-10 rounded-xl ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0`}>
                            {getCategoryIcon(expense.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {expense.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {dayjs(expense.date).format('MMM D')}
                            </p>
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {currentData.budget.currency}{parseFloat(expense.amount).toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop layout - Split view */}
      <div ref={containerRef} className="hidden md:flex h-full overflow-hidden page-transition">
        {/* Left Panel - Trip context */}
        <div
          className="bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col flex-shrink-0"
          style={{ width: `${panelWidth}px` }}
        >
          {/* Back to trip link */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <Link
              to={`/trips/${selectedTrip?.id}`}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('budget.backToTrip', 'Back to trip')}
            </Link>
          </div>

          {/* Trip mini header */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                <img
                  src={selectedTrip?.cover_image ? getImageUrl(selectedTrip.cover_image) : getFallbackImageUrl('trip')}
                  alt={selectedTrip?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-display font-semibold text-gray-900 dark:text-white truncate">
                  {selectedTrip?.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {dayjs(selectedTrip?.start_date).format('MMM D')} - {dayjs(selectedTrip?.end_date).format('MMM D, YYYY')}
                  </span>
                  <StatusBadge status={getTripStatus()} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Budget type tabs */}
          <div className="flex gap-2 p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <button
              onClick={() => setActiveBudgetTab('shared')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${activeBudgetTab === 'shared'
                ? 'bg-nav dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              <Users className="w-4 h-4" />
              {t('budget.shared', 'Shared')}
            </button>
            <button
              onClick={() => setActiveBudgetTab('personal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${activeBudgetTab === 'personal'
                ? 'bg-nav dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              <User className="w-4 h-4" />
              {t('budget.personal', 'Personal')}
            </button>
          </div>

          {/* Budget overview in left panel */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!currentData.budget ? (
              <div className="p-6 flex flex-col items-center justify-center h-full">
                <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-accent/20 to-rose-100 dark:from-accent/30 dark:to-rose-900/30 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-xl font-display font-medium text-gray-900 dark:text-white mb-2 text-center">
                  {t('budget.setupBudget', 'Set up your budget')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6 text-center text-sm max-w-xs">
                  {activeBudgetTab === 'shared' && !canEditShared
                    ? t('budget.onlyEditorsCanCreate', 'Only trip editors can create a shared budget')
                    : t('budget.setupBudgetMessage', 'Track your travel expenses and stay on top of your spending')
                  }
                </p>
                <Button
                  onClick={() => setShowCreateBudgetForm(true)}
                  disabled={activeBudgetTab === 'shared' && !canEditShared}
                  icon={<Plus className="w-5 h-5" />}
                >
                  {t('budget.createBudgetButton', 'Create budget')}
                </Button>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Main budget display */}
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {t('budget.remaining', 'Remaining')}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-4xl font-display font-bold ${isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                      {currentData.budget.currency}
                      {Math.abs(currentData.budget.total_amount - currentData.totalSpent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {isOverBudget && <TrendingDown className="w-6 h-6 text-red-500" />}
                  </div>
                  {isOverBudget && (
                    <p className="text-sm text-red-500 mt-1">
                      {t('budget.overBudgetBy', 'Over budget')}
                    </p>
                  )}
                </div>

                {/* Visual progress */}
                <div>
                  <div className="relative h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${isOverBudget ? 'bg-gradient-to-r from-red-400 to-red-500' :
                        isNearLimit ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                          'bg-gradient-to-r from-accent to-rose-400'
                        }`}
                      style={{ width: `${Math.min(budgetPercentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {currentData.budget.currency}{currentData.totalSpent.toLocaleString()} spent
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {Math.round(budgetPercentUsed)}%
                    </span>
                  </div>
                </div>

                {/* Category breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                    {t('budget.byCategory', 'By category')}
                  </h3>
                  <div className="space-y-2">
                    {['transport', 'lodging', 'activities', 'food', 'other'].map(category => {
                      const style = getCategoryStyle(category);
                      const amount = currentData.categoryTotals[category] || 0;
                      const percent = currentData.totalSpent > 0 ? (amount / currentData.totalSpent) * 100 : 0;

                      return (
                        <div key={category} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0`}>
                            {React.cloneElement(getCategoryIcon(category), { className: 'w-4 h-4' })}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                                {t(`budget.${category}`, category)}
                              </span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {currentData.budget.currency}{amount.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${percent}%`, backgroundColor: style.color }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Budget actions */}
                {currentData.canEdit && (
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => { setSelectedExpense(null); setShowExpenseForm(true); }}
                      icon={<Plus className="w-4 h-4" />}
                    >
                      {t('budget.addExpense', 'Add expense')}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        size="sm"
                        onClick={() => setShowCreateBudgetForm(true)}
                      >
                        {t('budget.editBudget', 'Edit budget')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteModal(true)}
                        icon={<Trash2 className="w-4 h-4" />}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Change trip link */}
          {trips.length > 1 && (
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={() => navigate('/budgets')}
                className="w-full text-center text-sm text-gray-500 hover:text-accent dark:text-gray-400 transition-colors"
              >
                {t('budget.switchTrip', 'Switch to another trip')}
              </button>
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-accent hover:w-1.5 cursor-col-resize transition-all duration-150 flex-shrink-0 group relative"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full bg-gray-400 dark:bg-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Right Panel - Expenses */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900">
          {/* Right panel header */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white">
                    {t('budget.allExpenses', 'All expenses')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentData.expenses.length} {currentData.expenses.length === 1 ? t('budget.expense', 'expense') : t('budget.expenses', 'expenses')}
                  </p>
                </div>
              </div>
            </div>

            {/* Category filter pills */}
            {currentData.budget && (
              <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
                {['all', 'transport', 'lodging', 'activities', 'food', 'other'].map(tab => {
                  const isActive = activeExpenseTab === tab;
                  const style = tab === 'all' ? null : getCategoryStyle(tab);

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveExpenseTab(tab)}
                      className={`
                        px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                        ${isActive
                          ? tab === 'all'
                            ? 'bg-nav dark:bg-white text-white dark:text-gray-900'
                            : `${style.bg} ${style.text} ring-2 ring-current`
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      {tab === 'all' ? t('common.all', 'All') : t(`budget.${tab}`, tab)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expenses list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {!currentData.budget ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <PieChart className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-700" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {t('budget.createBudgetFirst', 'Create a budget to start tracking expenses')}
                  </p>
                </div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-700" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {activeExpenseTab === 'all'
                      ? t('budget.noExpenses', 'No expenses yet')
                      : t('budget.noExpensesInCategory', 'No expenses in this category')
                    }
                  </p>
                  {currentData.canEdit && (
                    <Button
                      size="sm"
                      onClick={() => { setSelectedExpense(null); setShowExpenseForm(true); }}
                      icon={<Plus className="w-4 h-4" />}
                    >
                      {t('budget.addFirst', 'Add your first expense')}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredExpenses.map(expense => {
                  const style = getCategoryStyle(expense.category);
                  return (
                    <div
                      key={expense.id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                      onClick={() => currentData.canEdit && editExpense(expense)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0`}>
                          {getCategoryIcon(expense.category)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900 dark:text-white truncate pr-4">
                              {expense.name}
                            </p>
                            <p className="font-semibold text-gray-900 dark:text-white flex-shrink-0">
                              {currentData.budget.currency}{parseFloat(expense.amount).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {dayjs(expense.date).format('MMM D, YYYY')} • {t(`budget.${expense.category}`, expense.category)}
                            </p>
                            {currentData.canEdit && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); editExpense(expense); }}
                                  className="p-1.5 text-gray-400 hover:text-accent rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense.id); }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {expense.notes && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 pl-16">
                          {expense.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ExpenseForm
        isOpen={showExpenseForm}
        onClose={() => { setShowExpenseForm(false); setSelectedExpense(null); }}
        onSubmit={selectedExpense ? handleUpdateExpense : handleAddExpense}
        expense={selectedExpense}
        currency={currentData.budget?.currency || '$'}
      />

      <CreateBudgetForm
        isOpen={showCreateBudgetForm}
        onClose={() => setShowCreateBudgetForm(false)}
        onSubmit={currentData.budget ? handleUpdateBudget : handleCreateBudget}
        budget={currentData.budget}
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('budget.deleteBudget', 'Delete Budget')}
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('budget.deleteConfirmation', 'Are you sure you want to delete this budget? All expenses will be removed.')}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="danger" onClick={handleDeleteBudget} icon={<Trash2 className="w-4 h-4" />}>
              {t('common.delete', 'Delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BudgetDashboard;
