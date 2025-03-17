// client/src/components/budget/ExpenseForm.jsx

import React, { useState, useEffect } from 'react';
import { X, Plane, Home, Compass, Coffee, Gift } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

const ExpenseForm = ({ isOpen, onClose, onSubmit, expense, currency = '$' }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'transport',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name || '',
        amount: expense.amount || '',
        category: expense.category || 'transport',
        date: expense.date || new Date().toISOString().slice(0, 10),
        notes: expense.notes || ''
      });
    } else {
      setFormData({
        name: '',
        amount: '',
        category: 'transport',
        date: new Date().toISOString().slice(0, 10),
        notes: ''
      });
    }
  }, [expense, isOpen]);

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
    
    onSubmit(formData);
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
              <span className="absolute left-3 top-3 text-gray-500 dark:text-gray-400">{currency}</span>
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