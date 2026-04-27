import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import { apiKeyAPI } from '../../services/api';

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const ApiKeysSection = () => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Plaintext key shown ONCE after creation.
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const [revokingId, setRevokingId] = useState(null);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await apiKeyAPI.list();
      setKeys(res.data.keys || []);
    } catch (err) {
      console.error('Failed to load API keys', err);
      toast.error(t('apiKeys.loadFailed', 'Failed to load API keys'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const resetCreateForm = () => {
    setName('');
    setExpiresAt('');
    setCreateError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setCreateError(t('apiKeys.nameRequired', 'Name is required'));
      return;
    }
    try {
      setCreating(true);
      setCreateError('');
      const payload = { name: name.trim() };
      if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();
      const res = await apiKeyAPI.create(payload);
      setNewlyCreatedKey({ ...res.data.key, plaintext: res.data.plaintext });
      setCreateOpen(false);
      resetCreateForm();
      fetchKeys();
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.errors?.[0]?.msg
        || t('apiKeys.createFailed', 'Failed to create API key');
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm(t('apiKeys.confirmRevoke', 'Revoke this API key? Apps using it will stop working immediately.'))) {
      return;
    }
    try {
      setRevokingId(id);
      await apiKeyAPI.revoke(id);
      toast.success(t('apiKeys.revoked', 'API key revoked'));
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('apiKeys.revokeFailed', 'Failed to revoke key'));
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('apiKeys.copyFailed', 'Could not copy to clipboard'));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="w-5 h-5 text-gray-400" />
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {t('apiKeys.title', 'API Keys')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('apiKeys.subtitle', 'Read-only access tokens for widgets and integrations')}
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateOpen(true)}
        >
          {t('apiKeys.create', 'New key')}
        </Button>
      </div>

      <div className="p-6">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('apiKeys.empty', 'You don\'t have any API keys yet. Create one to query your trips programmatically.')}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {keys.map((k) => {
              const expired = k.expires_at && new Date(k.expires_at).getTime() < Date.now();
              return (
                <li key={k.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white truncate">{k.name}</span>
                      <code className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {k.key_prefix}…
                      </code>
                      {expired && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          {t('apiKeys.expired', 'Expired')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                      <span>
                        {t('apiKeys.created', 'Created')}: {formatDate(k.created_at)}
                      </span>
                      <span>
                        {t('apiKeys.lastUsed', 'Last used')}:{' '}
                        {k.last_used_at ? formatDate(k.last_used_at) : t('apiKeys.never', 'never')}
                      </span>
                      {k.expires_at && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('apiKeys.expires', 'Expires')}: {formatDate(k.expires_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    loading={revokingId === k.id}
                    onClick={() => handleRevoke(k.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    {t('apiKeys.revoke', 'Revoke')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); resetCreateForm(); }}
        title={t('apiKeys.createTitle', 'Create API Key')}
        size="md"
      >
        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <Input
            label={t('apiKeys.name', 'Name')}
            placeholder={t('apiKeys.namePlaceholder', 'e.g. Home dashboard widget')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('apiKeys.expiry', 'Expires (optional)')}
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('apiKeys.expiryHelp', 'Leave blank for a key that never expires.')}
            </p>
          </div>
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setCreateOpen(false); resetCreateForm(); }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={creating} icon={<Key className="w-4 h-4" />}>
              {t('apiKeys.create', 'Create key')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* One-time secret reveal modal */}
      <Modal
        isOpen={!!newlyCreatedKey}
        onClose={() => setNewlyCreatedKey(null)}
        title={t('apiKeys.savedTitle', 'Save your new API key')}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-900/50">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              {t('apiKeys.savedWarning', 'Copy this key now. For your security, it won\'t be shown again.')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-sm bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg p-3 font-mono">
              {newlyCreatedKey?.plaintext}
            </code>
            <Button
              type="button"
              variant="secondary"
              icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              onClick={() => handleCopy(newlyCreatedKey?.plaintext)}
            >
              {copied ? t('common.copied', 'Copied') : t('common.copy')}
            </Button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('apiKeys.usageHint', 'Send it as')}{' '}
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
              Authorization: Bearer {newlyCreatedKey?.plaintext?.slice(0, 12)}…
            </code>{' '}
            {t('apiKeys.usageHint2', 'on read-only requests.')}
          </p>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setNewlyCreatedKey(null)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApiKeysSection;
