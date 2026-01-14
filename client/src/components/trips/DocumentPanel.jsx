// client/src/components/trips/DocumentPanel.jsx
import React, { useState } from 'react';
import { FileText, Download, Eye, X, ChevronLeft, ExternalLink, Image, File } from 'lucide-react';
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
}) => {
    const { t } = useTranslation();
    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
    const [currentPdfBlob, setCurrentPdfBlob] = useState(null);
    const [currentPdfName, setCurrentPdfName] = useState('');
    const [currentDocumentId, setCurrentDocumentId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

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

    const getFileColor = (fileType) => {
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
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {documents.length} {documents.length === 1 ? t('documents.file', 'file') : t('documents.files', 'files')}
                </span>
            </div>

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
                ) : documents.length === 0 ? (
                    // Empty state
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                            {t('documents.noDocuments', 'No documents attached')}
                        </p>
                    </div>
                ) : (
                    // Document grid
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {documents.map(doc => (
                            <div
                                key={doc.id}
                                className={`
                  group relative rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer
                  ${getFileColor(doc.file_type)}
                `}
                                onClick={() => handleViewDocument(doc)}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                                        {getFileIcon(doc.file_type)}
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
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
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
