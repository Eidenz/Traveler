// client/src/components/budget/BudgetWidget.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Users, User, ChevronRight } from 'lucide-react';
import { budgetAPI, personalBudgetAPI } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../contexts/SocketContext';
import { symbolFor } from '../../utils/currencyUtils';

const BudgetWidget = ({ tripId }) => {
    const { t } = useTranslation();
    const { subscribe } = useSocket();
    const [loading, setLoading] = useState(true);
    const [sharedBudget, setSharedBudget] = useState(null);
    const [sharedExpenses, setSharedExpenses] = useState([]);
    const [sharedTotalSpent, setSharedTotalSpent] = useState(0);
    const [personalData, setPersonalData] = useState(null); // { budget, expenses, conversion }

    const fetchBudgets = useCallback(async () => {
        if (!tripId) return;
        try {
            setLoading(true);
            const [sharedRes, personalRes] = await Promise.allSettled([
                budgetAPI.getTripBudget(tripId),
                personalBudgetAPI.getTripBudget(tripId)
            ]);

            if (sharedRes.status === 'fulfilled') {
                setSharedBudget(sharedRes.value.data.budget);
                setSharedExpenses(sharedRes.value.data.expenses || []);
                setSharedTotalSpent(sharedRes.value.data.totalSpent || 0);
            }
            if (personalRes.status === 'fulfilled') {
                setPersonalData({
                    budget: personalRes.value.data.budget,
                    expenses: personalRes.value.data.expenses || [],
                    conversion: personalRes.value.data.conversion || null,
                });
            }
        } catch (error) {
            console.error('Error fetching budgets:', error);
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        if (tripId) {
            fetchBudgets();
        }
    }, [tripId, fetchBudgets]);

    // Subscribe to real-time budget updates
    useEffect(() => {
        if (!tripId) return;

        const budgetEvents = [
            'budget:created',
            'budget:updated',
            'budget:deleted',
            'expense:created',
            'expense:updated',
            'expense:deleted'
        ];

        const unsubscribers = budgetEvents.map(event =>
            subscribe(event, () => {
                fetchBudgets();
            })
        );

        return () => {
            unsubscribers.forEach(unsub => unsub && unsub());
        };
    }, [tripId, subscribe, fetchBudgets]);

    const getStatusColor = (budget, spent) => {
        if (!budget) return 'gray';
        const percent = (spent / budget.total_amount) * 100;
        if (percent > 100) return 'red';
        if (percent > 80) return 'amber';
        return 'emerald';
    };

    const MiniProgress = ({ budget, spent }) => {
        // total_amount 0 = no spending limit: nothing to fill or overflow
        if (!budget || !(budget.total_amount > 0)) return null;
        const percent = Math.min((spent / budget.total_amount) * 100, 100);
        const color = getStatusColor(budget, spent);
        const colorClass = color === 'red' ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';

        return (
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
                        <div className="h-4 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-3 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    const sharedRemaining = sharedBudget ? sharedBudget.total_amount - sharedTotalSpent : null;

    // Personal numbers must match the budget page: expenses can mix trip and
    // home currency, the total has its own denomination, and shared splits
    // fold in (same localStorage preference the dashboard uses). Everything
    // converts into the total's unit before comparing.
    const personalView = (() => {
        const budget = personalData?.budget;
        if (!budget) return null;
        const conversion = personalData.conversion;
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const includeShares = localStorage.getItem('personalIncludeSharedShares') !== 'false';

        const tripCode = budget.currency_code || conversion?.trip_currency_code || null;
        const targetCode = budget.total_currency_code || tripCode;
        const toUnit = (amount, code) => {
            const c = code || tripCode;
            if (!conversion || !targetCode || c === targetCode) return amount;
            if (c === conversion.trip_currency_code && targetCode === conversion.home_currency_code) return amount * conversion.rate;
            if (c === conversion.home_currency_code && targetCode === conversion.trip_currency_code) return amount / conversion.rate;
            return amount;
        };

        let spent = (personalData.expenses || [])
            .reduce((sum, e) => sum + toUnit(e.amount, e.currency_code), 0);
        if (includeShares) {
            for (const e of sharedExpenses) {
                if (e.paid_by != null && (e.split_user_ids || []).includes(currentUser.id)) {
                    spent += toUnit(e.amount / e.split_user_ids.length, sharedBudget?.currency_code);
                }
            }
        }

        return {
            budget,
            spent,
            remaining: budget.total_amount - spent,
            symbol: (targetCode && symbolFor(targetCode)) || budget.currency || '$',
        };
    })();

    return (
        <Link
            to={`/budgets/${tripId}`}
            className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
        >
            {/* Left: Icon and label */}
            <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('budget.title', 'Budget')}
                </span>
            </div>

            {/* Right: Budget summaries */}
            <div className="flex items-center gap-1">
                {/* Shared budget */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50">
                    <Users className="w-3 h-3 text-gray-400" />
                    {sharedBudget ? (
                        sharedBudget.total_amount > 0 ? (
                            <>
                                <span className={`text-xs font-medium ${sharedRemaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {sharedBudget.currency}{Math.abs(sharedRemaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-gray-400">{t('budget.left', 'left')}</span>
                                <MiniProgress budget={sharedBudget} spent={sharedTotalSpent} />
                            </>
                        ) : (
                            <>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {sharedBudget.currency}{sharedTotalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-gray-400">{t('budget.spent', 'spent')}</span>
                            </>
                        )
                    ) : (
                        <span className="text-xs text-gray-400">—</span>
                    )}
                </div>

                {/* Personal budget */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 dark:bg-gray-700/50">
                    <User className="w-3 h-3 text-gray-400" />
                    {personalView ? (
                        <>
                            <span className={`text-xs font-medium ${personalView.remaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                {personalView.symbol}{Math.abs(personalView.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-[10px] text-gray-400">{t('budget.left', 'left')}</span>
                            <MiniProgress budget={personalView.budget} spent={personalView.spent} />
                        </>
                    ) : (
                        <span className="text-xs text-gray-400">—</span>
                    )}
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-accent transition-colors ml-1" />
            </div>
        </Link>
    );
};

export default BudgetWidget;
