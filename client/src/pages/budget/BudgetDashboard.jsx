// client/src/pages/budget/BudgetDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Plus, X, Calendar, Plane, Home, Compass, Edit,
  Gift, Coffee, DollarSign, CreditCard, Trash2, ArrowRight,
  Map, Users, User, TrendingUp, TrendingDown, Wallet
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import { budgetAPI, personalBudgetAPI, tripAPI } from '../../services/api';
import useAuthStore from '../../stores/authStore';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import ExpenseForm from '../../components/budget/ExpenseForm';
import CreateBudgetForm from '../../components/budget/CreateBudgetForm';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';

const BudgetDashboard = () => {
  const { t } = useTranslation();
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [hasExplicitlySelected, setHasExplicitlySelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCreateBudgetForm, setShowCreateBudgetForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [activeExpenseTab, setActiveExpenseTab] = useState('all');
  const [activeBudgetTab, setActiveBudgetTab] = useState('shared');

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

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await tripAPI.getUserTrips();
        if (response.data.trips && response.data.trips.length > 0) {
          setTrips(response.data.trips);
          if (response.data.trips.length === 1) {
            setSelectedTrip(response.data.trips[0]);
            setHasExplicitlySelected(true);
          }
        }
      } catch (error) {
        console.error('Error fetching trips:', error);
        toast.error(t('errors.failedFetch'));
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, [t]);

  useEffect(() => {
    if (selectedTrip?.id && hasExplicitlySelected) {
      fetchSharedBudget(selectedTrip.id);
      fetchPersonalBudget(selectedTrip.id);
    }
  }, [selectedTrip?.id, hasExplicitlySelected]);

  const fetchSharedBudget = async (tripId) => {
    try {
      setLoading(true);
      const response = await budgetAPI.getTripBudget(tripId);
      setSharedBudget(response.data.budget);
      setSharedExpenses(response.data.expenses || []);
      setSharedCategoryTotals(response.data.categoryTotals || {});
      setSharedTotalSpent(response.data.totalSpent || 0);
    } catch (error) {
      console.error('Error fetching shared budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonalBudget = async (tripId) => {
    try {
      const response = await personalBudgetAPI.getTripBudget(tripId);
      setPersonalBudget(response.data.budget);
      setPersonalExpenses(response.data.expenses || []);
      setPersonalCategoryTotals(response.data.categoryTotals || {});
      setPersonalTotalSpent(response.data.totalSpent || 0);
    } catch (error) {
      console.error('Error fetching personal budget:', error);
    }
  };

  const canEditShared = selectedTrip?.role === 'owner' || selectedTrip?.role === 'editor';

  const currentData = activeBudgetTab === 'shared' 
    ? { budget: sharedBudget, expenses: sharedExpenses, categoryTotals: sharedCategoryTotals, totalSpent: sharedTotalSpent, canEdit: canEditShared }
    : { budget: personalBudget, expenses: personalExpenses, categoryTotals: personalCategoryTotals, totalSpent: personalTotalSpent, canEdit: true };

  const selectTrip = (trip) => {
    setSelectedTrip(trip);
    setHasExplicitlySelected(true);
  };

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
    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.updateBudget(selectedTrip.id, budgetData)
      : personalBudgetAPI.updateBudget(selectedTrip.id, budgetData);

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
    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.deleteBudget(selectedTrip.id)
      : personalBudgetAPI.deleteBudget(selectedTrip.id);

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
    const apiCall = activeBudgetTab === 'shared'
      ? budgetAPI.addExpense(selectedTrip.id, expenseData)
      : personalBudgetAPI.addExpense(selectedTrip.id, expenseData);

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
      ? budgetAPI.updateExpense(selectedTrip.id, selectedExpense.id, expenseData)
      : personalBudgetAPI.updateExpense(selectedTrip.id, selectedExpense.id, expenseData);

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
      ? budgetAPI.deleteExpense(selectedTrip.id, expenseId)
      : personalBudgetAPI.deleteExpense(selectedTrip.id, expenseId);

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
      transport: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
      lodging: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
      activities: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' },
      food: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
      other: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
    };
    return styles[category] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' };
  };

  const filteredExpenses = activeExpenseTab === 'all' 
    ? currentData.expenses 
    : currentData.expenses.filter(expense => expense.category === activeExpenseTab);

  // Loading state
  if (loading && !trips.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No trips state
  if (!trips.length) {
    return (
      <div className="h-full flex items-center justify-center p-4">
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

  // Trip selection state
  if (!hasExplicitlySelected && trips.length > 1) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
              {t('budget.selectTripForBudget', 'Select a trip')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('budget.selectTripDescription', 'Choose which trip budget to manage')}
            </p>
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
                    {t('budget.selectTrip', 'Select')}
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

  // Main budget view
  const budgetPercentUsed = currentData.budget 
    ? (currentData.totalSpent / currentData.budget.total_amount) * 100 
    : 0;
  const isOverBudget = budgetPercentUsed > 100;
  const isNearLimit = budgetPercentUsed > 80 && !isOverBudget;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button 
              onClick={() => setHasExplicitlySelected(false)}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('budget.backToSelection', 'Back to trips')}
            </button>
            <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
              {selectedTrip.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {dayjs(selectedTrip.start_date).format('MMM D')} - {dayjs(selectedTrip.end_date).format('MMM D, YYYY')}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {currentData.budget && currentData.canEdit && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowCreateBudgetForm(true)}>
                  {t('budget.update', 'Update')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(true)} icon={<Trash2 className="w-4 h-4" />}>
                  {t('budget.delete', 'Delete')}
                </Button>
                <Button size="sm" onClick={() => { setSelectedExpense(null); setShowExpenseForm(true); }} icon={<Plus className="w-4 h-4" />}>
                  {t('budget.addExpense', 'Add expense')}
                </Button>
              </>
            )}
            <Link to={`/trips/${selectedTrip.id}`}>
              <Button variant="ghost" size="sm">
                {t('trips.viewDetails', 'View trip')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Budget type tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveBudgetTab('shared')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeBudgetTab === 'shared' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            <Users className="w-4 h-4" />
            {t('budget.shared', 'Shared')}
          </button>
          <button
            onClick={() => setActiveBudgetTab('personal')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeBudgetTab === 'personal' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            <User className="w-4 h-4" />
            {t('budget.personal', 'Personal')}
          </button>
        </div>

        {/* Budget content */}
        {loading && !currentData.budget ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !currentData.budget ? (
          /* No budget state */
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent-soft flex items-center justify-center">
              <Wallet className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-display font-medium text-gray-900 dark:text-white mb-2">
              {t('budget.setupBudget', 'Set up your budget')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
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
          <div className="space-y-6">
            {/* Budget overview card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                {/* Main stats */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {t('budget.remaining', 'Remaining')}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-display font-bold ${isOverBudget ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                        {currentData.budget.currency}
                        {Math.abs(currentData.budget.total_amount - currentData.totalSpent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {isOverBudget && (
                        <span className="text-sm text-red-500 flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          {t('budget.overBudget', 'over budget')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('budget.total', 'Total')}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {currentData.budget.currency}{currentData.budget.total_amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('budget.spent', 'Spent')}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {currentData.budget.currency}{currentData.totalSpent.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-accent'
                    }`}
                    style={{ width: `${Math.min(budgetPercentUsed, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>{Math.round(budgetPercentUsed)}% {t('budget.used', 'used')}</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-px bg-gray-100 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-700">
                {['transport', 'lodging', 'activities', 'food', 'other'].map(category => {
                  const style = getCategoryStyle(category);
                  return (
                    <div key={category} className="bg-white dark:bg-gray-800 p-4 text-center">
                      <div className={`w-10 h-10 mx-auto mb-2 rounded-xl ${style.bg} ${style.text} flex items-center justify-center`}>
                        {getCategoryIcon(category)}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mb-1">
                        {t(`budget.${category}`, category)}
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {currentData.budget.currency}{(currentData.categoryTotals[category] || 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expenses section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white mb-4">
                  {t('budget.allExpenses', 'All expenses')}
                </h2>
                
                {/* Category filter pills */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
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
              </div>

              {/* Expenses list */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredExpenses.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    {t('budget.noExpenses', 'No expenses yet')}
                  </div>
                ) : (
                  filteredExpenses.map(expense => {
                    const style = getCategoryStyle(expense.category);
                    return (
                      <div 
                        key={expense.id} 
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className={`w-12 h-12 rounded-xl ${style.bg} ${style.text} flex items-center justify-center flex-shrink-0`}>
                          {getCategoryIcon(expense.category)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {expense.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dayjs(expense.date).format('MMM D, YYYY')}
                          </p>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {currentData.budget.currency}{parseFloat(expense.amount).toFixed(2)}
                          </p>
                        </div>
                        
                        {currentData.canEdit && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => editExpense(expense)}
                              className="p-2 text-gray-400 hover:text-accent rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
};

export default BudgetDashboard;
