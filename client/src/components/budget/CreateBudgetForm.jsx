// client/src/components/budget/CreateBudgetForm.jsx

import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

import { symbolFor } from '../../utils/currencyUtils';

// currencyChoices: [{ code, symbol, label }] — when provided (personal
// budgets), the total amount can be denominated in either currency (a €5000
// envelope for a JPY trip)
// allowNoLimit (shared budgets): the budget can be a tracker-only pot with
// no cap — total_amount 0 is the "no limit" sentinel
const CreateBudgetForm = ({ isOpen, onClose, onSubmit, budget, currencyChoices = null, allowNoLimit = false }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    total_amount: '',
    currency: '$',
    currency_code: ''
  });
  const [totalCurrency, setTotalCurrency] = useState('');
  const [noLimit, setNoLimit] = useState(false);

  useEffect(() => {
    if (budget) {
      setFormData({
        total_amount: budget.total_amount || '',
        currency: budget.currency || '$',
        currency_code: budget.currency_code || ''
      });
      setTotalCurrency(budget.total_currency_code || '');
      setNoLimit(allowNoLimit && budget.total_amount === 0);
    } else {
      setFormData({
        total_amount: '',
        currency: '$',
        currency_code: ''
      });
      setTotalCurrency('');
      setNoLimit(false);
    }
  }, [budget, isOpen, allowNoLimit]);

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
    
    // Validate required fields (a no-limit budget needs no amount)
    if (!noLimit && !formData.total_amount) {
      return;
    }

    const base = noLimit ? { ...formData, total_amount: 0 } : formData;
    onSubmit(currencyChoices?.length
      ? { ...base, total_currency_code: totalCurrency }
      : base);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={budget ? t('budget.update') : t('budget.create')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="p-6">
        {allowNoLimit && (
          <label className="mb-4 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700 cursor-pointer">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('budget.noLimit', 'No spending limit')}
              <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">
                {t('budget.noLimitHint', 'Track and settle expenses without a cap')}
              </span>
            </span>
            <input
              type="checkbox"
              checked={noLimit}
              onChange={(e) => setNoLimit(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-accent focus:ring-accent"
            />
          </label>
        )}

        <div className={`mb-4 ${noLimit ? 'hidden' : ''}`}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('budget.total')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
              {(totalCurrency && symbolFor(totalCurrency))
                || symbolFor(formData.currency_code) || formData.currency || '$'}
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
          {currencyChoices?.length > 1 && (
            <div className="mt-2 flex gap-1.5">
              {currencyChoices.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setTotalCurrency(c.code === currencyChoices[0].code ? '' : c.code)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${(totalCurrency || currencyChoices[0].code) === c.code
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}
                >
                  {c.symbol} {c.label}
                </button>
              ))}
            </div>
          )}
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