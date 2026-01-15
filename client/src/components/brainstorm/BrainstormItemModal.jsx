// client/src/components/brainstorm/BrainstormItemModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    X, MapPin, FileText, Image, Link2, Lightbulb,
    Upload, ExternalLink, Trash2
} from 'lucide-react';
import Button from '../ui/Button';

// Item type configuration
const ITEM_TYPES = {
    place: {
        icon: MapPin,
        label: 'Place',
        placeholder: 'Restaurant, monument, beach...',
        fields: ['title', 'location', 'content', 'url'],
    },
    note: {
        icon: FileText,
        label: 'Note',
        placeholder: 'Write your thoughts...',
        fields: ['title', 'content'],
    },
    image: {
        icon: Image,
        label: 'Image',
        placeholder: 'Add a caption...',
        fields: ['image', 'title', 'content', 'location'],
    },
    link: {
        icon: Link2,
        label: 'Link',
        placeholder: 'Paste a URL...',
        fields: ['url', 'title', 'content'],
    },
    idea: {
        icon: Lightbulb,
        label: 'Quick Idea',
        placeholder: 'Jot down a quick idea...',
        fields: ['content'],
    },
};

const BrainstormItemModal = ({
    isOpen,
    onClose,
    onSave,
    editingItem,
    defaultType = 'idea',
    defaultLocation = null,
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [type, setType] = useState(defaultType);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [url, setUrl] = useState('');
    const [locationName, setLocationName] = useState('');
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [urlPreview, setUrlPreview] = useState(null);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (editingItem && !editingItem.prefill) {
                // Editing existing item
                setType(editingItem.type);
                setTitle(editingItem.title || '');
                setContent(editingItem.content || '');
                setUrl(editingItem.url || '');
                setLocationName(editingItem.location_name || '');
                setLatitude(editingItem.latitude || null);
                setLongitude(editingItem.longitude || null);
                setImagePreview(editingItem.image_path || null);
                setImageFile(null);
            } else if (editingItem?.prefill) {
                // Prefilled data (e.g., from clipboard)
                setType(defaultType);
                setTitle(editingItem.prefill.title || '');
                setContent(editingItem.prefill.content || '');
                setUrl(editingItem.prefill.url || '');
                setLocationName('');
                setLatitude(null);
                setLongitude(null);
                setImagePreview(null);
                setImageFile(null);
            } else {
                // New item
                setType(defaultType);
                setTitle('');
                setContent('');
                setUrl('');
                setLocationName(defaultLocation?.location_name || '');
                setLatitude(defaultLocation?.latitude || null);
                setLongitude(defaultLocation?.longitude || null);
                setImagePreview(null);
                setImageFile(null);
            }
            setUrlPreview(null);
        }
    }, [isOpen, editingItem, defaultType, defaultLocation]);

    // Fetch URL preview when URL changes
    useEffect(() => {
        if (type === 'link' && url) {
            // Basic URL validation
            try {
                const urlObj = new URL(url);
                setUrlPreview({
                    domain: urlObj.hostname.replace('www.', ''),
                    url: url,
                });
            } catch {
                setUrlPreview(null);
            }
        } else {
            setUrlPreview(null);
        }
    }, [url, type]);

    // Handle image selection
    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle save
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const itemData = {
                type,
                title: title || null,
                content: content || null,
                url: url || null,
                location_name: locationName || null,
                latitude: latitude || null,
                longitude: longitude || null,
            };

            if (imageFile) {
                itemData.image = imageFile;
            }

            // If editing and removing image
            if (editingItem && !editingItem.prefill && editingItem.image_path && !imagePreview) {
                itemData.remove_image = 'true';
            }

            await onSave(itemData);
        } finally {
            setIsSaving(false);
        }
    };

    // Get fields for current type
    const typeConfig = ITEM_TYPES[type];
    const fields = typeConfig?.fields || [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {editingItem && !editingItem.prefill
                            ? t('brainstorm.editItem', 'Edit Item')
                            : t('brainstorm.addItem', 'Add Item')
                        }
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Type selector */}
                    {(!editingItem || editingItem.prefill) && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('brainstorm.itemType', 'Type')}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(ITEM_TYPES).map(([key, config]) => {
                                    const Icon = config.icon;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setType(key)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${type === key
                                                    ? 'border-accent bg-accent/5 text-accent'
                                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                                                }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="text-sm font-medium">{config.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Image upload */}
                    {fields.includes('image') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('brainstorm.image', 'Image')}
                            </label>
                            {imagePreview ? (
                                <div className="relative rounded-xl overflow-hidden">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full h-48 object-cover"
                                    />
                                    <button
                                        onClick={() => {
                                            setImageFile(null);
                                            setImagePreview(null);
                                        }}
                                        className="absolute top-2 right-2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-accent transition-colors"
                                >
                                    <Upload className="w-6 h-6 text-gray-400" />
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                        {t('brainstorm.uploadImage', 'Click to upload an image')}
                                    </span>
                                </button>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                        </div>
                    )}

                    {/* URL field */}
                    {fields.includes('url') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('brainstorm.url', 'URL')}
                            </label>
                            <div className="relative">
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="form-input pl-10"
                                />
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                            {urlPreview && (
                                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                        {urlPreview.domain}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Title field */}
                    {fields.includes('title') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('brainstorm.title', 'Title')}
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={typeConfig.placeholder}
                                className="form-input"
                            />
                        </div>
                    )}

                    {/* Content field */}
                    {fields.includes('content') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {type === 'idea'
                                    ? t('brainstorm.idea', 'Idea')
                                    : t('brainstorm.notes', 'Notes')
                                }
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder={typeConfig.placeholder}
                                rows={type === 'idea' ? 3 : 4}
                                className="form-input resize-none"
                            />
                        </div>
                    )}

                    {/* Location field */}
                    {fields.includes('location') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('brainstorm.location', 'Location')}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={locationName}
                                    onChange={(e) => setLocationName(e.target.value)}
                                    placeholder={t('brainstorm.locationPlaceholder', 'e.g., Paris, France')}
                                    className="form-input pl-10"
                                />
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            </div>
                            {latitude && longitude && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {t('brainstorm.coordinates', 'Coordinates')}: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving
                            ? t('common.saving', 'Saving...')
                            : editingItem && !editingItem.prefill
                                ? t('common.save', 'Save')
                                : t('common.add', 'Add')
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BrainstormItemModal;
