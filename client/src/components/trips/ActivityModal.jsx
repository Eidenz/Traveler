// client/src/components/trips/ActivityModal.jsx
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Coffee, Tag, Upload, X, Ticket, Image } from 'lucide-react';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { activityAPI, documentAPI } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

const ActivityModal = ({
  isOpen,
  onClose,
  tripId,
  activityId = null,
  onSuccess,
  initialData = null,
  defaultDate = null
}) => {
  const { t } = useTranslation();
  const isEditMode = !!activityId;

  const [formData, setFormData] = useState({
    name: '',
    date: new Date(),
    time: '',
    location: '',
    confirmation_code: '',
    notes: ''
  });

  const [bannerImage, setBannerImage] = useState(null);
  const [bannerImagePreview, setBannerImagePreview] = useState(null);
  const [existingBannerImage, setExistingBannerImage] = useState(null);

  const [documentFile, setDocumentFile] = useState(null);
  const [documentFileName, setDocumentFileName] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [removeBanner, setRemoveBanner] = useState(false);

  useEffect(() => {
    if (isOpen && isEditMode) {
      fetchActivity();
    } else if (isOpen && initialData) {
      // For pre-filled data (not edit mode)
      setFormData({
        ...formData,
        ...initialData
      });
      setBannerImage(null);
      setBannerImagePreview(null);
      setExistingBannerImage(initialData.banner_image || null);
    } else if (isOpen) {
      // Reset form for new activity
      // Use defaultDate if provided, otherwise use today
      const activityDate = defaultDate ? new Date(defaultDate) : new Date();
      setFormData({
        name: '',
        date: activityDate,
        time: '',
        location: '',
        confirmation_code: '',
        notes: ''
      });
      setBannerImage(null);
      setBannerImagePreview(null);
      setExistingBannerImage(null);
      setDocumentFile(null);
      setDocumentFileName('');
      setDocuments([]);
      setErrors({});
    }
  }, [isOpen, activityId, initialData, defaultDate]);

  const fetchActivity = async () => {
    try {
      setFetchLoading(true);
      const response = await activityAPI.getActivity(activityId);

      const activity = response.data.activity;
      const docs = response.data.documents || [];

      // Format date
      setFormData({
        name: activity.name || '',
        date: activity.date ? new Date(activity.date) : new Date(),
        time: activity.time || '',
        location: activity.location || '',
        confirmation_code: activity.confirmation_code || '',
        notes: activity.notes || ''
      });

      // Set existing banner image if available
      setExistingBannerImage(activity.banner_image || null);
      setBannerImagePreview(null);
      setBannerImage(null);

      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching activity:', error);
      toast.error(t('errors.loadFailed', { item: t('activities.title').toLowerCase() }));
    } finally {
      setFetchLoading(false);
    }
  };

  const handleBannerImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerImage(file);
      setBannerImagePreview(URL.createObjectURL(file));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error for this field when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (field, date) => {
    setFormData(prev => ({ ...prev, [field]: date }));

    // Clear error for this field when user selects a date
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDocumentChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDocumentFile(file);
      setDocumentFileName(file.name);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('errors.required', { field: t('activities.name') });
    }

    if (!formData.date) {
      newErrors.date = t('errors.required', { field: t('activities.date') });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (validateForm()) {
      try {
        setLoading(true);
  
        // Format dates for API
        const formattedData = {
          ...formData,
          date: formData.date
            ? dayjs(formData.date).format('YYYY-MM-DD')
            : null
        };
  
        // Add banner image to form data if selected
        if (bannerImage) {
          formattedData.banner_image = bannerImage;
        }
        
        // Add flag to remove banner if requested
        if (removeBanner || (!bannerImage && !existingBannerImage)) {
          formattedData.remove_banner = 'true';
        }
  
        let response;
  
        if (isEditMode) {
          response = await activityAPI.updateActivity(activityId, formattedData, tripId);
          toast.success(t('activities.updateSuccess', 'Activity updated successfully'));
        } else {
          response = await activityAPI.createActivity(tripId, formattedData);
          toast.success(t('activities.createSuccess', 'Activity added successfully'));
        }

        // Upload document if selected
        if (documentFile) {
          const documentData = new FormData();
          documentData.append('document', documentFile);
          documentData.append('reference_type', 'activity');
          documentData.append('reference_id', isEditMode ? activityId : response.data.activity.id);

          await documentAPI.uploadDocument(documentData);
          toast.success(t('documents.uploadSuccess'));
        }

        // Callback to refresh parent component
        if (onSuccess) {
          onSuccess();
        }

        onClose();
      } catch (error) {
        console.error('Error saving activity:', error);
        toast.error(error.response?.data?.message || t('errors.saveFailed', { item: t('activities.title').toLowerCase() }));
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (bannerImagePreview) {
        URL.revokeObjectURL(bannerImagePreview);
      }
    };
  }, [bannerImagePreview]);

  const handleDeleteDocument = async (documentId) => {
    try {
      await documentAPI.deleteDocument(documentId, tripId);
      setDocuments(documents.filter(doc => doc.id !== documentId));
      toast.success(t('documents.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error(t('errors.deleteFailed', { item: t('documents.title').toLowerCase() }));
    }
  };

  const downloadDocument = async (documentId, fileName) => {
    try {
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
    }
  };

  if (fetchLoading) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('common.loading')}
        size="lg"
      >
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? t('activities.edit') : t('activities.add')}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6 space-y-4">
          {/* Banner Image */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('activities.bannerImage')}
            </label>
            
            {/* Current banner preview */}
            {(bannerImagePreview || (existingBannerImage && !removeBanner)) ? (
              <div className="relative w-full h-40 mb-4">
                <img 
                  src={bannerImagePreview || getImageUrl(existingBannerImage)}
                  alt="Activity Banner"
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setBannerImage(null);
                    setBannerImagePreview(null);
                    if (isEditMode && existingBannerImage) {
                      setRemoveBanner(true);
                    }
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 rounded-full text-red-600"
                  aria-label={t('common.removeImage')}
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <Image className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label
                      htmlFor="banner-image-upload"
                      className="relative cursor-pointer rounded-md font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                    >
                      <span>{t('common.uploadImage')}</span>
                      <input
                        id="banner-image-upload"
                        name="banner_image"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleBannerImageChange}
                      />
                    </label>
                    <p className="pl-1">{t('common.dragDrop')}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('common.imageTypes')}
                  </p>
                  
                  {/* Show undo button if image was removed */}
                  {isEditMode && existingBannerImage && removeBanner && (
                    <button
                      type="button"
                      onClick={() => setRemoveBanner(false)}
                      className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-800 dark:text-purple-300 dark:hover:bg-purple-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 10h10a8 8 0 0 1 8 8v2M3 10l6 6m-6-6l6-6"/>
                      </svg>
                      {t('common.undoRemove', 'Undo remove')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Activity Name */}
          <Input
            label={t('activities.name')}
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('activities.namePlaceholder', 'e.g. Museum Tour')}
            error={errors.name}
            required
            icon={<Coffee className="h-5 w-5 text-gray-400" />}
          />

          {/* Activity Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('activities.date')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <DatePicker
                  selected={formData.date}
                  onChange={(date) => handleDateChange('date', date)}
                  dateFormat="MMMM d, yyyy"
                  className={`
                    block w-full rounded-md pl-10 py-2 pr-3 
                    text-gray-900 dark:text-white
                    border ${errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                    bg-white dark:bg-gray-800
                    focus:outline-none focus:ring-2 
                    ${errors.date ? 'focus:ring-red-500' : 'focus:ring-blue-500'} 
                    focus:border-transparent
                  `}
                />
              </div>
              {errors.date && (
                <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                  {errors.date}
                </p>
              )}
            </div>

            <Input
              label={t('activities.time')}
              id="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              placeholder={t('activities.timePlaceholder', 'e.g. 14:30 or 2:30 PM - 4:00 PM')}
              icon={<Clock className="h-5 w-5 text-gray-400" />}
            />
          </div>

          {/* Location */}
          <Input
            label={t('activities.location')}
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder={t('activities.locationPlaceholder', 'e.g. National Museum')}
            icon={<MapPin className="h-5 w-5 text-gray-400" />}
          />

          {/* Confirmation Code */}
          <Input
            label={t('activities.confirmationCode')}
            id="confirmation_code"
            name="confirmation_code"
            value={formData.confirmation_code}
            onChange={handleChange}
            placeholder={t('activities.confirmationCodePlaceholder', 'e.g. ABC123')}
            icon={<Tag className="h-5 w-5 text-gray-400" />}
          />

          {/* Notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('activities.notes')}
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder={t('activities.notesPlaceholder', 'Any additional information about the activity')}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {/* Existing Documents */}
          {documents.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('documents.attachedDocuments')}
              </label>
              <div className="space-y-2">
                {documents.map(doc => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-3">
                        {doc.file_type.includes('pdf') ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <path d="M9 15h6"></path>
                            <path d="M9 18h6"></path>
                            <path d="M9 12h2"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm truncate max-w-xs">{doc.file_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        type="button"
                        onClick={() => downloadDocument(doc.id, doc.file_name)}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 dark:text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Document */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('activities.attachTicket')}
            </label>
            {documentFileName ? (
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span className="text-sm font-medium truncate max-w-xs">{documentFileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentFile(null);
                    setDocumentFileName('');
                  }}
                  className="p-1 rounded-full hover:bg-purple-100 dark:hover:bg-purple-800"
                >
                  <X className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </button>
              </div>
            ) : (
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label
                      htmlFor="document-file"
                      className="relative cursor-pointer rounded-md font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                    >
                      <span>{t('documents.upload')}</span>
                      <input
                        id="document-file"
                        name="document"
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleDocumentChange}
                      />
                    </label>
                    <p className="pl-1">{t('documents.dragDrop')}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('documents.fileTypes')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            icon={<Ticket className="h-5 w-5" />}
          >
            {isEditMode ? t('activities.edit') : t('activities.add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ActivityModal;