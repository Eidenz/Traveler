// client/src/components/trips/DocumentsModal.jsx
import React, { useState, useMemo } from 'react';
import { FileText, Download, Eye, Info, ExternalLink, X, Lock, Users, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import PDFViewerModal from './PDFViewerModal';
import { documentAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const DocumentsModal = ({
  isOpen,
  onClose,
  documents = [],
  referenceType,
  referenceId,
  tripId,
  isOfflineMode = false,
  onDocumentsChange, // Callback to refresh documents after delete
  canEdit = true,
}) => {
  const { t } = useTranslation();
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState(null);
  const [currentPdfName, setCurrentPdfName] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // Handle viewing a document
  const handleViewDocument = async (doc) => {
    try {
      setIsLoading(true);

      // Only PDF files can be viewed in the viewer
      if (doc.file_type && doc.file_type.includes('pdf')) {
        // If document already has a blob (from offline storage), use it
        if (doc.blob) {
          setCurrentPdfBlob(doc.blob);
          setCurrentPdfName(doc.file_name);
          setCurrentDocumentId(doc.id);
          setIsPdfViewerOpen(true);
        } else {
          // Otherwise fetch it from the server
          const response = await documentAPI.viewDocumentAsBlob(doc.id);
          setCurrentPdfBlob(response.data);
          setCurrentPdfName(doc.file_name);
          setCurrentDocumentId(doc.id);
          setIsPdfViewerOpen(true);
        }
      } else {
        // For non-PDF files, just download
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

      // For offline mode with blob already available
      if (isOfflineMode) {
        const offlineDoc = documents.find(doc => doc.id === documentId);
        if (offlineDoc && offlineDoc.blob) {
          // Create download from the blob
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

      // Online mode - fetch from server
      const response = await documentAPI.downloadDocument(documentId);

      // Create blob from response data
      const blob = new Blob([response.data]);

      // Create download link and trigger click
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL object
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error(t('documents.downloadFailed'));
    } finally {
      setIsLoading(false);
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

  const getFileTypeIcon = (fileType, isPersonal = false) => {
    const bgColor = isPersonal
      ? 'bg-amber-100 dark:bg-amber-900/30'
      : fileType && fileType.includes('pdf')
        ? 'bg-red-100 dark:bg-red-900/30'
        : fileType && (fileType.includes('doc') || fileType.includes('word'))
          ? 'bg-blue-100 dark:bg-blue-900/30'
          : fileType && fileType.includes('image')
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-purple-100 dark:bg-purple-900/30';

    const iconColor = isPersonal
      ? 'text-amber-600 dark:text-amber-400'
      : fileType && fileType.includes('pdf')
        ? 'text-red-600 dark:text-red-400'
        : fileType && (fileType.includes('doc') || fileType.includes('word'))
          ? 'text-blue-600 dark:text-blue-400'
          : fileType && fileType.includes('image')
            ? 'text-green-600 dark:text-green-400'
            : 'text-purple-600 dark:text-purple-400';

    return (
      <div className={`p-2 rounded-lg ${bgColor} relative`}>
        <FileText className={`h-5 w-5 ${iconColor}`} />
        {isPersonal && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
            <Lock className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
    );
  };

  // Check if file can be previewed
  const canPreview = (fileType) => {
    if (!fileType) return false;
    return fileType.includes('pdf') || fileType.includes('image');
  };

  // Render a single document item
  const renderDocumentItem = (doc, isPersonal = false) => (
    <div
      key={doc.id}
      className={`p-3 sm:p-4 rounded-lg transition-all hover:shadow-md animate-fade-in ${isPersonal
        ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800'
        : 'bg-gray-50 dark:bg-gray-800'
        }`}
    >
      {/* Document info row */}
      <div className="flex items-start gap-3">
        {getFileTypeIcon(doc.file_type, isPersonal)}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {doc.file_name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(doc.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-3 pl-11">
        {canPreview(doc.file_type) && (
          <button
            disabled={isLoading}
            onClick={() => handleViewDocument(doc)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <Eye size={16} />
            <span className="hidden sm:inline">{t('documents.view')}</span>
          </button>
        )}
        <button
          disabled={isLoading}
          onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          <span className="hidden sm:inline">{t('documents.download')}</span>
        </button>
        {canEdit && !isOfflineMode && (
          <button
            disabled={isLoading}
            onClick={() => handleDeleteDocument(doc.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">{t('common.delete', 'Delete')}</span>
          </button>
        )}
      </div>
    </div>
  );

  // Render a section of documents
  const renderSection = (title, description, docs, icon, isPersonal = false) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      {docs.length > 0 ? (
        <div className="space-y-2">
          {docs.map(doc => renderDocumentItem(doc, isPersonal))}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">
          {isPersonal ? t('documents.noPersonalDocuments') : t('documents.noSharedDocuments')}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('documents.attachedDocuments')}
        size="md"
      >
        <div className="p-6">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Info className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {t('documents.noDocuments')}
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
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

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={onClose}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={isPdfViewerOpen}
        onClose={() => {
          setIsPdfViewerOpen(false);
          // Important: Don't close the parent DocumentsModal when closing the PDF viewer
        }}
        documentBlob={currentPdfBlob}
        documentName={currentPdfName}
        onDownload={() => {
          if (currentDocumentId) {
            handleDownloadDocument(currentDocumentId, currentPdfName);
          }
        }}
      />
    </>
  );
};

export default DocumentsModal;
