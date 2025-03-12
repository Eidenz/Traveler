// Updated PDFViewerModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Download, FileText, RotateCw } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const PDFViewerModal = ({ 
  isOpen, 
  onClose, 
  documentBlob, // Changed from documentUrl to documentBlob
  documentName,
  onDownload 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Create a blob URL from the document blob when the component mounts or when documentBlob changes
  useEffect(() => {
    if (documentBlob) {
      // Create a blob URL from the document blob
      const url = URL.createObjectURL(documentBlob);
      setPdfUrl(url);
      
      // Clean up the blob URL when the component unmounts
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [documentBlob]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={documentName || "View Document"}
      size="xl"
    >
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-red-500 mr-2" />
          <span className="font-medium truncate max-w-md">{documentName}</span>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownload}
            icon={<Download className="h-4 w-4" />}
          >
            Download
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
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 z-10">
            <div className="flex flex-col items-center">
              <RotateCw className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <span className="text-gray-600 dark:text-gray-300">Loading document...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <FileText className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Unable to display document
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              The document could not be displayed in the browser. You can download it instead.
            </p>
            <Button
              variant="primary"
              onClick={onDownload}
              icon={<Download className="h-5 w-5" />}
            >
              Download Document
            </Button>
          </div>
        ) : (
          pdfUrl && (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
              className="w-full h-[70vh]"
              onLoad={handleLoad}
              onError={handleError}
            />
          )
        )}
      </div>
    </Modal>
  );
};

export default PDFViewerModal;