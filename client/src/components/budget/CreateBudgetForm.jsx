// client/src/components/budget/CreateBudgetForm.jsx

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

const CreateBudgetForm = ({ isOpen, onClose, onSubmit, budget }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    total_amount: '',
    currency: '$'
  });

  useEffect(() => {
    if (budget) {
      setFormData({
        total_amount: budget.total_amount || '',
        currency: budget.currency || '$'
      });
    } else {
      setFormData({
        total_amount: '',
        currency: '$'
      });
    }
  }, [budget, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'total_amount' ? parseFloat(value) || '' : value
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
            <div className="absolute inset-y-0 left-0 flex items-center">
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="h-full py-0 pl-3 pr-7 border-transparent bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none sm:text-sm rounded-md"
              >
                <option value="$">$</option>
                <option value="€">€</option>
                <option value="£">£</option>
                <option value="¥">¥</option>
              </select>
            </div>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              className="w-full p-3 pl-16 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              required
            />
          </div>
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