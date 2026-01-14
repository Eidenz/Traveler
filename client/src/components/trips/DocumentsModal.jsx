// client/src/components/trips/DocumentsModal.jsx
import React, { useState } from 'react';
import { FileText, Download, Eye, Info, ExternalLink, X } from 'lucide-react';
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
  isOfflineMode = false
}) => {
  const { t } = useTranslation();
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [currentPdfBlob, setCurrentPdfBlob] = useState(null);
  const [currentPdfName, setCurrentPdfName] = useState('');
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const getFileTypeIcon = (fileType) => {
    if (fileType && fileType.includes('pdf')) {
      return (
        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
          <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
      );
    } else if (fileType && (fileType.includes('doc') || fileType.includes('word'))) {
      return (
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
      );
    } else if (fileType && fileType.includes('image')) {
      return (
        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
          <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
      );
    }
  };

  // Check if file can be previewed
  const canPreview = (fileType) => {
    if (!fileType) return false;
    return fileType.includes('pdf') || fileType.includes('image');
  };

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
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg transition-all hover:shadow-md animate-fade-in"
                >
                  <div className="flex items-center">
                    {getFileTypeIcon(doc.file_type)}
                    <div className="ml-3">
                      <div className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                        {doc.file_name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {canPreview(doc.file_type) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleViewDocument(doc)}
                        icon={<Eye size={16} />}
                      >
                        {t('documents.view')}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                      icon={<Download size={16} />}
                    >
                      {t('documents.download')}
                    </Button>
                  </div>
                </div>
              ))}
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