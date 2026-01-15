// client/src/components/trips/ShareModal.jsx
import React, { useState, useEffect } from 'react';
import { Globe, Link2, X, UserMinus, Crown, ChevronDown, Copy, Trash2, ExternalLink, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ToggleSwitch from '../ui/ToggleSwitch';
import { tripAPI } from '../../services/api';
import { getImageUrl } from '../../utils/imageUtils';

const ShareModal = ({ isOpen, onClose, trip, members, tripId, onUpdate, currentUserId }) => {
    const { t } = useTranslation();

    // State
    const [shareEmail, setShareEmail] = useState('');
    const [shareRole, setShareRole] = useState('viewer');
    const [isSharing, setIsSharing] = useState(false);
    const [publicShareToken, setPublicShareToken] = useState(trip?.public_share_token || null);
    const [isBrainstormPublic, setIsBrainstormPublic] = useState(false);
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [isRevokingLink, setIsRevokingLink] = useState(false);
    const [updatingMemberId, setUpdatingMemberId] = useState(null);
    const [removingMemberId, setRemovingMemberId] = useState(null);

    useEffect(() => {
        if (trip) {
            if (trip.public_share_token !== undefined) {
                setPublicShareToken(trip.public_share_token);
            }
            if (trip.is_brainstorm_public !== undefined) {
                setIsBrainstormPublic(!!trip.is_brainstorm_public);
            }
        }
    }, [trip]);

    // Check if current user is owner
    const isOwner = members.find(m => m.id === currentUserId)?.role === 'owner';

    // Handle sharing with a new user
    const handleShareTrip = async (e) => {
        e.preventDefault();
        if (!shareEmail) {
            toast.error(t('errors.required', { field: t('auth.email') }));
            return;
        }

        try {
            setIsSharing(true);
            await tripAPI.shareTrip(tripId, { email: shareEmail, role: shareRole });
            toast.success(t('sharing.shareSuccess'));
            setShareEmail('');
            onUpdate?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t('errors.saveFailed'));
        } finally {
            setIsSharing(false);
        }
    };

    // Handle updating member role
    const handleUpdateRole = async (userId, newRole) => {
        try {
            setUpdatingMemberId(userId);
            await tripAPI.updateMemberRole(tripId, userId, newRole);
            toast.success(t('sharing.memberRoleUpdated'));
            onUpdate?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t('errors.saveFailed'));
        } finally {
            setUpdatingMemberId(null);
        }
    };

    // Handle removing a member
    const handleRemoveMember = async (userId) => {
        try {
            setRemovingMemberId(userId);
            await tripAPI.removeTripMember(tripId, userId);
            toast.success(t('sharing.memberRemoved'));
            onUpdate?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t('errors.deleteFailed'));
        } finally {
            setRemovingMemberId(null);
        }
    };

    // Handle generating public share link
    const handleGeneratePublicLink = async () => {
        try {
            setIsGeneratingLink(true);
            const response = await tripAPI.generatePublicShareToken(tripId);
            setPublicShareToken(response.data.token);
            toast.success(t('sharing.publicLinkCreated', 'Public link created'));
            onUpdate?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t('errors.saveFailed'));
        } finally {
            setIsGeneratingLink(false);
        }
    };

    // Handle revoking public share link
    const handleRevokePublicLink = async () => {
        try {
            setIsRevokingLink(true);
            await tripAPI.revokePublicShareToken(tripId);
            setPublicShareToken(null);
            setIsBrainstormPublic(false); // Reset brainstorming visibility
            toast.success(t('sharing.publicLinkRevoked', 'Public link revoked'));
            onUpdate?.();
        } catch (error) {
            toast.error(error.response?.data?.message || t('errors.deleteFailed'));
        } finally {
            setIsRevokingLink(false);
        }
    };

    // Handle toggling brainstorm visibility
    const handleToggleBrainstormPublic = async (checked) => {
        const previousValue = isBrainstormPublic;
        setIsBrainstormPublic(checked);
        try {
            await tripAPI.toggleBrainstormPublic(tripId, checked);
            toast.success(checked
                ? t('sharing.brainstormVisible', 'Brainstorming is now visible in public link')
                : t('sharing.brainstormHidden', 'Brainstorming is now hidden from public link')
            );
            onUpdate?.();
        } catch (error) {
            setIsBrainstormPublic(previousValue);
            toast.error(t('errors.updateFailed', 'Failed to update settings'));
        }
    };

    // Copy public link to clipboard
    const handleCopyPublicLink = () => {
        const publicLink = `${window.location.origin}/trip/public/${publicShareToken}`;
        navigator.clipboard.writeText(publicLink);
        toast.success(t('sharing.linkCopied', 'Link copied!'));
    };

    // Open public link in new tab
    const handleOpenPublicLink = () => {
        const publicLink = `${window.location.origin}/trip/public/${publicShareToken}`;
        window.open(publicLink, '_blank');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('sharing.shareTrip', 'Share Trip')}
            size="md"
        >
            <div className="p-6 space-y-6">
                {/* Invite by Email Section - Owner Only */}
                {isOwner && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {t('sharing.inviteByEmail', 'Invite by email')}
                        </label>
                        <form onSubmit={handleShareTrip}>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="email"
                                    placeholder={t('sharing.emailPlaceholder', 'Enter email address')}
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent"
                                    required
                                />
                                <Button type="submit" loading={isSharing}>
                                    {t('sharing.invite', 'Invite')}
                                </Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('sharing.permissionLevel', 'Permission')}:
                                </label>
                                <select
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                                    value={shareRole}
                                    onChange={(e) => setShareRole(e.target.value)}
                                >
                                    <option value="editor">{t('sharing.canEdit', 'Can edit')}</option>
                                    <option value="viewer">{t('sharing.canView', 'Can view')}</option>
                                </select>
                            </div>
                        </form>
                    </div>
                )}

                {/* Public Link Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <label className="text-sm font-medium">
                            {t('sharing.publicLink', 'Public link')}
                        </label>
                    </div>

                    {publicShareToken ? (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={`${window.location.origin}/trip/public/${publicShareToken}`}
                                    readOnly
                                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-500 text-sm font-mono"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={handleCopyPublicLink}
                                    icon={<Copy className="w-4 h-4" />}
                                    title={t('common.copy', 'Copy')}
                                />
                                <Button
                                    variant="secondary"
                                    onClick={handleOpenPublicLink}
                                    icon={<ExternalLink className="w-4 h-4" />}
                                    title={t('common.view', 'View')}
                                />
                            </div>

                            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                                <div className="flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm text-blue-900 dark:text-blue-100">
                                        {t('sharing.publicLinkActive', 'Anyone with this link can view the trip')}
                                    </span>
                                </div>
                                {isOwner && (
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={handleRevokePublicLink}
                                        loading={isRevokingLink}
                                        icon={<Trash2 className="w-3.5 h-3.5" />}
                                    >
                                        {t('sharing.revoke', 'Revoke')}
                                    </Button>
                                )}
                            </div>

                            {/* Brainstorm Toggle */}
                            <div className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg">
                                        <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {t('sharing.shareBrainstorm', 'Share Brainstorming Page')}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('sharing.shareBrainstormDesc', 'Allow public users to view brainstorming ideas')}
                                        </p>
                                    </div>
                                </div>
                                <ToggleSwitch
                                    checked={isBrainstormPublic}
                                    onChange={handleToggleBrainstormPublic}
                                />
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('sharing.publicLinkNote', 'Sensitive information like confirmation codes and documents are hidden in public view.')}
                            </p>
                        </div>
                    ) : (
                        <div>
                            {isOwner ? (
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        {t('sharing.noPublicLink', 'No public link created yet. Create one to share this trip with anyone.')}
                                    </p>
                                    <Button
                                        onClick={handleGeneratePublicLink}
                                        loading={isGeneratingLink}
                                        icon={<Link2 className="w-4 h-4" />}
                                    >
                                        {t('sharing.createPublicLink', 'Create public link')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {t('sharing.noPublicLinkNotOwner', 'No public link available. Only the trip owner can create one.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Current Members Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <label className="block text-sm font-medium mb-3">
                        {t('sharing.currentMembers', 'Current members')}
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {members.map(member => {
                            const isCurrentUser = member.id === currentUserId;
                            const isMemberOwner = member.role === 'owner';
                            const canManage = isOwner && !isMemberOwner && !isCurrentUser;

                            return (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center overflow-hidden">
                                            {member.profile_image ? (
                                                <img
                                                    src={getImageUrl(member.profile_image)}
                                                    alt={member.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-white text-sm font-medium">
                                                    {member.name?.charAt(0)?.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        {/* Name and email */}
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                                                {member.name}
                                                {isCurrentUser && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        ({t('common.you', 'you')})
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                                        </div>
                                    </div>

                                    {/* Role and actions */}
                                    <div className="flex items-center gap-2">
                                        {isMemberOwner ? (
                                            <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-accent/10 text-accent">
                                                <Crown className="w-3 h-3" />
                                                {t('trips.owner', 'Owner')}
                                            </span>
                                        ) : canManage ? (
                                            <>
                                                {/* Role dropdown */}
                                                <div className="relative">
                                                    <select
                                                        className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs cursor-pointer focus:ring-2 focus:ring-accent focus:border-transparent"
                                                        value={member.role}
                                                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                                                        disabled={updatingMemberId === member.id}
                                                    >
                                                        <option value="editor">{t('sharing.canEdit', 'Can edit')}</option>
                                                        <option value="viewer">{t('sharing.canView', 'Can view')}</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                                                    {updatingMemberId === member.id && (
                                                        <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-lg flex items-center justify-center">
                                                            <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Remove button */}
                                                <button
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    disabled={removingMemberId === member.id}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title={t('sharing.remove', 'Remove')}
                                                >
                                                    {removingMemberId === member.id ? (
                                                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <UserMinus className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </>
                                        ) : (
                                            <span className={`
                        text-xs px-2.5 py-1.5 rounded-full
                        ${member.role === 'editor'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                                                }
                      `}>
                                                {member.role === 'editor'
                                                    ? t('sharing.canEdit', 'Can edit')
                                                    : t('sharing.canView', 'Can view')
                                                }
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ShareModal;
