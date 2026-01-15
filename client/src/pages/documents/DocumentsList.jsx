import React, { useState, useEffect, useRef } from 'react';
import { documentAPI, activityAPI, transportAPI, lodgingAPI } from '../../services/api';
import { FileText, Download, Eye, Image, File, Lock, Users, Briefcase, Map, Home, Plus, X, Trash2, Link as LinkIcon, AlertCircle, Search, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import PDFViewerModal from '../../components/trips/PDFViewerModal';
import Button from '../../components/ui/Button';

// Simple Searchable Select Component
const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    // Filter options based on search
    const filteredOptions = options.filter(item => {
        const name = item.name || item.type || 'Unnamed';
        return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const selectedItem = options.find(item => item.id == value);

    useEffect(() => {
        // Click outside to close
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (item) => {
        onChange(item.id);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2.5 flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-accent focus-within:border-accent"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex-1 truncate">
                    {selectedItem ? (
                        <span>
                            {selectedItem.name || selectedItem.type || 'Unnamed Item'}
                            {selectedItem.date && <span className="opacity-50 ml-1">({new Date(selectedItem.date).toLocaleDateString()})</span>}
                            {selectedItem.departure_date && <span className="opacity-50 ml-1">({new Date(selectedItem.departure_date).toLocaleDateString()})</span>}
                        </span>
                    ) : (
                        <span className="text-gray-400">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <div className="sticky top-0 p-2 bg-white dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                autoFocus
                                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border-none rounded-md focus:ring-1 focus:ring-accent text-gray-900 dark:text-white"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white ${item.id == value ? 'bg-accent/10 text-accent dark:text-accent' : ''}`}
                                >
                                    <div className="font-medium">{item.name || item.type || 'Unnamed Item'}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {item.date && new Date(item.date).toLocaleDateString()}
                                        {item.departure_date && new Date(item.departure_date).toLocaleDateString()}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                No items found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const DocumentsList = ({ tripId, trip }) => {
    const { t } = useTranslation();
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Linkable items
    const [activities, setActivities] = useState([]);
    const [transportation, setTransportation] = useState([]);
    const [lodging, setLodging] = useState([]);

    // Viewing State
    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
    const [currentPdfBlob, setCurrentPdfBlob] = useState(null);
    const [currentPdfName, setCurrentPdfName] = useState('');
    const [currentDocumentId, setCurrentDocumentId] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Upload State
    const fileInputRef = useRef(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [isPersonal, setIsPersonal] = useState(false);

    // Linking State
    const [linkingDoc, setLinkingDoc] = useState(null); // Document being linked
    const [linkCategory, setLinkCategory] = useState('activity');
    const [linkItemId, setLinkItemId] = useState('');

    useEffect(() => {
        if (tripId) {
            fetchAllData();
        }
    }, [tripId]);

    const fetchAllData = async () => {
        try {
            setIsLoading(true);
            const [docsRes, actRes, transRes, lodgRes] = await Promise.all([
                documentAPI.getAllTripDocuments(tripId),
                activityAPI.getTripActivities(tripId),
                transportAPI.getTripTransportation(tripId),
                lodgingAPI.getTripLodging(tripId)
            ]);

            setDocuments(docsRes.data.documents);
            setActivities(actRes.data.activities);
            setTransportation(transRes.data.transportation);
            setLodging(lodgRes.data.lodging);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error(t('errors.fetchFailed', 'Failed to fetch documents'));
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDocuments = async () => {
        try {
            const response = await documentAPI.getAllTripDocuments(tripId);
            setDocuments(response.data.documents);
        } catch (error) {
            console.error('Error fetching documents:', error);
        }
    };

    // Grouping Documents
    // "Trip" documents are now effectively "Unlinked" or "General"
    const groupedDocs = {
        trip: documents.filter(d => d.reference_type === 'trip'),
        activity: documents.filter(d => d.reference_type === 'activity'),
        transportation: documents.filter(d => d.reference_type === 'transportation'),
        lodging: documents.filter(d => d.reference_type === 'lodging'),
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadFile(file);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('document', uploadFile);
            formData.append('reference_type', 'trip'); // Uploading to General Trip Docs
            formData.append('reference_id', tripId);
            formData.append('is_personal', isPersonal);

            await documentAPI.uploadDocument(formData);
            toast.success(t('documents.uploadSuccess', 'Document uploaded successfully'));
            setUploadFile(null);
            setIsPersonal(false);
            fetchDocuments();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(t('errors.uploadFailed', 'Failed to upload document'));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm(t('common.confirmDelete', 'Are you sure you want to delete this document?'))) return;
        try {
            await documentAPI.deleteDocument(docId, tripId);
            toast.success(t('documents.deleteSuccess', 'Document deleted'));
            fetchDocuments();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error(t('errors.deleteFailed', 'Failed to delete document'));
        }
    };

    const handleDownload = async (docId, fileName) => {
        try {
            const response = await documentAPI.downloadDocument(docId);
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
            toast.error(t('errors.downloadFailed', 'Download failed'));
        }
    };

    const handleView = async (doc) => {
        try {
            setViewLoading(true);
            if (doc.file_type && doc.file_type.includes('pdf')) {
                const response = await documentAPI.viewDocumentAsBlob(doc.id);
                setCurrentPdfBlob(response.data);
                setCurrentPdfName(doc.file_name);
                setCurrentDocumentId(doc.id);
                setIsPdfViewerOpen(true);
            } else if (doc.file_type && doc.file_type.includes('image')) {
                const response = await documentAPI.viewDocumentAsBlob(doc.id);
                const url = URL.createObjectURL(response.data);
                setPreviewUrl(url);
            } else {
                handleDownload(doc.id, doc.file_name);
            }
        } catch (error) {
            toast.error(t('errors.viewFailed', 'Could not view document'));
        } finally {
            setViewLoading(false);
        }
    };

    const openLinkModal = (doc) => {
        setLinkingDoc(doc);
        setLinkCategory('activity'); // Default
        setLinkItemId('');
    };

    const handleLinkDocument = async () => {
        if (!linkingDoc || !linkCategory || !linkItemId) return;

        try {
            await documentAPI.updateDocument(linkingDoc.id, {
                reference_type: linkCategory,
                reference_id: linkItemId,
                trip_id: tripId
            });
            toast.success('Document linked successfully');
            setLinkingDoc(null);
            fetchDocuments();
        } catch (error) {
            console.error('Link error:', error);
            toast.error('Failed to link document');
        }
    };

    // Get list of items based on selected category
    const getLinkOptions = () => {
        switch (linkCategory) {
            case 'activity': return activities;
            case 'transportation': return transportation;
            case 'lodging': return lodging;
            default: return [];
        }
    };

    const getFileIcon = (fileType) => {
        if (fileType && fileType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />;
        if (fileType && (fileType.includes('doc') || fileType.includes('word'))) return <FileText className="w-8 h-8 text-blue-500" />;
        if (fileType && fileType.includes('image')) return <Image className="w-8 h-8 text-green-500" />;
        return <File className="w-8 h-8 text-purple-500" />;
    };

    const DocumentCard = ({ doc, isUnlinked = false }) => (
        <div className="group relative rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all bg-white dark:bg-gray-800">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center relative">
                    {getFileIcon(doc.file_type)}
                    {doc.is_personal ? (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                            <Lock className="w-2.5 h-2.5 text-white" />
                        </div>
                    ) : <></>}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate" title={doc.file_name}>
                        {doc.file_name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                        {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        {(doc.file_type.includes('pdf') || doc.file_type.includes('image')) && (
                            <button onClick={() => handleView(doc)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500" title="View">
                                <Eye className="w-4 h-4" />
                            </button>
                        )}
                        <button onClick={() => handleDownload(doc.id, doc.file_name)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500" title="Download">
                            <Download className="w-4 h-4" />
                        </button>

                        {/* Only allow linking if it is unlinked OR allows moving. Currently focusing on unlinked. */}
                        {isUnlinked && (
                            <button onClick={() => openLinkModal(doc)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded text-blue-500" title="Link to item">
                                <LinkIcon className="w-4 h-4" />
                            </button>
                        )}

                        <button onClick={() => handleDelete(doc.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-500" title="Delete">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const Section = ({ title, icon: Icon, docs, description, isUnlinked = false }) => (
        <div className="mb-8">
            <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 rounded-lg mt-1 ${isUnlinked ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-accent-soft text-accent'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {title}
                        <span className="text-sm font-normal text-gray-500">({docs.length})</span>
                    </h3>
                    {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                </div>
            </div>
            {docs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docs.map(doc => <DocumentCard key={doc.id} doc={doc} isUnlinked={isUnlinked} />)}
                </div>
            ) : (
                <p className="text-gray-500 text-sm italic ml-11">No documents in this category</p>
            )}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Image Preview Overlay */}
            {previewUrl && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                        <X className="w-8 h-8" />
                    </button>
                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
                </div>
            )}

            {/* Link Modal */}
            {linkingDoc && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setLinkingDoc(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Link Document
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Select where you want to attach <strong>{linkingDoc.file_name}</strong>.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Category
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['activity', 'transportation', 'lodging'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => { setLinkCategory(cat); setLinkItemId(''); }}
                                            className={`py-2 px-3 text-sm font-medium rounded-lg capitalize border ${linkCategory === cat
                                                ? 'bg-accent text-white border-accent'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Select Item
                                </label>
                                <SearchableSelect
                                    options={getLinkOptions()}
                                    value={linkItemId}
                                    onChange={setLinkItemId}
                                    placeholder={`Select ${linkCategory}...`}
                                />
                                {getLinkOptions().length === 0 && (
                                    <p className="text-xs text-amber-500 mt-1">No items found for this category.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="outline" onClick={() => setLinkingDoc(null)}>Cancel</Button>
                            <Button onClick={handleLinkDocument} disabled={!linkItemId}>Save</Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-gray-900 dark:text-white">
                            {trip.name} Documents
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Organize your files. Unlinked files will appear in the top section.
                        </p>
                    </div>
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover transition-colors font-medium shadow-lg shadow-accent/20"
                        >
                            <Plus className="w-5 h-5" />
                            {t('documents.upload', 'Upload Document')}
                        </button>
                    </div>
                </div>

                {/* Upload Confirmation */}
                {uploadFile && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-accent" />
                                <span className="font-medium text-gray-900 dark:text-white">{uploadFile.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsPersonal(!isPersonal)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isPersonal
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    {isPersonal ? <Lock className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                                    {isPersonal ? 'Personal' : 'Shared'}
                                </button>
                                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                                <button
                                    onClick={() => setUploadFile(null)}
                                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="px-4 py-1.5 bg-accent text-white rounded-lg hover:bg-accent-hover text-sm font-medium disabled:opacity-50"
                                >
                                    {uploading ? 'Uploading...' : 'Confirm Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto space-y-8">
                        <Section
                            title="Unlinked / General Documents"
                            description="Files not attached to any specific activity. You can link them using the link icon."
                            icon={AlertCircle}
                            docs={groupedDocs.trip}
                            isUnlinked={true}
                        />

                        <div className="border-t border-gray-200 dark:border-gray-700 my-8" />

                        <Section
                            title="Activity Documents"
                            icon={FileText}
                            docs={groupedDocs.activity}
                        />
                        <Section
                            title="Transportation Documents"
                            icon={Map}
                            docs={groupedDocs.transportation}
                        />
                        <Section
                            title="Lodging Documents"
                            icon={Home}
                            docs={groupedDocs.lodging}
                        />
                    </div>
                )}
            </div>

            <PDFViewerModal
                isOpen={isPdfViewerOpen}
                onClose={() => setIsPdfViewerOpen(false)}
                documentBlob={currentPdfBlob}
                documentName={currentPdfName}
                onDownload={() => currentDocumentId && handleDownload(currentDocumentId, currentPdfName)}
            />
        </div>
    );
};

export default DocumentsList;
