// client/src/components/trips/ItemWizard.jsx
import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, X, Check, Calendar, Clock, MapPin,
    Plane, Train, Bus, Car, Ship, Bed, Coffee, Upload, Image as ImageIcon,
    FileText, Lock, Users, Tag, Building, Trash2, MoreHorizontal, Loader2, Eye, Download
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { transportAPI, lodgingAPI, activityAPI, documentAPI } from '../../services/api';
import { geocodeLocation } from '../../utils/geocoding';

/**
 * Step-based wizard for creating/editing activities, lodging, and transport.
 * Replaces the map in the split view for a more user-friendly experience.
 */
const ItemWizard = ({
    type, // 'activity' | 'lodging' | 'transport'
    itemId = null, // For editing
    tripId,
    defaultDate = null,
    onSuccess,
    onClose,
    onDelete, // Callback for deletion with (type, itemId) - allows parent to emit socket events
    tripStartDate,
    tripEndDate
}) => {
    const { t } = useTranslation();
    const isEditMode = !!itemId;
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Form data based on type
    const [formData, setFormData] = useState(() => getInitialFormData(type, defaultDate));
    const [bannerImage, setBannerImage] = useState(null);
    const [bannerImagePreview, setBannerImagePreview] = useState(null);
    const [existingBannerImage, setExistingBannerImage] = useState(null);
    const [documentFiles, setDocumentFiles] = useState([]); // Array of {file, isPersonal} objects for NEW uploads
    const [existingDocuments, setExistingDocuments] = useState([]); // Existing documents from the server
    const [deletingDocId, setDeletingDocId] = useState(null);
    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});

    // Get initial form data based on type
    function getInitialFormData(type, defaultDate) {
        const baseDate = defaultDate ? new Date(defaultDate) : new Date();

        if (type === 'activity') {
            return {
                name: '',
                date: baseDate,
                time: '',
                location: '',
                latitude: null,
                longitude: null,
                confirmation_code: '',
                notes: '',
            };
        } else if (type === 'lodging') {
            return {
                name: '',
                address: '',
                latitude: null,
                longitude: null,
                check_in: baseDate,
                check_out: new Date(new Date(baseDate).setDate(baseDate.getDate() + 3)),
                confirmation_code: '',
                notes: '',
            };
        } else if (type === 'transport') {
            return {
                type: 'Flight',
                company: '',
                from_location: '',
                to_location: '',
                from_latitude: null,
                from_longitude: null,
                to_latitude: null,
                to_longitude: null,
                from_location_disabled: false,
                to_location_disabled: false,
                departure_date: baseDate,
                departure_time: '',
                arrival_date: null,
                arrival_time: '',
                confirmation_code: '',
                notes: '',
            };
        }
        return {};
    }

    // Fetch existing data for edit mode
    useEffect(() => {
        if (isEditMode) {
            fetchItemData();
        }
    }, [itemId, type]);

    // Reset form when switching from edit to create mode or when defaultDate changes
    useEffect(() => {
        if (!isEditMode) {
            setFormData(getInitialFormData(type, defaultDate));
            setDocumentFiles([]);
            setExistingDocuments([]);
            setBannerImage(null);
            setBannerImagePreview(null);
            setExistingBannerImage(null);
            setCurrentStep(0);
            setErrors({});
            setWarnings({});
        }
    }, [isEditMode, defaultDate, type]);

    const fetchItemData = async () => {
        try {
            setIsFetching(true);
            setErrors({});
            setWarnings({});
            let response;

            // Helper to parse date string consistently - preserves the intended date
            // regardless of user's timezone by parsing as local date
            const parseLocalDate = (dateString) => {
                if (!dateString) return new Date();
                // Parse date string (YYYY-MM-DD format) and create local Date
                // This avoids timezone shifts where UTC midnight becomes previous day
                const [year, month, day] = dateString.split('-').map(Number);
                return new Date(year, month - 1, day);
            };

            if (type === 'activity') {
                response = await activityAPI.getActivity(itemId);
                const activity = response.data.activity;
                setFormData({
                    name: activity.name || '',
                    date: activity.date ? parseLocalDate(activity.date) : new Date(),
                    time: activity.time || '',
                    location: activity.location || '',
                    latitude: activity.latitude || null,
                    longitude: activity.longitude || null,
                    confirmation_code: activity.confirmation_code || '',
                    notes: activity.notes || '',
                });
                setExistingBannerImage(activity.banner_image || null);
                // Load existing documents
                if (response.data.documents) {
                    setExistingDocuments(response.data.documents);
                }
            } else if (type === 'lodging') {
                response = await lodgingAPI.getLodging(itemId);
                const lodging = response.data.lodging;
                setFormData({
                    name: lodging.name || '',
                    address: lodging.address || '',
                    latitude: lodging.latitude || null,
                    longitude: lodging.longitude || null,
                    check_in: lodging.check_in ? parseLocalDate(lodging.check_in) : new Date(),
                    check_out: lodging.check_out ? parseLocalDate(lodging.check_out) : new Date(),
                    confirmation_code: lodging.confirmation_code || '',
                    notes: lodging.notes || '',
                });
                setExistingBannerImage(lodging.banner_image || null);
                // Load existing documents
                if (response.data.documents) {
                    setExistingDocuments(response.data.documents);
                }
            } else if (type === 'transport') {
                response = await transportAPI.getTransportation(itemId);
                const transport = response.data.transportation;
                setFormData({
                    type: transport.type || 'Flight',
                    company: transport.company || '',
                    from_location: transport.from_location || '',
                    to_location: transport.to_location || '',
                    from_latitude: transport.from_latitude || null,
                    from_longitude: transport.from_longitude || null,
                    to_latitude: transport.to_latitude || null,
                    to_longitude: transport.to_longitude || null,
                    from_location_disabled: transport.from_location_disabled || false,
                    to_location_disabled: transport.to_location_disabled || false,
                    departure_date: transport.departure_date ? parseLocalDate(transport.departure_date) : new Date(),
                    departure_time: transport.departure_time || '',
                    arrival_date: transport.arrival_date ? parseLocalDate(transport.arrival_date) : null,
                    arrival_time: transport.arrival_time || '',
                    confirmation_code: transport.confirmation_code || '',
                    notes: transport.notes || '',
                });
                setExistingBannerImage(transport.banner_image || null);
                // Load existing documents
                if (response.data.documents) {
                    setExistingDocuments(response.data.documents);
                }
            }
        } catch (error) {
            console.error('Error fetching item:', error);
            toast.error(t('errors.loadFailed', { item: type }));
        } finally {
            setIsFetching(false);
        }
    };

    // Handle geocoding for activities and lodging
    useEffect(() => {
        const locationText = type === 'activity' ? formData.location : (type === 'lodging' ? formData.address : null);

        // Don't geocode if we already have coordinates and location hasn't changed (complex check omitted for simplicity, relying on debounce)
        // Or if location is too short
        if (!locationText || locationText.length < 3) {
            return;
        }

        const debounceTimer = setTimeout(async () => {
            // Only geocode if coordinates are missing OR if this is a new entry/edit where we might want to refresh
            // But to avoid overwriting efficient data, we could check if lat/lng already exists.
            // However, if user CHANGED the text, we want to re-geocode.
            // Simplified: Always geocode if text changes.

            setIsGeocoding(true);
            try {
                const coords = await geocodeLocation(locationText);
                if (coords) {
                    setFormData(prev => ({
                        ...prev,
                        latitude: coords.lat,
                        longitude: coords.lng
                    }));
                } else {
                    // Only clear if we explicitly failed to find one? Or keep old?
                    // Better to clear if the new address is invalid.
                    setFormData(prev => ({
                        ...prev,
                        latitude: null,
                        longitude: null
                    }));
                }
            } finally {
                setIsGeocoding(false);
            }
        }, 800);

        return () => clearTimeout(debounceTimer);
    }, [formData.location, formData.address, type]);

    // Handle geocoding for transportation from_location
    useEffect(() => {
        if (type !== 'transport' || !formData.from_location || formData.from_location.length < 3 || formData.from_location_disabled) {
            // Clear coordinates if disabled
            if (type === 'transport' && formData.from_location_disabled && (formData.from_latitude || formData.from_longitude)) {
                setFormData(prev => ({
                    ...prev,
                    from_latitude: null,
                    from_longitude: null
                }));
            }
            return;
        }

        const debounceTimer = setTimeout(async () => {
            setIsGeocoding(true);
            try {
                const coords = await geocodeLocation(formData.from_location);
                if (coords) {
                    setFormData(prev => ({
                        ...prev,
                        from_latitude: coords.lat,
                        from_longitude: coords.lng
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        from_latitude: null,
                        from_longitude: null
                    }));
                }
            } finally {
                setIsGeocoding(false);
            }
        }, 800);

        return () => clearTimeout(debounceTimer);
    }, [type, formData.from_location, formData.from_location_disabled]);

    // Handle geocoding for transportation to_location
    useEffect(() => {
        if (type !== 'transport' || !formData.to_location || formData.to_location.length < 3 || formData.to_location_disabled) {
            // Clear coordinates if disabled
            if (type === 'transport' && formData.to_location_disabled && (formData.to_latitude || formData.to_longitude)) {
                setFormData(prev => ({
                    ...prev,
                    to_latitude: null,
                    to_longitude: null
                }));
            }
            return;
        }

        const debounceTimer = setTimeout(async () => {
            setIsGeocoding(true);
            try {
                const coords = await geocodeLocation(formData.to_location);
                if (coords) {
                    setFormData(prev => ({
                        ...prev,
                        to_latitude: coords.lat,
                        to_longitude: coords.lng
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        to_latitude: null,
                        to_longitude: null
                    }));
                }
            } finally {
                setIsGeocoding(false);
            }
        }, 800);

        return () => clearTimeout(debounceTimer);
    }, [type, formData.to_location, formData.to_location_disabled]);

    // Get step definitions based on type
    const getSteps = () => {
        if (type === 'activity') {
            return [
                { id: 'basics', title: t('wizard.basics', 'Basics'), icon: <Coffee className="w-5 h-5" /> },
                { id: 'details', title: t('wizard.details', 'Details'), icon: <MapPin className="w-5 h-5" /> },
                { id: 'extras', title: t('wizard.extras', 'Extras'), icon: <FileText className="w-5 h-5" /> },
            ];
        } else if (type === 'lodging') {
            return [
                { id: 'place', title: t('wizard.place', 'Place'), icon: <Bed className="w-5 h-5" /> },
                { id: 'dates', title: t('wizard.dates', 'Dates'), icon: <Calendar className="w-5 h-5" /> },
                { id: 'extras', title: t('wizard.extras', 'Extras'), icon: <FileText className="w-5 h-5" /> },
            ];
        } else if (type === 'transport') {
            return [
                { id: 'type', title: t('wizard.type', 'Type'), icon: <Plane className="w-5 h-5" /> },
                { id: 'route', title: t('wizard.route', 'Route'), icon: <MapPin className="w-5 h-5" /> },
                { id: 'schedule', title: t('wizard.schedule', 'Schedule'), icon: <Calendar className="w-5 h-5" /> },
                { id: 'extras', title: t('wizard.extras', 'Extras'), icon: <FileText className="w-5 h-5" /> },
            ];
        }
        return [];
    };

    const steps = getSteps();

    // Handle form changes
    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    // Handle banner image
    const handleBannerChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBannerImage(file);
            setBannerImagePreview(URL.createObjectURL(file));
        }
    };

    // Allowed file extensions for document uploads
    const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];

    // Handle document file - add to array with validation
    const handleDocumentChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Validate each file
            const validFiles = [];
            const invalidFiles = [];

            files.forEach(file => {
                const extension = '.' + file.name.split('.').pop().toLowerCase();
                if (ALLOWED_EXTENSIONS.includes(extension)) {
                    validFiles.push({ file, isPersonal: false });
                } else {
                    invalidFiles.push(file.name);
                }
            });

            // Show error for invalid files
            if (invalidFiles.length > 0) {
                toast.error(
                    t('documents.unsupportedFormat',
                        `Unsupported file format: ${invalidFiles.join(', ')}. Allowed: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG`)
                );
            }

            // Add valid files
            if (validFiles.length > 0) {
                setDocumentFiles(prev => [...prev, ...validFiles]);
            }
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    // Update document privacy setting
    const updateDocumentPrivacy = (index, isPersonal) => {
        setDocumentFiles(prev => prev.map((doc, i) =>
            i === index ? { ...doc, isPersonal } : doc
        ));
    };

    // Remove document from list
    const removeDocument = (index) => {
        setDocumentFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Delete an existing document from the server
    const deleteExistingDocument = async (documentId) => {
        if (!confirm(t('common.confirmDelete'))) return;

        try {
            setDeletingDocId(documentId);
            await documentAPI.deleteDocument(documentId, tripId);
            setExistingDocuments(prev => prev.filter(doc => doc.id !== documentId));
            toast.success(t('documents.deleteSuccess'));
        } catch (error) {
            console.error('Error deleting document:', error);
            toast.error(t('errors.deleteFailed', { item: t('documents.title').toLowerCase() }));
        } finally {
            setDeletingDocId(null);
        }
    };

    // Validate current step
    const validateStep = () => {
        const newErrors = {};
        const newWarnings = {};

        if (type === 'activity') {
            if (currentStep === 0 && !formData.name.trim()) {
                newErrors.name = t('errors.required', { field: t('activities.name') });
            }
        } else if (type === 'lodging') {
            if (currentStep === 0 && !formData.name.trim()) {
                newErrors.name = t('errors.required', { field: t('lodging.name') });
            }
        } else if (type === 'transport') {
            if (currentStep === 1) {
                if (!formData.from_location.trim()) {
                    newErrors.from_location = t('errors.required', { field: t('transportation.fromLocation') });
                }
                if (!formData.to_location.trim()) {
                    newErrors.to_location = t('errors.required', { field: t('transportation.toLocation') });
                }
            }
        }

        // Date validation against trip dates
        if (tripStartDate && tripEndDate) {
            const start = dayjs(tripStartDate).startOf('day');
            const end = dayjs(tripEndDate).endOf('day');

            if (type === 'activity' && currentStep === 0 && formData.date) {
                const date = dayjs(formData.date);
                if (date.isBefore(start) || date.isAfter(end)) {
                    newErrors.date = t('errors.dateOutOfRange', 'Date must be within trip dates');
                }
            } else if (type === 'lodging' && currentStep === 1 && formData.check_in) {
                // For lodging, we typically care that it starts within or during the trip. 
                // It's technically possible to arrive before or stay after, but for "Trip" planning, usually consistent.
                // Let's enforce check-in is not after trip end, and check-out is not before trip start.
                const checkIn = dayjs(formData.check_in);
                if (checkIn.isAfter(end)) {
                    newErrors.check_in = t('errors.dateOutOfRange', 'Check-in cannot be after trip ends');
                }
                // Allow check-in before trip start? maybe. But let's stick to strict "within range" for now based on user request "cannot create activities outside trip range".
                if (checkIn.isBefore(start)) {
                    newErrors.check_in = t('errors.dateOutOfRange', 'Check-in cannot be before trip starts');
                }
            } else if (type === 'transport' && currentStep === 2) {
                // For transport, validate that at least arrival is within trip dates
                // Departure can be before trip (e.g., flight to destination)
                const depDate = formData.departure_date ? dayjs(formData.departure_date) : null;
                const arrDate = formData.arrival_date ? dayjs(formData.arrival_date) : depDate;

                // Add warning if departure is before trip starts
                if (depDate && depDate.isBefore(start)) {
                    newWarnings.departure_date = t('warnings.departureBeforeTrip', 'Departure is before trip starts (arrival will be within trip)');
                }
                // Add warning if departure is after trip ends
                if (depDate && depDate.isAfter(end)) {
                    newWarnings.departure_date = t('warnings.departureAfterTrip', 'Departure is after trip ends');
                }
                // Add warning if arrival is after trip ends
                if (arrDate && arrDate.isAfter(end)) {
                    newWarnings.arrival_date = t('warnings.arrivalAfterTrip', 'Arrival is after trip ends');
                }
                // Add warning if arrival is before trip starts (and departure is also before)
                if (arrDate && arrDate.isBefore(start) && depDate && depDate.isBefore(start)) {
                    newWarnings.arrival_date = t('warnings.bothBeforeTrip', 'Both departure and arrival are before trip starts');
                }

                // Only block if both departure and arrival are completely outside trip range
                if (depDate && arrDate) {
                    const bothAfter = depDate.isAfter(end) && arrDate.isAfter(end);
                    const bothBefore = depDate.isBefore(start) && arrDate.isBefore(start);
                    if (bothAfter || bothBefore) {
                        newErrors.departure_date = t('errors.dateOutOfRange', 'At least one date must be within trip dates');
                    }
                } else if (depDate && depDate.isAfter(end)) {
                    // If only departure is set and it's after trip ends, that's an error
                    newErrors.departure_date = t('errors.dateOutOfRange', 'Departure cannot be after trip ends');
                }
            }
        }

        setErrors(newErrors);
        setWarnings(newWarnings);
        return Object.keys(newErrors).length === 0;
    };

    // Navigate steps
    const goToNextStep = () => {
        if (validateStep() && currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const goToPrevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // Go to a specific step (allowed in edit mode for any step)
    const goToStep = (stepIndex) => {
        if (isEditMode) {
            // In edit mode, allow jumping to any step
            setCurrentStep(stepIndex);
        } else {
            // In create mode, only allow going to completed steps
            if (stepIndex <= currentStep) {
                setCurrentStep(stepIndex);
            }
        }
    };

    // Handle deletion
    const handleDelete = async () => {
        if (!isEditMode || !itemId) return;

        if (!confirm(t('common.confirmDelete'))) return;

        try {
            setIsDeleting(true);

            if (type === 'activity') {
                await activityAPI.deleteActivity(itemId, tripId);
                toast.success(t('activities.deleteSuccess', 'Activity deleted successfully'));
            } else if (type === 'lodging') {
                await lodgingAPI.deleteLodging(itemId, tripId);
                toast.success(t('lodging.deleteSuccess', 'Lodging deleted successfully'));
            } else if (type === 'transport') {
                await transportAPI.deleteTransportation(itemId, tripId);
                toast.success(t('transportation.deleteSuccess', 'Transportation deleted successfully'));
            }

            // Call onDelete callback so parent can emit socket events
            if (onDelete) onDelete(type, itemId);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error(error.response?.data?.message || t('errors.deleteFailed', { item: type }));
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!validateStep()) return;

        try {
            setIsLoading(true);

            let formattedData = { ...formData };
            let response;

            if (type === 'activity') {
                formattedData.date = formData.date ? dayjs(formData.date).format('YYYY-MM-DD') : null;
                if (bannerImage) formattedData.banner_image = bannerImage;

                if (isEditMode) {
                    response = await activityAPI.updateActivity(itemId, formattedData, tripId);
                    toast.success(t('activities.updateSuccess', 'Activity updated successfully'));
                } else {
                    response = await activityAPI.createActivity(tripId, formattedData);
                    toast.success(t('activities.createSuccess', 'Activity added successfully'));
                }

                // Upload documents if any selected
                const refId = isEditMode ? itemId : response.data.activity.id;
                for (const doc of documentFiles) {
                    const docData = new FormData();
                    docData.append('document', doc.file);
                    docData.append('reference_type', 'activity');
                    docData.append('reference_id', refId);
                    docData.append('is_personal', doc.isPersonal ? 'true' : 'false');
                    await documentAPI.uploadDocument(docData);
                }
            } else if (type === 'lodging') {
                formattedData.check_in = formData.check_in ? dayjs(formData.check_in).format('YYYY-MM-DD') : null;
                formattedData.check_out = formData.check_out ? dayjs(formData.check_out).format('YYYY-MM-DD') : null;
                if (bannerImage) formattedData.banner_image = bannerImage;

                if (isEditMode) {
                    response = await lodgingAPI.updateLodging(itemId, formattedData, tripId);
                    toast.success(t('lodging.updateSuccess', 'Lodging updated successfully'));
                } else {
                    response = await lodgingAPI.createLodging(tripId, formattedData);
                    toast.success(t('lodging.createSuccess', 'Lodging added successfully'));
                }

                // Upload documents if any selected
                const refId = isEditMode ? itemId : response.data.lodging.id;
                for (const doc of documentFiles) {
                    const docData = new FormData();
                    docData.append('document', doc.file);
                    docData.append('reference_type', 'lodging');
                    docData.append('reference_id', refId);
                    docData.append('is_personal', doc.isPersonal ? 'true' : 'false');
                    await documentAPI.uploadDocument(docData);
                }
            } else if (type === 'transport') {
                formattedData.departure_date = formData.departure_date ? dayjs(formData.departure_date).format('YYYY-MM-DD') : null;
                formattedData.arrival_date = formData.arrival_date
                    ? dayjs(formData.arrival_date).format('YYYY-MM-DD')
                    : formattedData.departure_date;
                if (bannerImage) formattedData.banner_image = bannerImage;

                if (isEditMode) {
                    response = await transportAPI.updateTransportation(itemId, formattedData, tripId);
                    toast.success(t('transportation.updateSuccess', 'Transportation updated successfully'));
                } else {
                    response = await transportAPI.createTransportation(tripId, formattedData);
                    toast.success(t('transportation.createSuccess', 'Transportation added successfully'));
                }

                // Upload documents if any selected
                const refId = isEditMode ? itemId : response.data.transportation.id;
                for (const doc of documentFiles) {
                    const docData = new FormData();
                    docData.append('document', doc.file);
                    docData.append('reference_type', 'transportation');
                    docData.append('reference_id', refId);
                    docData.append('is_personal', doc.isPersonal ? 'true' : 'false');
                    await documentAPI.uploadDocument(docData);
                }
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving:', error);
            toast.error(error.response?.data?.message || t('errors.saveFailed', { item: type }));
        } finally {
            setIsLoading(false);
        }
    };

    // Get transport icon
    const getTransportIcon = (transportType) => {
        switch (transportType?.toLowerCase()) {
            case 'flight': return <Plane className="w-6 h-6" />;
            case 'train': return <Train className="w-6 h-6" />;
            case 'bus': return <Bus className="w-6 h-6" />;
            case 'car': return <Car className="w-6 h-6" />;
            case 'ship': case 'ferry': return <Ship className="w-6 h-6" />;
            default: return <Plane className="w-6 h-6" />;
        }
    };

    // Get wizard title
    const getWizardTitle = () => {
        if (type === 'activity') {
            return isEditMode ? t('activities.edit', 'Edit Activity') : t('activities.add', 'Add Activity');
        } else if (type === 'lodging') {
            return isEditMode ? t('lodging.edit', 'Edit Lodging') : t('lodging.add', 'Add Lodging');
        } else if (type === 'transport') {
            return isEditMode ? t('transportation.edit', 'Edit Transport') : t('transportation.add', 'Add Transport');
        }
        return '';
    };

    // Color schemes for each type - Tailwind needs complete class names
    const colorSchemes = {
        activity: {
            name: 'purple',
            stepActiveBg: 'bg-purple-100 dark:bg-purple-900/30',
            stepActiveText: 'text-purple-700 dark:text-purple-300',
            dotActive: 'bg-purple-500',
            dotComplete: 'bg-purple-300',
            btnBg: 'bg-purple-600 hover:bg-purple-700',
        },
        lodging: {
            name: 'green',
            stepActiveBg: 'bg-green-100 dark:bg-green-900/30',
            stepActiveText: 'text-green-700 dark:text-green-300',
            dotActive: 'bg-green-500',
            dotComplete: 'bg-green-300',
            btnBg: 'bg-green-600 hover:bg-green-700',
        },
        transport: {
            name: 'blue',
            stepActiveBg: 'bg-blue-100 dark:bg-blue-900/30',
            stepActiveText: 'text-blue-700 dark:text-blue-300',
            dotActive: 'bg-blue-500',
            dotComplete: 'bg-blue-300',
            btnBg: 'bg-blue-600 hover:bg-blue-700',
        },
    };

    const colorScheme = colorSchemes[type] || colorSchemes.activity;

    // Render step content
    const renderStepContent = () => {
        if (type === 'activity') {
            return renderActivityStep();
        } else if (type === 'lodging') {
            return renderLodgingStep();
        } else if (type === 'transport') {
            return renderTransportStep();
        }
        return null;
    };

    // Activity step content
    const renderActivityStep = () => {
        switch (currentStep) {
            case 0: // Basics - Name & Date
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Coffee className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.whatActivity', "What's the activity?")}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.activityBasicsDesc', 'Give it a name and pick a date')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('activities.name', 'Activity Name')} *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder={t('activities.namePlaceholder', 'e.g. Museum Tour')}
                                    className={`w-full px-4 py-3 rounded-xl border ${errors.name
                                        ? 'border-red-500 focus:ring-red-500'
                                        : 'border-gray-200 dark:border-gray-600 focus:ring-purple-500'
                                        } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                />
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('activities.date', 'Date')} *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <DatePicker
                                        selected={formData.date}
                                        onChange={(date) => handleChange('date', date)}
                                        dateFormat="MMMM d, yyyy"
                                        minDate={tripStartDate ? new Date(tripStartDate) : null}
                                        maxDate={tripEndDate ? new Date(tripEndDate) : null}
                                        className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.date
                                            ? 'border-red-500 focus:ring-red-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-purple-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                    {errors.date && <p className="mt-1 text-sm text-red-500 absolute top-full left-0 z-10 bg-white dark:bg-gray-800 p-1 rounded shadow text-xs">{errors.date}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 1: // Details - Time & Location
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <MapPin className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.whereWhen', 'Where & When?')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.activityDetailsDesc', 'Add the location and time')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('activities.time', 'Time')}
                                </label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.time}
                                        onChange={(e) => handleChange('time', e.target.value)}
                                        placeholder={t('activities.timePlaceholder', 'e.g. 14:30 or 2:30 PM')}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('activities.location', 'Location')}
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => handleChange('location', e.target.value)}
                                        placeholder={t('activities.locationPlaceholder', 'e.g. National Museum')}
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    {isGeocoding ? (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                                        </div>
                                    ) : formData.latitude && formData.longitude && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {formData.latitude && formData.longitude && (
                                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                                        ✓ {t('brainstorm.locationFound', 'Location found')}: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                                    </p>
                                )}
                                {formData.location && formData.location.length >= 3 && !isGeocoding && !formData.latitude && !formData.longitude && (
                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                        {t('brainstorm.locationNotFound', 'Location not found - try a more specific address')}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('activities.confirmationCode', 'Confirmation Code')}
                                </label>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.confirmation_code}
                                        onChange={(e) => handleChange('confirmation_code', e.target.value)}
                                        placeholder={t('activities.confirmationCodePlaceholder', 'e.g. ABC123')}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div >
                );

            case 2: // Extras - Notes & Documents
                return renderExtrasStep('purple');

            default:
                return null;
        }
    };

    // Lodging step content
    const renderLodgingStep = () => {
        switch (currentStep) {
            case 0: // Place - Name & Address
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Bed className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.whereStaying', "Where are you staying?")}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.lodgingPlaceDesc', 'Enter the hotel or lodging details')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('lodging.name', 'Name')} *
                                </label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        placeholder={t('lodging.namePlaceholder', 'e.g. Grand Hotel')}
                                        className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.name
                                            ? 'border-red-500 focus:ring-red-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-green-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                </div>
                                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('lodging.address', 'Address')}
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => handleChange('address', e.target.value)}
                                        placeholder={t('lodging.addressPlaceholder', '123 Main St, City, Country')}
                                        rows={3}
                                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                    {isGeocoding ? (
                                        <div className="absolute right-3 top-3">
                                            <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                                        </div>
                                    ) : formData.latitude && formData.longitude && (
                                        <div className="absolute right-3 top-3 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {formData.latitude && formData.longitude && (
                                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                                        ✓ {t('brainstorm.locationFound', 'Location found')}: {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                                    </p>
                                )}
                                {formData.address && formData.address.length >= 3 && !isGeocoding && !formData.latitude && !formData.longitude && (
                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                        {t('brainstorm.locationNotFound', 'Location not found - try a more specific address')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 1: // Dates - Check-in & Check-out
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.whenStaying', 'When are you staying?')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.lodgingDatesDesc', 'Set your check-in and check-out dates')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('lodging.checkIn', 'Check-in')} *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <DatePicker
                                        selected={formData.check_in}
                                        onChange={(date) => handleChange('check_in', date)}
                                        dateFormat="MMMM d, yyyy"
                                        minDate={tripStartDate ? new Date(tripStartDate) : null}
                                        maxDate={tripEndDate ? new Date(tripEndDate) : null}
                                        className={`w-full pl-10 pr-4 py-3 rounded-xl border ${errors.check_in
                                            ? 'border-red-500 focus:ring-red-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-green-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                    {errors.check_in && <p className="mt-1 text-sm text-red-500 absolute top-full left-0 z-10 bg-white dark:bg-gray-800 p-1 rounded shadow text-xs">{errors.check_in}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('lodging.checkOut', 'Check-out')} *
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <DatePicker
                                        selected={formData.check_out}
                                        onChange={(date) => handleChange('check_out', date)}
                                        dateFormat="MMMM d, yyyy"
                                        minDate={formData.check_in}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('lodging.confirmationCode', 'Confirmation Code')}
                                </label>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.confirmation_code}
                                        onChange={(e) => handleChange('confirmation_code', e.target.value)}
                                        placeholder={t('lodging.confirmationCodePlaceholder', 'e.g. ABC123')}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 2: // Extras
                return renderExtrasStep('green');

            default:
                return null;
        }
    };

    // Transport step content
    const renderTransportStep = () => {
        const transportTypes = [
            { value: 'Flight', icon: <Plane className="w-6 h-6" />, label: t('transportation.flight', 'Flight') },
            { value: 'Train', icon: <Train className="w-6 h-6" />, label: t('transportation.train', 'Train') },
            { value: 'Bus', icon: <Bus className="w-6 h-6" />, label: t('transportation.bus', 'Bus') },
            { value: 'Car', icon: <Car className="w-6 h-6" />, label: t('transportation.car', 'Car') },
            { value: 'Ship', icon: <Ship className="w-6 h-6" />, label: t('transportation.ship', 'Ship') },
            { value: 'Other', icon: <MoreHorizontal className="w-6 h-6" />, label: t('transportation.other', 'Other') },
        ];

        switch (currentStep) {
            case 0: // Type selection
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Plane className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.howTraveling', 'How are you traveling?')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.selectTransportType', 'Select your mode of transportation')}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {transportTypes.map((transportType) => (
                                <button
                                    key={transportType.value}
                                    type="button"
                                    onClick={() => handleChange('type', transportType.value)}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.type === transportType.value
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                        }`}
                                >
                                    <div className={`${formData.type === transportType.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                                        {transportType.icon}
                                    </div>
                                    <span className={`text-sm font-medium ${formData.type === transportType.value
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                        }`}>
                                        {transportType.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('transportation.company', 'Company')}
                            </label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => handleChange('company', e.target.value)}
                                placeholder={t('transportation.companyPlaceholder', 'e.g. United Airlines')}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                );

            case 1: // Route - From & To
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <MapPin className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.whereGoing', 'Where are you going?')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.routeDesc', 'Enter your departure and arrival locations')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('transportation.fromLocation', 'From')} *
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.from_location}
                                        onChange={(e) => handleChange('from_location', e.target.value)}
                                        placeholder={t('transportation.fromLocationPlaceholder', 'e.g. New York (JFK)')}
                                        className={`w-full pl-10 pr-10 py-3 rounded-xl border ${errors.from_location
                                            ? 'border-red-500 focus:ring-red-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                    {isGeocoding ? (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                        </div>
                                    ) : formData.from_latitude && formData.from_longitude && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {errors.from_location && <p className="mt-1 text-sm text-red-500">{errors.from_location}</p>}
                                {formData.from_latitude && formData.from_longitude && !formData.from_location_disabled && (
                                    <div className="mt-2 flex items-center justify-between">
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            {t('brainstorm.locationFound', 'Location found')}: {formData.from_latitude.toFixed(4)}, {formData.from_longitude.toFixed(4)}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleChange('from_location_disabled', true)}
                                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                                        >
                                            {t('transportation.disableLocation', 'Don\'t show on map')}
                                        </button>
                                    </div>
                                )}
                                {formData.from_location_disabled && (
                                    <div className="mt-2 flex items-center justify-between">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('transportation.locationDisabled', 'Location hidden from map')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleChange('from_location_disabled', false)}
                                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                        >
                                            {t('transportation.enableLocation', 'Show on map')}
                                        </button>
                                    </div>
                                )}
                                {formData.from_location && formData.from_location.length >= 3 && !isGeocoding && !formData.from_latitude && !formData.from_longitude && !formData.from_location_disabled && (
                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                        {t('brainstorm.locationNotFound', 'Location not found - will not appear on map')}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('transportation.toLocation', 'To')} *
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.to_location}
                                        onChange={(e) => handleChange('to_location', e.target.value)}
                                        placeholder={t('transportation.toLocationPlaceholder', 'e.g. London (LHR)')}
                                        className={`w-full pl-10 pr-10 py-3 rounded-xl border ${errors.to_location
                                            ? 'border-red-500 focus:ring-red-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                    {isGeocoding ? (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                        </div>
                                    ) : formData.to_latitude && formData.to_longitude && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                {errors.to_location && <p className="mt-1 text-sm text-red-500">{errors.to_location}</p>}
                                {formData.to_latitude && formData.to_longitude && !formData.to_location_disabled && (
                                    <div className="mt-2 flex items-center justify-between">
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            {t('brainstorm.locationFound', 'Location found')}: {formData.to_latitude.toFixed(4)}, {formData.to_longitude.toFixed(4)}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleChange('to_location_disabled', true)}
                                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                                        >
                                            {t('transportation.disableLocation', 'Don\'t show on map')}
                                        </button>
                                    </div>
                                )}
                                {formData.to_location_disabled && (
                                    <div className="mt-2 flex items-center justify-between">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {t('transportation.locationDisabled', 'Location hidden from map')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => handleChange('to_location_disabled', false)}
                                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                        >
                                            {t('transportation.enableLocation', 'Show on map')}
                                        </button>
                                    </div>
                                )}
                                {formData.to_location && formData.to_location.length >= 3 && !isGeocoding && !formData.to_latitude && !formData.to_longitude && !formData.to_location_disabled && (
                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                        {t('brainstorm.locationNotFound', 'Location not found - will not appear on map')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 2: // Schedule - Dates & Times
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {t('wizard.whenTraveling', 'When are you traveling?')}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {t('wizard.scheduleDesc', 'Set your departure and arrival times')}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('transportation.departureDate', 'Departure Date')} *
                                    </label>
                                    <DatePicker
                                        selected={formData.departure_date}
                                        onChange={(date) => handleChange('departure_date', date)}
                                        dateFormat="MMM d, yyyy"
                                        className={`w-full px-4 py-3 rounded-xl border ${errors.departure_date || warnings.departure_date
                                            ? 'border-amber-500 focus:ring-amber-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                    {errors.departure_date && <p className="mt-1 text-sm text-red-500">{errors.departure_date}</p>}
                                    {warnings.departure_date && !errors.departure_date && (
                                        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            {warnings.departure_date}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('transportation.departureTime', 'Time')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.departure_time}
                                        onChange={(e) => handleChange('departure_time', e.target.value)}
                                        placeholder="14:30"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('transportation.arrivalDate', 'Arrival Date')}
                                    </label>
                                    <DatePicker
                                        selected={formData.arrival_date}
                                        onChange={(date) => handleChange('arrival_date', date)}
                                        dateFormat="MMM d, yyyy"
                                        placeholderText={t('transportation.arrivalDatePlaceholder', 'Same day')}
                                        openToDate={formData.arrival_date || formData.departure_date}
                                        minDate={formData.departure_date}
                                        className={`w-full px-4 py-3 rounded-xl border ${errors.arrival_date || warnings.arrival_date
                                            ? 'border-amber-500 focus:ring-amber-500'
                                            : 'border-gray-200 dark:border-gray-600 focus:ring-blue-500'
                                            } bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2`}
                                    />
                                    {errors.arrival_date && <p className="mt-1 text-sm text-red-500">{errors.arrival_date}</p>}
                                    {warnings.arrival_date && !errors.arrival_date && (
                                        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            {warnings.arrival_date}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t('transportation.arrivalTime', 'Time')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.arrival_time}
                                        onChange={(e) => handleChange('arrival_time', e.target.value)}
                                        placeholder="16:45"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('transportation.confirmationCode', 'Confirmation Code')}
                                </label>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={formData.confirmation_code}
                                        onChange={(e) => handleChange('confirmation_code', e.target.value)}
                                        placeholder={t('transportation.confirmationCodePlaceholder', 'e.g. ABC123')}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 3: // Extras
                return renderExtrasStep('blue');

            default:
                return null;
        }
    };

    // Extras step (shared across types)
    const renderExtrasStep = (color) => {
        const colorClasses = {
            purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 focus:ring-purple-500',
            green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 focus:ring-green-500',
            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 focus:ring-blue-500',
        };

        return (
            <div className="space-y-6">
                <div className="text-center mb-8">
                    <div className={`w-16 h-16 ${colorClasses[color].split(' ').slice(0, 2).join(' ')} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                        <FileText className={`w-8 h-8 ${colorClasses[color].split(' ').slice(2, 4).join(' ')}`} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {t('wizard.anythingElse', 'Anything else?')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t('wizard.extrasDesc', 'Add notes or attach documents')}
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('common.notes', 'Notes')}
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder={t('common.notesPlaceholder', 'Any additional information...')}
                            rows={3}
                            className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${colorClasses[color].split(' ').slice(-1)}`}
                        />
                    </div>

                    {/* Documents Section */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('documents.title', 'Documents')} {(existingDocuments.length + documentFiles.length) > 0 && `(${existingDocuments.length + documentFiles.length})`}
                        </label>

                        {/* Existing documents (already uploaded to server) */}
                        {existingDocuments.length > 0 && (
                            <div className="space-y-2 mb-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    {t('documents.existing', 'Uploaded documents')}
                                </p>
                                {existingDocuments.map((doc) => (
                                    <div key={doc.id} className={`p-3 rounded-xl border ${doc.is_personal
                                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                                        : 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                        }`}>
                                        {/* Top row: icon, filename, delete */}
                                        <div className="flex items-center gap-2">
                                            <FileText className={`w-5 h-5 flex-shrink-0 ${doc.is_personal ? 'text-amber-500' : 'text-green-500'
                                                }`} />
                                            <span className="text-sm font-medium truncate flex-1 text-gray-900 dark:text-white">{doc.file_name}</span>

                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                onClick={() => deleteExistingDocument(doc.id)}
                                                disabled={deletingDocId === doc.id}
                                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-red-500 disabled:opacity-50 flex-shrink-0"
                                            >
                                                {deletingDocId === doc.id ? (
                                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Bottom row: privacy indicator */}
                                        <div className="flex items-center gap-2 mt-2 pl-7">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${doc.is_personal
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                }`}>
                                                {doc.is_personal ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                                {doc.is_personal ? t('budget.personal', 'Personal') : t('budget.shared', 'Shared')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* New documents to upload */}
                        {documentFiles.length > 0 && (
                            <div className="space-y-2 mb-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    {t('documents.new', 'New documents to upload')}
                                </p>
                                {documentFiles.map((doc, index) => (
                                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        <span className="text-sm font-medium truncate flex-1">{doc.file.name}</span>

                                        {/* Privacy toggle for this doc */}
                                        <button
                                            type="button"
                                            onClick={() => updateDocumentPrivacy(index, !doc.isPersonal)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${doc.isPersonal
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                }`}
                                            title={doc.isPersonal ? t('budget.personal', 'Personal') : t('budget.shared', 'Shared')}
                                        >
                                            {doc.isPersonal ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                            <span className="hidden sm:inline">{doc.isPersonal ? t('budget.personal', 'Personal') : t('budget.shared', 'Shared')}</span>
                                        </button>

                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={() => removeDocument(index)}
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                                        >
                                            <X className="w-4 h-4 text-gray-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add document button - always visible */}
                        <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                            <Upload className="w-6 h-6 text-gray-400 mb-1" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {(existingDocuments.length + documentFiles.length) > 0
                                    ? t('documents.addMore', 'Add more documents')
                                    : t('documents.dragDrop', 'Click or drag to upload')
                                }
                            </span>
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                                onChange={handleDocumentChange}
                                multiple
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>
            </div>
        );
    };

    if (isFetching) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">{t('common.loading', 'Loading...')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            {/* Header - simplified */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                        {getWizardTitle()}
                    </h2>
                </div>

                {/* Delete button (edit mode only) */}
                {isEditMode && (
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                    >
                        {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{t('common.delete', 'Delete')}</span>
                    </button>
                )}
            </div>

            {/* Centered Content Area */}
            <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto px-4 sm:px-6 py-6 pb-12">
                <div className="w-full max-w-lg">
                    {/* Step Progress - above content */}
                    <div className="flex items-center justify-center gap-1 mb-8">
                        {steps.map((step, index) => (
                            <button
                                key={step.id}
                                onClick={() => goToStep(index)}
                                disabled={!isEditMode && index > currentStep}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${index === currentStep
                                    ? `${colorScheme.stepActiveBg} ${colorScheme.stepActiveText}`
                                    : isEditMode || index < currentStep
                                        ? 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                                        : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                    }`}
                            >
                                {!isEditMode && index < currentStep ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    step.icon
                                )}
                                <span className="hidden sm:inline">{step.title}</span>
                            </button>
                        ))}
                    </div>

                    {/* Form Content */}
                    {renderStepContent()}

                    {/* Navigation Buttons - inline below content */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={currentStep === 0 ? onClose : goToPrevStep}
                            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            {currentStep === 0 ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}
                        </button>

                        {currentStep < steps.length - 1 ? (
                            <button
                                onClick={goToNextStep}
                                className={`flex items-center gap-2 px-6 py-2.5 ${colorScheme.btnBg} text-white rounded-xl font-medium transition-colors`}
                            >
                                {t('common.next', 'Next')}
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className={`flex items-center gap-2 px-6 py-2.5 ${colorScheme.btnBg} text-white rounded-xl font-medium transition-colors disabled:opacity-50`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Check className="w-5 h-5" />
                                )}
                                {isEditMode ? t('common.save', 'Save') : t('common.create', 'Create')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemWizard;
