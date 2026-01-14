// client/src/components/trips/DocumentPanel.jsx
import React, { useState, useMemo, useRef } from 'react';
import { FileText, Download, Eye, ChevronLeft, Image, File, Lock, Users, Upload, Plus, X, Trash2 } from 'lucide-react';
import { documentAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import PDFViewerModal from './PDFViewerModal';

const DocumentPanel = ({
    documents = [],
    referenceType,
    referenceId,
    tripId,
    itemName,
    isOfflineMode = false,
    onClose,
    onDocumentsChange, // Callback to refresh documents after upload/delete
    canEdit = true,
}) => {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);

    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
    const [currentPdfBlob, setCurrentPdfBlob] = useState(null);
    const [currentPdfName, setCurrentPdfName] = useState('');
    const [currentDocumentId, setCurrentDocumentId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Upload state
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [isPersonalDocument, setIsPersonalDocument] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Split documents into shared and personal
    const { sharedDocs, personalDocs } = useMemo(() => {
        const shared = [];
        const personal = [];
        documents.forEach(doc => {
            if (doc.is_personal) {
                personal.push(doc);
            } else {
                shared.push(doc);
            }
        });
        return { sharedDocs: shared, personalDocs: personal };
    }, [documents]);

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
            setShowUploadForm(true);
        }
    };

    // Handle document upload
    const handleUpload = async () => {
        if (!uploadFile || !referenceType || !referenceId) return;

        try {
            setIsUploading(true);

            const formData = new FormData();
            formData.append('document', uploadFile);
            formData.append('reference_type', referenceType);
            formData.append('reference_id', referenceId);
            formData.append('is_personal', isPersonalDocument ? 'true' : 'false');

            await documentAPI.uploadDocument(formData);
            toast.success(t('documents.uploadSuccess'));

            // Reset upload form
            setUploadFile(null);
            setIsPersonalDocument(false);
            setShowUploadForm(false);

            // Refresh documents
            if (onDocumentsChange) {
                onDocumentsChange();
            }
        } catch (error) {
            console.error('Error uploading document:', error);
            toast.error(error.response?.data?.message || t('errors.saveFailed', { item: t('documents.title').toLowerCase() }));
        } finally {
            setIsUploading(false);
        }
    };

    // Handle document deletion
    const handleDeleteDocument = async (documentId) => {
        if (!confirm(t('common.confirmDelete'))) return;

        try {
            setIsLoading(true);
            await documentAPI.deleteDocument(documentId, tripId);
            toast.success(t('documents.deleteSuccess'));

            // Refresh documents
            if (onDocumentsChange) {
                onDocumentsChange();
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            toast.error(t('errors.deleteFailed', { item: t('documents.title').toLowerCase() }));
        } finally {
            setIsLoading(false);
        }
    };

    // Cancel upload
    const cancelUpload = () => {
        setUploadFile(null);
        setIsPersonalDocument(false);
        setShowUploadForm(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle viewing a document
    const handleViewDocument = async (doc) => {
        try {
            setIsLoading(true);

            // Only PDF files can be viewed in the viewer
            if (doc.file_type && doc.file_type.includes('pdf')) {
                if (doc.blob) {
                    setCurrentPdfBlob(doc.blob);
                    setCurrentPdfName(doc.file_name);
                    setCurrentDocumentId(doc.id);
                    setIsPdfViewerOpen(true);
                } else {
                    const response = await documentAPI.viewDocumentAsBlob(doc.id);
                    setCurrentPdfBlob(response.data);
                    setCurrentPdfName(doc.file_name);
                    setCurrentDocumentId(doc.id);
                    setIsPdfViewerOpen(true);
                }
            } else if (doc.file_type && doc.file_type.includes('image')) {
                // For images, show preview
                if (doc.blob) {
                    const url = URL.createObjectURL(doc.blob);
                    setPreviewUrl(url);
                    setPreviewDoc(doc);
                } else {
                    const response = await documentAPI.viewDocumentAsBlob(doc.id);
                    const url = URL.createObjectURL(response.data);
                    setPreviewUrl(url);
                    setPreviewDoc(doc);
                }
            } else {
                // For other files, download
                await handleDownloadDocument(doc.id, doc.file_name);
            }
        } catch (error) {
            console.error('Error viewing document:', error);
            toast.error(t('documents.viewFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    // Handle downloading a document
    const handleDownloadDocument = async (documentId, fileName) => {
        try {
            setIsLoading(true);

            if (isOfflineMode) {
                const offlineDoc = documents.find(doc => doc.id === documentId);
                if (offlineDoc && offlineDoc.blob) {
                    const downloadUrl = window.URL.createObjectURL(offlineDoc.blob);
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(downloadUrl);
                    return;
                }
            }

            const response = await documentAPI.downloadDocument(documentId);
            const blob = new Blob([response.data]);
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Error downloading document:', error);
            toast.error(t('documents.downloadFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const getFileIcon = (fileType) => {
        if (fileType && fileType.includes('pdf')) {
            return <FileText className="w-8 h-8 text-red-500" />;
        } else if (fileType && (fileType.includes('doc') || fileType.includes('word'))) {
            return <FileText className="w-8 h-8 text-blue-500" />;
        } else if (fileType && fileType.includes('image')) {
            return <Image className="w-8 h-8 text-green-500" />;
        }
        return <File className="w-8 h-8 text-purple-500" />;
    };

    const getFileColor = (fileType, isPersonal = false) => {
        if (isPersonal) {
            return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
        }
        if (fileType && fileType.includes('pdf')) return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800';
        if (fileType && (fileType.includes('doc') || fileType.includes('word'))) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800';
        if (fileType && fileType.includes('image')) return 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800';
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800';
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setPreviewDoc(null);
    };

    // Check if file can be previewed
    const canPreview = (fileType) => {
        if (!fileType) return false;
        return fileType.includes('pdf') || fileType.includes('image');
    };

    // Render a document card
    const renderDocumentCard = (doc, isPersonal = false) => (
        <div
            key={doc.id}
            className={`
                group relative rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer
                ${getFileColor(doc.file_type, isPersonal)}
            `}
            onClick={() => handleViewDocument(doc)}
        >
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm relative">
                    {getFileIcon(doc.file_type)}
                    {isPersonal && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                            <Lock className="w-3 h-3 text-white" />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate pr-8">
                        {doc.file_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(doc.created_at).toLocaleDateString()}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                        {canPreview(doc.file_type) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDocument(doc);
                                }}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                {t('documents.view', 'View')}
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadDocument(doc.id, doc.file_name);
                            }}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {t('documents.download', 'Download')}
                        </button>
                        {canEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDocument(doc.id);
                                }}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Render a section of documents
    const renderSection = (title, description, docs, icon, isPersonal = false) => (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                {icon}
                <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                </div>
            </div>
            {docs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {docs.map(doc => renderDocumentCard(doc, isPersonal))}
                </div>
            ) : (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                    {isPersonal ? t('documents.noPersonalDocuments') : t('documents.noSharedDocuments')}
                </div>
            )}
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            {t('documents.title', 'Documents')}
                        </h2>
                        {itemName && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {itemName}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {documents.length} {documents.length === 1 ? t('documents.file', 'file') : t('documents.files', 'files')}
                    </span>
                    {canEdit && !isOfflineMode && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                {t('documents.upload', 'Upload')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Upload Form */}
            {showUploadForm && uploadFile && (
                <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <div className="space-y-4">
                        {/* File preview */}
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-medium truncate max-w-xs">{uploadFile.name}</span>
                            </div>
                            <button
                                type="button"
                                onClick={cancelUpload}
                                className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-800"
                            >
                                <X className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </button>
                        </div>

                        {/* Personal/Shared Toggle */}
                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setIsPersonalDocument(false)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${!isPersonalDocument
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                <span>{t('budget.shared', 'Shared')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsPersonalDocument(true)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${isPersonalDocument
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                            >
                                <Lock className="w-4 h-4" />
                                <span>{t('budget.personal', 'Personal')}</span>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isPersonalDocument
                                ? t('documents.personalDescription', 'Only visible to you')
                                : t('documents.sharedDescription', 'Visible to all trip members')
                            }
                        </p>

                        {/* Upload button */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={cancelUpload}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                {t('documents.upload', 'Upload')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {previewDoc && previewUrl ? (
                    // Image preview
                    <div className="space-y-4">
                        <button
                            onClick={closePreview}
                            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            {t('common.back', 'Back to documents')}
                        </button>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg">
                            <img
                                src={previewUrl}
                                alt={previewDoc.file_name}
                                className="w-full h-auto"
                            />
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {previewDoc.file_name}
                            </span>
                            <button
                                onClick={() => handleDownloadDocument(previewDoc.id, previewDoc.file_name)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                {t('documents.download', 'Download')}
                            </button>
                        </div>
                    </div>
                ) : documents.length === 0 && !showUploadForm ? (
                    // Empty state
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            {t('documents.noDocuments', 'No documents attached')}
                        </p>
                        {canEdit && !isOfflineMode && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                {t('documents.upload', 'Upload Document')}
                            </button>
                        )}
                    </div>
                ) : (
                    // Document sections
                    <div className="space-y-8">
                        {/* Shared Documents Section */}
                        {renderSection(
                            t('documents.shared', 'Shared Documents'),
                            t('documents.sharedDescription', 'Visible to all trip members'),
                            sharedDocs,
                            <Users className="w-5 h-5 text-blue-500" />,
                            false
                        )}

                        {/* Personal Documents Section */}
                        {personalDocs.length > 0 && (
                            <>
                                <div className="border-t border-gray-200 dark:border-gray-700" />
                                {renderSection(
                                    t('documents.personal', 'Personal Documents'),
                                    t('documents.personalDescription', 'Only visible to you'),
                                    personalDocs,
                                    <Lock className="w-5 h-5 text-amber-500" />,
                                    true
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* PDF Viewer Modal */}
            <PDFViewerModal
                isOpen={isPdfViewerOpen}
                onClose={() => setIsPdfViewerOpen(false)}
                documentBlob={currentPdfBlob}
                documentName={currentPdfName}
                onDownload={() => {
                    if (currentDocumentId) {
                        handleDownloadDocument(currentDocumentId, currentPdfName);
                    }
                }}
            />
        </div>
    );
};

export default DocumentPanel;
