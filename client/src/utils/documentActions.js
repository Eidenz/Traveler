// client/src/utils/documentActions.js
// Shared view/download behavior for documents. DocumentPanel, DocumentsModal
// and DocumentsList all present the same document types and must treat them
// identically:
//
//   link  -> open doc.url in a new tab
//   pdf   -> hand the blob to the PDF viewer (onPdf)
//   image -> hand an object URL to a preview overlay (onImagePreview)
//   other -> download
//
// Offline-stored documents carry their data as `doc.blob`; when present it is
// used instead of fetching. Callers that receive an object URL via
// onImagePreview own it and must pass it to revokePreviewUrl() when the
// preview closes, or the blob leaks for the lifetime of the page.

import { documentAPI } from '../services/api';

const triggerBlobDownload = (blob, fileName) => {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};

export async function downloadDocument(documentId, fileName, { blob } = {}) {
  if (blob) {
    triggerBlobDownload(blob, fileName);
    return;
  }
  const response = await documentAPI.downloadDocument(documentId);
  triggerBlobDownload(new Blob([response.data]), fileName);
}

const getViewBlob = async (doc, offlineBlob) => {
  if (offlineBlob) return offlineBlob;
  const response = await documentAPI.viewDocumentAsBlob(doc.id);
  return response.data;
};

export async function viewDocument(doc, { blob, onPdf, onImagePreview } = {}) {
  if (doc.file_type === 'link') {
    if (doc.url) {
      window.open(doc.url, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  if (doc.file_type && doc.file_type.includes('pdf') && onPdf) {
    onPdf(await getViewBlob(doc, blob), doc);
    return;
  }

  if (doc.file_type && doc.file_type.includes('image') && onImagePreview) {
    onImagePreview(URL.createObjectURL(await getViewBlob(doc, blob)), doc);
    return;
  }

  // Anything else (or a type the caller has no viewer for) downloads
  await downloadDocument(doc.id, doc.file_name, { blob });
}

export const revokePreviewUrl = (url) => {
  if (url) {
    URL.revokeObjectURL(url);
  }
};

// Toast text for a failed document upload. A 413 means the per-user
// per-trip storage quota is full — say so instead of a generic failure.
export const uploadErrorMessage = (error, t, fallback) => {
  if (error?.response?.status === 413) {
    return t(
      'documents.quotaFull',
      'Storage limit reached — you have used your full upload quota for this trip. Delete some of your documents to free up space.'
    );
  }
  return error?.response?.data?.message || fallback;
};
