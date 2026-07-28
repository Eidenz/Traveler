// client/src/components/budget/ExpenseForm.jsx

import React, { useState, useEffect } from 'react';
import { X, Plane, Home, Compass, Coffee, Gift } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

// currencyChoices: [{ code, symbol, label }] — when 2+ choices are given the
// amount field grows a currency picker (personal budgets mix trip-currency
// spendings with home-currency bookings)
const ExpenseForm = ({ isOpen, onClose, onSubmit, expense, currency = '$', members = [], showSettlement = false, currencyChoices = null }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'transport',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [paidBy, setPaidBy] = useState('');
  const [splitIds, setSplitIds] = useState([]);
  const [expenseCurrency, setExpenseCurrency] = useState('');

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name || '',
        amount: expense.amount || '',
        category: expense.category || 'transport',
        date: expense.date || new Date().toISOString().slice(0, 10),
        notes: expense.notes || ''
      });
      setPaidBy(expense.paid_by ?? '');
      setSplitIds(expense.split_user_ids?.length ? expense.split_user_ids : members.map(m => m.id));
      setExpenseCurrency(expense.currency_code || currencyChoices?.[0]?.code || '');
    } else {
      setFormData({
        name: '',
        amount: '',
        category: 'transport',
        date: new Date().toISOString().slice(0, 10),
        notes: ''
      });
      setPaidBy('');
      setSplitIds(members.map(m => m.id));
      setExpenseCurrency(currencyChoices?.[0]?.code || '');
    }
    // members list is stable per trip; re-running on it would reset choices
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, isOpen]);

  const toggleSplit = (userId) => {
    setSplitIds(prev => prev.includes(userId)
      ? prev.filter(id => id !== userId)
      : [...prev, userId]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'amount' ? parseFloat(value) || '' : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.amount || !formData.date) {
      return;
    }
    if (showSettlement && paidBy !== '' && splitIds.length === 0) {
      return; // a paid expense needs at least one participant
    }

    const withCurrency = currencyChoices?.length
      ? { ...formData, currency_code: expenseCurrency }
      : formData;

    onSubmit(showSettlement
      ? { ...withCurrency, paid_by: paidBy, split_user_ids: paidBy === '' ? [] : splitIds }
      : withCurrency);
  };

  const handleCategorySelect = (category) => {
    setFormData({
      ...formData,
      category
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expense ? t('budget.editExpense') : t('budget.addExpense')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('budget.name')}
          </label>
          <input 
            type="text" 
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('budget.whatSpentOn')}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('budget.category')}
          </label>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                formData.category === 'transport' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleCategorySelect('transport')}
            >
              <Plane size={20} className="text-blue-500 dark:text-blue-400 mr-2" />
              <span>{t('budget.transport')}</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                formData.category === 'lodging' 
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleCategorySelect('lodging')}
            >
              <Home size={20} className="text-green-500 dark:text-green-400 mr-2" />
              <span>{t('budget.lodging')}</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                formData.category === 'activities' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleCategorySelect('activities')}
            >
              <Compass size={20} className="text-purple-500 dark:text-purple-400 mr-2" />
              <span>{t('budget.activities')}</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                formData.category === 'food' 
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleCategorySelect('food')}
            >
              <Coffee size={20} className="text-orange-500 dark:text-orange-400 mr-2" />
              <span>{t('budget.food')}</span>
            </div>
            <div 
              className={`flex items-center p-3 rounded-lg cursor-pointer border transition-colors ${
                formData.category === 'other' 
                  ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => handleCategorySelect('other')}
            >
              <Gift size={20} className="text-pink-500 dark:text-pink-400 mr-2" />
              <span>{t('budget.other')}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('budget.amount')}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500 dark:text-gray-400">
                {currencyChoices?.length
                  ? (currencyChoices.find(c => c.code === expenseCurrency)?.symbol || currency)
                  : currency}
              </span>
              <input 
                type="number" 
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                className="w-full p-3 pl-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                required
              />
            </div>
            {currencyChoices?.length > 1 && (
              <div className="mt-2 flex gap-1.5">
                {currencyChoices.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setExpenseCurrency(c.code)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${expenseCurrency === c.code
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}
                  >
                    {c.symbol} {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('budget.date')}
            </label>
            <input 
              type="date" 
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              required
            />
          </div>
        </div>
        
        {showSettlement && members.length > 0 && (
          <div className="mb-6 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('budget.paidBy', 'Paid by')}
            </label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('budget.paidByNobody', 'Not tracked (no settlement)')}</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            {paidBy !== '' && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('budget.splitBetween', 'Split between')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleSplit(m.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${splitIds.includes(m.id)
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                {splitIds.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">
                    {t('budget.splitNeedsOne', 'Pick at least one participant')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('budget.notes')}
          </label>
          <textarea 
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
          ></textarea>
        </div>
        
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            {t('budget.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
          >
            {t('budget.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ExpenseForm;