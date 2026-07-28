// client/src/components/budget/CreateBudgetForm.jsx

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

import { symbolFor } from '../../utils/currencyUtils';

const CreateBudgetForm = ({ isOpen, onClose, onSubmit, budget }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    total_amount: '',
    currency: '$',
    currency_code: ''
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        total_amount: budget.total_amount || '',
        currency: budget.currency || '$',
        currency_code: budget.currency_code || ''
      });
    } else {
      setFormData({
        total_amount: '',
        currency: '$',
        currency_code: ''
      });
    }
  }, [budget, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const codes = ['currency_code'];
    setFormData({
      ...formData,
      [name]: name === 'total_amount'
        ? parseFloat(value) || ''
        : codes.includes(name) ? value.toUpperCase().slice(0, 3) : value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.total_amount) {
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={budget ? t('budget.update') : t('budget.create')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('budget.total')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
              {symbolFor(formData.currency_code) || formData.currency || '$'}
            </span>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              className="w-full p-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              required
            />
          </div>
        </div>
        
        {/* The trip's ISO code drives the symbol and conversions; each
            member's home currency comes from their profile */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('budget.tripCurrency', 'Trip currency')}
          </label>
          <input
            type="text"
            name="currency_code"
            value={formData.currency_code}
            onChange={handleChange}
            placeholder="JPY"
            maxLength={3}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            {t('budget.tripCurrencyHint', 'Amounts convert to each member\'s own home currency (set in Profile).')}
          </p>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
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

export default CreateBudgetForm;