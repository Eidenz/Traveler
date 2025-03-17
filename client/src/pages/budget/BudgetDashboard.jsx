// client/src/pages/budget/BudgetDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  Plus,
  X,
  Calendar,
  Plane,
  Home,
  Compass,
  Edit,
  Gift,
  Coffee,
  DollarSign,
  CreditCard,
  Trash2,
  ArrowRight,
  Map
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { budgetAPI, tripAPI } from '../../services/api';
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
  const [budget, setBudget] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState({});
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCreateBudgetForm, setShowCreateBudgetForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    // Fetch user's trips
    const fetchTrips = async () => {
      try {
        const response = await tripAPI.getUserTrips();
        if (response.data.trips && response.data.trips.length > 0) {
          setTrips(response.data.trips);
          
          // If there's only one trip, automatically select it
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

  // Fetch budget when selected trip changes
  useEffect(() => {
    if (selectedTrip && hasExplicitlySelected) {
      fetchBudget(selectedTrip.id);
    }
  }, [selectedTrip, hasExplicitlySelected]);

  const fetchBudget = async (tripId) => {
    try {
      setLoading(true);
      const response = await budgetAPI.getTripBudget(tripId);
      
      setBudget(response.data.budget);
      setExpenses(response.data.expenses || []);
      setCategoryTotals(response.data.categoryTotals || {});
      setTotalSpent(response.data.totalSpent || 0);
    } catch (error) {
      console.error('Error fetching budget:', error);
      toast.error(t('errors.failedFetch'));
    } finally {
      setLoading(false);
    }
  };

  const selectTrip = (trip) => {
    setSelectedTrip(trip);
    setHasExplicitlySelected(true);
    setShowTripSelector(false);
  };

  const handleCreateBudget = async (budgetData) => {
    try {
      const response = await budgetAPI.createBudget(selectedTrip.id, budgetData);
      setBudget(response.data.budget);
      setShowCreateBudgetForm(false);
      toast.success(t('budget.budgetCreated'));
      
      // Refresh budget data
      await fetchBudget(selectedTrip.id);
    } catch (error) {
      console.error('Error creating budget:', error);
      if (error.response?.data?.message === 'Budget already exists for this trip') {
        toast.error(t('budget.budgetExists'));
      } else {
        toast.error(t('errors.saveFailed', { item: t('budget.title').toLowerCase() }));
      }
    }
  };

  const handleUpdateBudget = async (budgetData) => {
    try {
      const response = await budgetAPI.updateBudget(budget.id, budgetData);
      setBudget(response.data.budget);
      setShowCreateBudgetForm(false);
      toast.success(t('budget.budgetUpdated'));
      
      // Refresh budget data
      await fetchBudget(selectedTrip.id);
    } catch (error) {
      console.error('Error updating budget:', error);
      toast.error(t('errors.saveFailed', { item: t('budget.title').toLowerCase() }));
    }
  };

  const handleDeleteBudget = async () => {
    try {
      await budgetAPI.deleteBudget(budget.id, selectedTrip.id);
      toast.success(t('budget.budgetDeleted'));
      setBudget(null);
      setExpenses([]);
      setCategoryTotals({});
      setTotalSpent(0);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast.error(t('errors.deleteFailed', { item: t('budget.title').toLowerCase() }));
    }
  };

  const handleAddExpense = async (expenseData) => {
    try {
      const response = await budgetAPI.addExpense(budget.id, {
        ...expenseData,
        trip_id: selectedTrip.id // Include tripId for authorization middleware
      });
      
      // Add the new expense to the list
      setExpenses([response.data.expense, ...expenses]);
      
      // Update total spent
      setTotalSpent(response.data.totalSpent);
      
      // Update category totals
      const category = expenseData.category;
      setCategoryTotals({
        ...categoryTotals,
        [category]: (categoryTotals[category] || 0) + expenseData.amount
      });
      
      setShowExpenseForm(false);
      toast.success(t('budget.expenseAdded'));
      
      // Refresh budget data for accurate calculations
      await fetchBudget(selectedTrip.id);
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error(t('errors.saveFailed', { item: t('budget.addExpense').toLowerCase() }));
    }
  };

  const handleUpdateExpense = async (expenseData) => {
    try {
      const response = await budgetAPI.updateExpense(selectedExpense.id, {
        ...expenseData,
        trip_id: selectedTrip.id // Include tripId for authorization middleware
      });
      
      // Update the expense in the list
      setExpenses(expenses.map(expense => 
        expense.id === selectedExpense.id ? response.data.expense : expense
      ));
      
      // Update total spent
      setTotalSpent(response.data.totalSpent);
      
      setShowExpenseForm(false);
      setSelectedExpense(null);
      toast.success(t('budget.expenseUpdated'));
      
      // Refresh budget data for accurate calculations
      await fetchBudget(selectedTrip.id);
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error(t('errors.saveFailed', { item: t('budget.editExpense').toLowerCase() }));
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      const response = await budgetAPI.deleteExpense(expenseId, selectedTrip.id);
      
      // Remove the expense from the list
      setExpenses(expenses.filter(expense => expense.id !== expenseId));
      
      // Update total spent
      setTotalSpent(response.data.totalSpent);
      
      toast.success(t('budget.expenseDeleted'));
      
      // Refresh budget data for accurate calculations
      await fetchBudget(selectedTrip.id);
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error(t('errors.deleteFailed', { item: t('budget.deleteExpense').toLowerCase() }));
    }
  };

  const editExpense = (expense) => {
    setSelectedExpense(expense);
    setShowExpenseForm(true);
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    switch(category) {
      case "transport": return <Plane className="text-blue-500" size={18} />;
      case "lodging": return <Home className="text-green-500" size={18} />;
      case "activities": return <Compass className="text-purple-500" size={18} />;
      case "food": return <Coffee className="text-orange-500" size={18} />;
      case "other": return <Gift className="text-pink-500" size={18} />;
      default: return <CreditCard className="text-gray-500" size={18} />;
    }
  };

  // Get category color
  const getCategoryColor = (category) => {
    switch(category) {
      case "transport": return "text-blue-500 bg-blue-50 dark:bg-blue-900/20";
      case "lodging": return "text-green-500 bg-green-50 dark:bg-green-900/20";
      case "activities": return "text-purple-500 bg-purple-50 dark:bg-purple-900/20";
      case "food": return "text-orange-500 bg-orange-50 dark:bg-orange-900/20";
      case "other": return "text-pink-500 bg-pink-50 dark:bg-pink-900/20";
      default: return "text-gray-500 bg-gray-50 dark:bg-gray-700";
    }
  };

  // Filter expenses based on active tab
  const filteredExpenses = activeTab === 'all' 
    ? expenses 
    : expenses.filter(expense => expense.category === activeTab);

  if (loading && !trips.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!trips.length) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t('budget.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{t('trips.noTrips')}</p>
          <Link 
            to="/trips/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
          >
            {t('trips.createTrip')}
          </Link>
        </div>
      </div>
    );
  }

  // Display the trip selection screen if we have multiple trips and none has been explicitly selected
  if (!hasExplicitlySelected && trips.length > 1) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('budget.selectTripForBudget')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('budget.selectTripDescription')}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map(trip => (
            <div 
              key={trip.id}
              onClick={() => selectTrip(trip)}
              className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow transform hover:-translate-y-1 transition-transform duration-200"
            >
              <div className="h-48 w-full relative">
                <img 
                  src={trip.cover_image 
                    ? getImageUrl(trip.cover_image)
                    : getFallbackImageUrl('trip')
                  } 
                  alt={trip.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-4">
                  <h2 className="text-xl font-bold text-white">{trip.name}</h2>
                  <div className="flex items-center text-white/80 mt-1">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D, YYYY')}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 flex justify-between items-center">
                <div className="flex items-center">
                  <Map className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                  <span className="text-gray-600 dark:text-gray-300">{trip.location || t('common.noLocation')}</span>
                </div>
                <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                  {t('budget.selectTrip')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If we don't have a selected trip (this shouldn't happen, but just in case)
  if (!selectedTrip) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t('budget.noTripSelected')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{t('budget.pleaseSelectTrip')}</p>
          <Button
            variant="primary"
            onClick={() => setHasExplicitlySelected(false)}
          >
            {t('budget.selectTrip')}
          </Button>
        </div>
      </div>
    );
  }

  // Main budget content (once a trip is selected)
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={() => setHasExplicitlySelected(false)}
            className="mr-4 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('budget.backToSelection')}
          </button>
        </div>
        
        <div className="flex items-center">
          {budget && (
            <>
              <Button
                variant="outline"
                className="mr-2"
                onClick={() => setShowCreateBudgetForm(true)}
              >
                {t('budget.update')}
              </Button>
              
              <Button
                variant="outline"
                className="mr-2"
                onClick={() => setShowDeleteModal(true)}
                icon={<Trash2 className="h-4 w-4" />}
              >
                {t('budget.delete')}
              </Button>
              
              <Button
                variant="primary"
                icon={<Plus className="h-5 w-5" />}
                onClick={() => {
                  setSelectedExpense(null);
                  setShowExpenseForm(true);
                }}
              >
                {t('budget.addExpense')}
              </Button>
            </>
          )}
          
          {/* Add a trip link button when in budget view */}
          <Link 
            to={`/trips/${selectedTrip.id}`}
            className="ml-4 flex items-center px-4 py-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <span>{t('trips.viewDetails')}</span>
          </Link>
        </div>
      </div>
      
      {/* Budget Content */}
      <div>
        {!budget ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{t('budget.setupBudget')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {t('budget.setupBudgetMessage')}
            </p>
            <Button
              variant="primary"
              onClick={() => setShowCreateBudgetForm(true)}
            >
              {t('budget.createBudgetButton')}
            </Button>
          </div>
        ) : (
          <>
            {/* Budget Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">{selectedTrip.name}</h1>
                  <div className="flex items-center text-gray-500 dark:text-gray-400 mb-4">
                    <Calendar size={16} className="mr-1" />
                    <span>
                      {dayjs(selectedTrip.start_date).format('MMM D')} - {dayjs(selectedTrip.end_date).format('MMM D, YYYY')}
                    </span>
                  </div>
                  
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('budget.title')}</h2>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">
                      {budget.currency}{(budget.total_amount - totalSpent).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t('budget.remaining')}</span>
                  </div>
                  
                  {/* Budget Bar */}
                  <div className="mt-6 mb-2">
                    <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      {/* This is the remaining budget bar (decreases as you spend) */}
                      <div 
                        className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${
                          totalSpent > budget.total_amount * 0.9 // Change color when almost depleted
                            ? 'bg-red-500 dark:bg-red-600' 
                            : 'bg-blue-500 dark:bg-blue-600'
                        }`}
                        style={{ width: `${Math.max(100 - (totalSpent / budget.total_amount) * 100, 0)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-gray-500 dark:text-gray-400">
                      <span>{t('budget.empty')}</span>
                      <span>{t('budget.full')}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex justify-between text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('budget.total')}: </span>
                      <span className="font-semibold">{budget.currency}{budget.total_amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t('budget.spent')}: </span>
                      <span className="font-semibold">{budget.currency}{totalSpent.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}</span>
                    </div>
                  </div>
                </div>
                
                {/* Category Breakdown */}
                <div className="grid grid-cols-5 gap-4 mt-6 border-t pt-6">
                  <div className="p-4 text-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div className="text-blue-500 dark:text-blue-400 mb-1">
                      <Plane size={20} className="inline-block" />
                    </div>
                    <div className="font-medium text-xs">{t('budget.transport')}</div>
                    <div className="font-semibold">{budget.currency}{(categoryTotals.transport || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</div>
                  </div>
                  
                  <div className="p-4 text-center rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div className="text-green-500 dark:text-green-400 mb-1">
                      <Home size={20} className="inline-block" />
                    </div>
                    <div className="font-medium text-xs">{t('budget.lodging')}</div>
                    <div className="font-semibold">{budget.currency}{(categoryTotals.lodging || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</div>
                  </div>
                  
                  <div className="p-4 text-center rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <div className="text-purple-500 dark:text-purple-400 mb-1">
                      <Compass size={20} className="inline-block" />
                    </div>
                    <div className="font-medium text-xs">{t('budget.activities')}</div>
                    <div className="font-semibold">{budget.currency}{(categoryTotals.activities || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</div>
                  </div>
                  
                  <div className="p-4 text-center rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <div className="text-orange-500 dark:text-orange-400 mb-1">
                      <Coffee size={20} className="inline-block" />
                    </div>
                    <div className="font-medium text-xs">{t('budget.food')}</div>
                    <div className="font-semibold">{budget.currency}{(categoryTotals.food || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</div>
                  </div>
                  
                  <div className="p-4 text-center rounded-lg bg-pink-50 dark:bg-pink-900/20">
                    <div className="text-pink-500 dark:text-pink-400 mb-1">
                      <Gift size={20} className="inline-block" />
                    </div>
                    <div className="font-medium text-xs">{t('budget.other')}</div>
                    <div className="font-semibold">{budget.currency}{(categoryTotals.other || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Expenses List */}
            <Card>
              <CardHeader>
                <CardTitle>{t('budget.allExpenses')}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Tab Navigation */}
                <div className="flex mb-6 overflow-x-auto pb-2">
                  <button 
                    className={`mr-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeTab === 'all' 
                        ? 'bg-gray-800 dark:bg-gray-700 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setActiveTab('all')}
                  >
                    {t('budget.allExpenses')}
                  </button>
                  
                  <button 
                    className={`mr-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeTab === 'transport' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    }`}
                    onClick={() => setActiveTab('transport')}
                  >
                    {t('budget.transport')}
                  </button>
                  
                  <button 
                    className={`mr-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeTab === 'lodging' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                    }`}
                    onClick={() => setActiveTab('lodging')}
                  >
                    {t('budget.lodging')}
                  </button>
                  
                  <button 
                    className={`mr-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeTab === 'activities' 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                    }`}
                    onClick={() => setActiveTab('activities')}
                  >
                    {t('budget.activities')}
                  </button>
                  
                  <button 
                    className={`mr-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeTab === 'food' 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                    }`}
                    onClick={() => setActiveTab('food')}
                  >
                    {t('budget.food')}
                  </button>
                  
                  <button 
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeTab === 'other' 
                        ? 'bg-pink-500 text-white' 
                        : 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/30'
                    }`}
                    onClick={() => setActiveTab('other')}
                  >
                    {t('budget.other')}
                  </button>
                </div>
                
                {/* Expenses */}
                <div className="space-y-4">
                  {filteredExpenses.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">{t('budget.noExpenses')}</div>
                  ) : (
                    filteredExpenses.map(expense => (
                      <div 
                        key={expense.id} 
                        className="flex items-center p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                      >
                        <div className={`p-3 mr-4 rounded-full ${getCategoryColor(expense.category)}`}>
                          {getCategoryIcon(expense.category)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{expense.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {dayjs(expense.date).format('MMM D, YYYY')}
                          </div>
                        </div>
                        <div className="font-bold text-lg mr-4">
                          {budget.currency}{parseFloat(expense.amount).toFixed(2)}
                        </div>
                        <div className="flex">
                          <button 
                            onClick={() => editExpense(expense)} 
                            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 mr-1"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteExpense(expense.id)} 
                            className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Add Expense Modal */}
      <ExpenseForm
        isOpen={showExpenseForm}
        onClose={() => {
          setShowExpenseForm(false);
          setSelectedExpense(null);
        }}
        onSubmit={selectedExpense ? handleUpdateExpense : handleAddExpense}
        expense={selectedExpense}
        currency={budget?.currency || '$'}
      />
      
      {/* Create Budget Modal */}
      <CreateBudgetForm
        isOpen={showCreateBudgetForm}
        onClose={() => setShowCreateBudgetForm(false)}
        onSubmit={budget ? handleUpdateBudget : handleCreateBudget}
        budget={budget}
      />
      
      {/* Delete Budget Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('budget.deleteBudget')}
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('budget.deleteConfirmation')}
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              {t('budget.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteBudget}
              icon={<Trash2 className="h-5 w-5" />}
            >
              {t('budget.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BudgetDashboard;