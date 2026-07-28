// client/src/components/budget/SettlementCard.jsx
// "Who owes whom" for the shared budget: suggested transfers plus each
// member's net balance. Only expenses with a payer participate (the server
// computes everything; this just renders it).

import React from 'react';
import { ArrowRight, Scale } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettlementCard = ({ settlement, toHome }) => {
  const { t } = useTranslation();
  if (!settlement || settlement.balances.length === 0) return null;

  const cur = settlement.currency || '$';
  const fmt = (n) => `${cur}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Scale className="w-4 h-4 text-accent" />
        <h2 className="font-display font-medium text-gray-900 dark:text-white">
          {t('budget.settleUp', 'Settle up')}
        </h2>
      </div>

      <div className="p-4 space-y-3">
        {settlement.transfers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('budget.allSettled', 'All settled — nobody owes anything.')}
          </p>
        ) : (
          <div className="space-y-2">
            {settlement.transfers.map((tr, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">{tr.from_name}</span>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{tr.to_name}</span>
                <span className="ml-auto text-sm font-semibold text-accent whitespace-nowrap">
                  {fmt(tr.amount)}
                  {toHome && (
                    <span className="ml-1 text-xs font-normal text-gray-400">≈ {toHome(tr.amount)}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Net balances */}
        <div className="flex flex-wrap gap-2 pt-1">
          {settlement.balances.map((b) => (
            <span
              key={b.user_id}
              className={`text-xs px-2 py-1 rounded-full font-medium ${b.net >= 0
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300'
                }`}
            >
              {b.name}: {b.net >= 0 ? '+' : ''}{fmt(b.net)}
            </span>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {t('budget.settleHint', 'Based on expenses with a payer. Set "Paid by" when adding an expense to include it.')}
        </p>
      </div>
    </div>
  );
};

export default SettlementCard;
