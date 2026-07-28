// client/src/components/budget/SettlementCard.jsx
// Settle-up panel for the shared budget, shown inline above the expense
// list: a fat status badge for the current user, a progress bar of how much
// of the group's debt is settled, the remaining transfers with "mark paid"
// (any editor may record a payment — the bill payer can tick off lazy
// friends), and the payment history with undo.

import React from 'react';
import { ArrowRight, Scale, Check, CheckCircle2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettlementCard = ({ settlement, toHome, canEdit, currentUserId, onMarkPaid, onUndoPayment, busy }) => {
  const { t } = useTranslation();
  if (!settlement || (settlement.balances.length === 0 && (settlement.payments?.length || 0) === 0)) {
    return null;
  }

  const cur = settlement.currency || '$';
  const fmt = (n) => `${cur}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const myBalance = settlement.balances.find((b) => b.user_id === currentUserId);
  const iOwe = myBalance && myBalance.net < -0.009;
  const ratio = settlement.progress?.ratio ?? 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Scale className="w-4 h-4 text-accent" />
        <h2 className="font-display font-medium text-gray-900 dark:text-white">
          {t('budget.settleUp', 'Settle up')}
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Fat personal status badge */}
        <div
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-base font-semibold ${iOwe
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'}`}
        >
          {iOwe ? (
            <>
              {t('budget.youOwe', 'You owe')} {fmt(-myBalance.net)}
              {toHome && <span className="text-sm font-normal opacity-70">≈ {toHome(-myBalance.net)}</span>}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {t('budget.youAreSettled', "You're settled up")}
            </>
          )}
        </div>

        {/* Group progress */}
        {settlement.progress && settlement.progress.total > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{t('budget.groupSettled', 'Group settled')}</span>
              <span>{Math.round(ratio * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            {settlement.progress.remaining > 0 && (
              <p className="mt-1 text-[11px] text-gray-400">
                {t('budget.remainingDebt', '{{amount}} still to settle', { amount: fmt(settlement.progress.remaining) })}
              </p>
            )}
          </div>
        )}

        {/* Remaining transfers */}
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
                {canEdit && (
                  <button
                    disabled={busy}
                    onClick={() => onMarkPaid(tr)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors disabled:opacity-50 flex-shrink-0"
                    title={t('budget.markPaidHint', 'Record that this payment happened')}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('budget.markPaid', 'Paid')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Payment history */}
        {settlement.payments?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              {t('budget.recordedPayments', 'Recorded payments')}
            </p>
            <div className="space-y-1">
              {settlement.payments.map((pmt) => (
                <div key={pmt.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">
                    {t('budget.paymentLine', '{{from}} paid {{to}} {{amount}}', {
                      from: pmt.from_name, to: pmt.to_name, amount: fmt(pmt.amount),
                    })}
                    {pmt.created_by !== pmt.from_user && (
                      <span className="opacity-60"> · {t('budget.recordedBy', 'by {{name}}', { name: pmt.created_by_name })}</span>
                    )}
                  </span>
                  {canEdit && (
                    <button
                      disabled={busy}
                      onClick={() => onUndoPayment(pmt)}
                      className="ml-auto p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex-shrink-0"
                      title={t('common.undo', 'Undo')}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {t('budget.settleHint', 'Based on expenses with a payer. Set "Paid by" when adding an expense to include it.')}
        </p>
      </div>
    </div>
  );
};

export default SettlementCard;
