// client/src/components/trips/PDFViewerModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Download, FileText, RotateCw, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';

const PDFViewerModal = ({ 
  isOpen, 
  onClose, 
  documentBlob,
  documentName,
  onDownload 
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if on mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())) {
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Create blob URL from document blob
  useEffect(() => {
    if (documentBlob) {
      try {
        const url = URL.createObjectURL(documentBlob);
        setPdfUrl(url);
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error("Error creating PDF URL:", err);
        setError(true);
        setLoading(false);
      }
    }
  }, [documentBlob]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 20, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 20, 60));
  };
  
  // For mobile: directly open PDF in new tab/window
  const openInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  // Different rendering based on mobile vs desktop
  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center text-center p-8">
          <FileText className="h-16 w-16 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('documents.viewFailed')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('documents.downloadInstead')}
          </p>
          <Button
            variant="primary"
            onClick={onDownload}
            icon={<Download className="h-5 w-5" />}
          >
            {t('common.download')}
          </Button>
        </div>
      );
    }
    
    if (isMobile) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <FileText className="h-16 w-16 text-blue-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {documentName}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            PDFs open better in your device's native viewer.
          </p>
          <div className="flex space-x-3">
            <Button
              variant="primary"
              onClick={openInNewTab}
              icon={<ExternalLink className="h-5 w-5" />}
            >
              Open in Browser
            </Button>
            <Button
              variant="secondary"
              onClick={onDownload}
              icon={<Download className="h-5 w-5" />}
            >
              Download
            </Button>
          </div>
        </div>
      );
    }
    
    // Desktop view
    return (
      <div className="relative w-full h-[70vh] bg-white">
        <object
          data={pdfUrl}
          type="application/pdf"
          className="w-full h-full"
          style={{ zoom: `${zoom}%` }}
          onLoad={handleLoad}
          onError={handleError}
        >
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            onLoad={handleLoad}
            onError={handleError}
          >
            <p className="text-center mt-4">
              {t('documents.viewFailed')}
            </p>
          </iframe>
        </object>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={documentName || t('documents.title')}
      size="xl"
    >
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-red-500 mr-2" />
          <span className="font-medium truncate max-w-md">{documentName}</span>
        </div>
        <div className="flex space-x-2">
          {!isMobile && (
            <div className="flex items-center space-x-1 mr-2">
              <button
                onClick={handleZoomOut}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">{zoom}%</span>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownload}
            icon={<Download className="h-4 w-4" />}
          >
            {t('common.download', 'Download')}
          </Button>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="relative bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center min-h-[70vh] overflow-hidden">
        {loading && !isMobile && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
            <div className="flex flex-col items-center">
              <RotateCw className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <span className="text-gray-600 dark:text-gray-300">{t('common.loading')}</span>
            </div>
          </div>
        )}

        {renderContent()}
      </div>
    </Modal>
  );
};

export default PDFViewerModal;