// client/src/components/trips/ItemWizard.jsx
import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, X, Check, Calendar, Clock, MapPin,
    Plane, Train, Bus, Car, Ship, Bed, Coffee, Upload, Image as ImageIcon,
    FileText, Lock, Users, Tag, Building, Trash2, MoreHorizontal, Loader2, Eye, Download, Link2,
    Wallet, Search
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { uploadErrorMessage } from '../../utils/documentActions';
import TimeInput from '../ui/TimeInput';
import dayjs from 'dayjs';
import { transportAPI, lodgingAPI, activityAPI, documentAPI, budgetAPI } from '../../services/api';
import { geocodeLocation } from '../../utils/geocoding';
import { getImageUrl } from '../../utils/imageUtils';
import { symbolFor } from '../../utils/currencyUtils';
import useAuthStore from '../../stores/authStore';

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
    tripEndDate,
    members = [] // Trip members, for the participants picker
}) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const isEditMode = !!itemId;
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);

    // Form data based on type
    const [formData, setFormData] = useState(() => getInitialFormData(type, defaultDate));
    // Who takes part: null = everyone (the default), otherwise a subset of member ids
    const [participantIds, setParticipantIds] = useState(null);

    // Shared-expense attachment (group budget only — personal money stays in
    // the budget tab). An item carries at most one linked expense.
    const [budgetInfo, setBudgetInfo] = useState(null); // { budget, expenses } once loaded
    const [expenseMode, setExpenseMode] = useState('none'); // 'none' | 'new' | 'link'
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expensePaidBy, setExpensePaidBy] = useState(null); // null = current user, 'none' = no settlement
    const [expenseSplitIds, setExpenseSplitIds] = useState(null); // null = follow the item's participants
    const [expenseLinkQuery, setExpenseLinkQuery] = useState('');
    const [expenseLinkId, setExpenseLinkId] = useState(null);
    const [linkedExpense, setLinkedExpense] = useState(null); // already linked (edit mode)
    const [unlinkOnSave, setUnlinkOnSave] = useState(false);

    // The server stores transport references as 'transportation'
    const expenseRefType = type === 'transport' ? 'transportation' : type;

    // Who a tracked expense splits between: an explicit choice, else the
    // item's participants, else everyone (a "6 do it, 5 pay" group is why
    // the split stays editable here)
    const expenseTracked = expensePaidBy !== 'none';
    const effectiveSplitIds = expenseSplitIds ?? participantIds ?? members.map((m) => m.id);
    const toggleSplitMember = (id) => {
        const next = effectiveSplitIds.includes(id)
            ? effectiveSplitIds.filter((x) => x !== id)
            : [...effectiveSplitIds, id];
        if (next.length === 0) return; // someone has to carry the expense
        setExpenseSplitIds(next);
    };
    const [bannerImage, setBannerImage] = useState(null);
    const [documentFiles, setDocumentFiles] = useState([]); // Array of {file, isPersonal} objects for NEW uploads
    const [documentLinks, setDocumentLinks] = useState([]); // Array of {url, title, isPersonal} for NEW link documents
    const [existingDocuments, setExistingDocuments] = useState([]); // Existing documents from the server
    const [deletingDocId, setDeletingDocId] = useState(null);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrlInput, setLinkUrlInput] = useState('');
    const [linkTitleInput, setLinkTitleInput] = useState('');
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
                time_exact: '',
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
                departure_time_exact: '',
                arrival_date: null,
                arrival_time: '',
                arrival_time_exact: '',
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

    // Shared budget + expenses, for the expense attachment section
    useEffect(() => {
        let cancelled = false;
        budgetAPI.getTripBudget(tripId)
            .then((res) => {
                if (!cancelled) setBudgetInfo({ budget: res.data.budget, expenses: res.data.expenses || [] });
            })
            .catch(() => {
                if (!cancelled) setBudgetInfo({ budget: null, expenses: [] });
            });
        return () => { cancelled = true; };
    }, [tripId]);

    // In edit mode, surface the expense already linked to this item
    useEffect(() => {
        if (!isEditMode || !budgetInfo) {
            setLinkedExpense(null);
            setUnlinkOnSave(false);
            return;
        }
        const linked = budgetInfo.expenses.find(
            (e) => e.reference_type === expenseRefType && e.reference_id === Number(itemId)
        );
        setLinkedExpense(linked || null);
        setUnlinkOnSave(false);
    }, [isEditMode, budgetInfo, expenseRefType, itemId]);

    // Reset form when switching from edit to create mode or when defaultDate changes
    useEffect(() => {
        if (!isEditMode) {
            setFormData(getInitialFormData(type, defaultDate));
            setParticipantIds(null);
            setExpenseMode('none');
            setExpenseAmount('');
            setExpensePaidBy(null);
            setExpenseSplitIds(null);
            setExpenseLinkQuery('');
            setExpenseLinkId(null);
            setDocumentFiles([]);
            setExistingDocuments([]);
            setBannerImage(null);
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
                setParticipantIds(activity.participant_ids?.length ? activity.participant_ids : null);
                setFormData({
                    name: activity.name || '',
                    date: activity.date ? parseLocalDate(activity.date) : new Date(),
                    time: activity.time || '',
                    time_exact: activity.time_exact || '',
                    location: activity.location || '',
                    latitude: activity.latitude || null,
                    longitude: activity.longitude || null,
                    confirmation_code: activity.confirmation_code || '',
                    notes: activity.notes || '',
                });
                // Load existing documents
                if (response.data.documents) {
                    setExistingDocuments(response.data.documents);
                }
            } else if (type === 'lodging') {
                response = await lodgingAPI.getLodging(itemId);
                const lodging = response.data.lodging;
                setParticipantIds(lodging.participant_ids?.length ? lodging.participant_ids : null);
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
                // Load existing documents
                if (response.data.documents) {
                    setExistingDocuments(response.data.documents);
                }
            } else if (type === 'transport') {
                response = await transportAPI.getTransportation(itemId);
                const transport = response.data.transportation;
                setParticipantIds(transport.participant_ids?.length ? transport.participant_ids : null);
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
                    departure_time_exact: transport.departure_time_exact || '',
                    arrival_date: transport.arrival_date ? parseLocalDate(transport.arrival_date) : null,
                    arrival_time: transport.arrival_time || '',
                    arrival_time_exact: transport.arrival_time_exact || '',
                    confirmation_code: transport.confirmation_code || '',
                    notes: transport.notes || '',
                });
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

    // TimeInput commits both halves of a time (clock + free text are
    // mutually exclusive; exactly one is non-empty)
    const handleTimeChange = (exactField, textField) => ({ exact, text }) => {
        setFormData(prev => ({ ...prev, [exactField]: exact, [textField]: text }));
    };

    // Toggle a member in the participants selection. Full or empty selections
    // collapse back to null (= everyone) so the default stays the default.
    const toggleParticipant = (id) => {
        setParticipantIds(prev => {
            const all = members.map(m => m.id);
            const current = prev === null ? all : prev;
            const next = current.includes(id)
                ? current.filter(x => x !== id)
                : [...current, id];
            if (next.length === 0 || next.length === all.length) return null;
            return next;
        });
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

    // Queue a link document to be created on save
    const addDocumentLink = () => {
        if (!linkUrlInput.trim()) return;

        // Auto-prepend https:// when the protocol is missing
        let url = linkUrlInput.trim();
        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }
        try {
            new URL(url);
        } catch {
            toast.error(t('documents.invalidUrl', 'Invalid URL'));
            return;
        }

        setDocumentLinks(prev => [...prev, { url, title: linkTitleInput.trim(), isPersonal: false }]);
        setLinkUrlInput('');
        setLinkTitleInput('');
        setShowLinkInput(false);
    };

    // Update link privacy setting
    const updateLinkPrivacy = (index, isPersonal) => {
        setDocumentLinks(prev => prev.map((link, i) =>
            i === index ? { ...link, isPersonal } : link
        ));
    };

    // Remove queued link from list
    const removeDocumentLink = (index) => {
        setDocumentLinks(prev => prev.filter((_, i) => i !== index));
    };

    // Upload queued files and create queued link documents for the saved item
    const savePendingDocuments = async (referenceType, referenceId) => {
        for (const doc of documentFiles) {
            const docData = new FormData();
            docData.append('document', doc.file);
            docData.append('reference_type', referenceType);
            docData.append('reference_id', referenceId);
            docData.append('is_personal', doc.isPersonal ? 'true' : 'false');
            await documentAPI.uploadDocument(docData);
        }
        for (const link of documentLinks) {
            await documentAPI.createLinkDocument({
                url: link.url,
                title: link.title,
                reference_type: referenceType,
                reference_id: referenceId,
                is_personal: link.isPersonal,
            });
        }
    };

    // Expense name/category/date come from the item itself
    const expenseDefaults = () => {
        if (type === 'activity') {
            return { name: formData.name, category: 'activities', date: formData.date };
        }
        if (type === 'lodging') {
            return { name: formData.name, category: 'lodging', date: formData.check_in };
        }
        return {
            name: formData.company || `${formData.from_location} → ${formData.to_location}`,
            category: 'transport',
            date: formData.departure_date,
        };
    };

    // Apply the expense choices after the item itself is saved: unlink,
    // create-and-link, or link an existing shared expense
    const saveExpenseAttachment = async (referenceId) => {
        const budget = budgetInfo?.budget;
        if (!budget) return;
        try {
            if (unlinkOnSave && linkedExpense) {
                await budgetAPI.updateExpense(linkedExpense.id, {
                    reference_type: '', reference_id: '', trip_id: tripId,
                }, tripId);
            }
            if (expenseMode === 'new' && parseFloat(expenseAmount) > 0) {
                const defaults = expenseDefaults();
                await budgetAPI.addExpense(budget.id, {
                    name: defaults.name || t('itemExpense.fallbackName', 'Trip expense'),
                    amount: parseFloat(expenseAmount),
                    category: defaults.category,
                    date: dayjs(defaults.date || new Date()).format('YYYY-MM-DD'),
                    // '' payer = plain expense, no settlement tracking
                    paid_by: expenseTracked ? (expensePaidBy ?? user?.id) : '',
                    split_user_ids: expenseTracked ? effectiveSplitIds : [],
                    reference_type: expenseRefType,
                    reference_id: referenceId,
                    trip_id: tripId,
                }, tripId);
            } else if (expenseMode === 'link' && expenseLinkId) {
                await budgetAPI.updateExpense(expenseLinkId, {
                    reference_type: expenseRefType, reference_id: referenceId, trip_id: tripId,
                }, tripId);
            }
        } catch (error) {
            console.error('Error attaching expense:', error);
            toast.error(t('itemExpense.saveFailed', 'Saved, but the shared expense could not be attached'));
        }
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

        // "New expense" chosen but no usable amount: make the user decide
        // instead of silently dropping the expense
        if (budgetInfo?.budget && expenseMode === 'new' && !(parseFloat(expenseAmount) > 0)) {
            toast.error(t('itemExpense.amountRequired', 'Enter an amount for the shared expense, or switch it back to None'));
            return;
        }

        try {
            setIsLoading(true);

            let formattedData = { ...formData };
            // '[]' means the whole group; a JSON id list pins a subset
            formattedData.participant_ids = JSON.stringify(participantIds ?? []);
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

                // Upload documents / create links if any queued
                const activityId = isEditMode ? itemId : response.data.activity.id;
                await savePendingDocuments('activity', activityId);
                await saveExpenseAttachment(activityId);
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

                // Upload documents / create links if any queued
                const lodgingId = isEditMode ? itemId : response.data.lodging.id;
                await savePendingDocuments('lodging', lodgingId);
                await saveExpenseAttachment(lodgingId);
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

                // Upload documents / create links if any queued
                const transportId = isEditMode ? itemId : response.data.transportation.id;
                await savePendingDocuments('transportation', transportId);
                await saveExpenseAttachment(transportId);
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving:', error);
            // A 413 here means a queued document hit the upload quota
            toast.error(uploadErrorMessage(error, t, t('errors.saveFailed', { item: type })));
        } finally {
            setIsLoading(false);
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
                            <TimeInput
                                label={t('activities.time', 'Time')}
                                exactValue={formData.time_exact}
                                textValue={formData.time}
                                onChange={handleTimeChange('time_exact', 'time')}
                                focusRingClass="focus:ring-purple-500"
                            />

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

                                <TimeInput
                                    label={t('transportation.departureTime', 'Time')}
                                    exactValue={formData.departure_time_exact}
                                    textValue={formData.departure_time}
                                    onChange={handleTimeChange('departure_time_exact', 'departure_time')}
                                />
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

                                <TimeInput
                                    label={t('transportation.arrivalTime', 'Time')}
                                    exactValue={formData.arrival_time_exact}
                                    textValue={formData.arrival_time}
                                    onChange={handleTimeChange('arrival_time_exact', 'arrival_time')}
                                />
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

    // Shared-expense section of the Extras step: show the linked expense,
    // or offer "new" (amount + payer, everything else derived from the item)
    // and "link existing" (fuzzy search over unlinked shared expenses).
    const renderExpenseSection = (color, chipActiveClasses) => {
        if (!budgetInfo) return null; // still loading — the section pops in
        const budget = budgetInfo.budget;
        const label = (
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('itemExpense.title', 'Shared expense')}
            </label>
        );
        if (!budget) {
            return (
                <div>
                    {label}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('itemExpense.noBudget', 'Create a shared budget in the Budget tab to attach expenses here.')}
                    </p>
                </div>
            );
        }

        const currencySymbol = budget.currency || symbolFor(budget.currency_code) || '';
        const memberName = (id) => members.find((m) => m.id === id)?.name || '?';

        // Already linked: show it, allow unlinking
        if (linkedExpense && !unlinkOnSave) {
            return (
                <div>
                    {label}
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                        <Wallet className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{linkedExpense.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {linkedExpense.amount}{currencySymbol}
                                {linkedExpense.paid_by != null && ` · ${t('itemExpense.paidBy', 'paid by')} ${memberName(linkedExpense.paid_by)}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setUnlinkOnSave(true)}
                            className="text-xs font-medium text-red-500 hover:text-red-600 flex-shrink-0"
                        >
                            {t('itemExpense.unlink', 'Unlink')}
                        </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {t('itemExpense.editHint', 'Amounts and splits are edited in the Budget tab.')}
                    </p>
                </div>
            );
        }

        // Candidates for "link existing": shared expenses not tied to another item
        const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const query = normalize(expenseLinkQuery.trim());
        const tokens = query.split(/\s+/).filter(Boolean);
        const linkCandidates = budgetInfo.expenses
            .filter((e) => !e.reference_type)
            .filter((e) => tokens.every((tok) => normalize(e.name).includes(tok)))
            .slice(0, 8);

        const modes = [
            { id: 'none', label: t('itemExpense.modeNone', 'None') },
            { id: 'new', label: t('itemExpense.modeNew', 'New expense') },
            { id: 'link', label: t('itemExpense.modeLink', 'Link existing') },
        ];
        return (
            <div>
                {label}
                {unlinkOnSave && (
                    <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                        {t('itemExpense.willUnlink', '"{{name}}" will be unlinked when you save.', { name: linkedExpense?.name })}
                    </p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                    {modes.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            onClick={() => setExpenseMode(mode.id)}
                            className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${expenseMode === mode.id
                                ? chipActiveClasses[color]
                                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                                }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>

                {expenseMode === 'new' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="any"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    placeholder={t('itemExpense.amount', 'Amount')}
                                    className="w-full pl-4 pr-9 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                    {currencySymbol}
                                </span>
                            </div>
                            <select
                                value={expensePaidBy ?? user?.id ?? 'none'}
                                onChange={(e) => setExpensePaidBy(e.target.value === 'none' ? 'none' : Number(e.target.value))}
                                className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                                {members.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {t('itemExpense.paidByOption', 'Paid by {{name}}', { name: member.name })}
                                    </option>
                                ))}
                                <option value="none">
                                    {t('itemExpense.notTracked', 'No settlement — just record it')}
                                </option>
                            </select>
                        </div>

                        {/* Split, editable: defaults to the item's participants but a
                            payer list can differ ("6 do it, 5 pay") */}
                        {expenseTracked && (
                            <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('itemExpense.splitBetween', 'Split equally between')}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {members.map((member) => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => toggleSplitMember(member.id)}
                                            className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${effectiveSplitIds.includes(member.id)
                                                ? chipActiveClasses[color]
                                                : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                        >
                                            {member.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('itemExpense.newHint', 'Named and dated after this item.')}
                        </p>
                    </div>
                )}

                {expenseMode === 'link' && (
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={expenseLinkQuery}
                                onChange={(e) => setExpenseLinkQuery(e.target.value)}
                                placeholder={t('itemExpense.searchPlaceholder', 'Search shared expenses...')}
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent"
                            />
                        </div>
                        {linkCandidates.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 py-1">
                                {t('itemExpense.noMatches', 'No unlinked shared expenses match.')}
                            </p>
                        ) : (
                            <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar">
                                {linkCandidates.map((expense) => (
                                    <button
                                        key={expense.id}
                                        type="button"
                                        onClick={() => setExpenseLinkId(expense.id === expenseLinkId ? null : expense.id)}
                                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${expenseLinkId === expense.id
                                            ? chipActiveClasses[color]
                                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        <Wallet className={`w-4 h-4 flex-shrink-0 ${expenseLinkId === expense.id ? '' : 'text-gray-400'}`} />
                                        <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {expense.name}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                            {expense.amount}{currencySymbol} · {dayjs(expense.date).format('MMM D')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {expenseLinkId && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('itemExpense.linkHint', 'Will be linked to this item when you save.')}
                            </p>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Extras step (shared across types)
    const renderExtrasStep = (color) => {
        const colorClasses = {
            purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 focus:ring-purple-500',
            green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 focus:ring-green-500',
            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 focus:ring-blue-500',
        };
        // Selected participant chips carry the wizard's type color (full class
        // names — Tailwind can't build them dynamically)
        const chipActiveClasses = {
            purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
            green: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
            blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        };
        const isEveryone = participantIds === null;
        const isSelected = (id) => isEveryone || participantIds.includes(id);

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
                    {/* Participants - only worth showing with company */}
                    {members.length > 1 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('participants.whoGoing', "Who's going?")}
                                </label>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {isEveryone
                                        ? t('participants.everyone', 'Everyone')
                                        : t('participants.countOf', '{{count}} of {{total}}', {
                                            count: participantIds.length, total: members.length
                                        })}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setParticipantIds(null)}
                                    className={`flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full border text-sm font-medium transition-all ${isEveryone
                                        ? chipActiveClasses[color]
                                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                                        }`}
                                >
                                    <Users className="w-4 h-4" />
                                    {t('participants.everyone', 'Everyone')}
                                </button>
                                {members.map((member) => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => toggleParticipant(member.id)}
                                        className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full border text-sm font-medium transition-all ${isSelected(member.id)
                                            ? chipActiveClasses[color]
                                            : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 opacity-60 hover:opacity-100 hover:border-gray-300 dark:hover:border-gray-500'
                                            }`}
                                    >
                                        <span className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                            {member.profile_image ? (
                                                <img
                                                    src={getImageUrl(member.profile_image)}
                                                    alt={member.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                                                    {member.name?.charAt(0)?.toUpperCase()}
                                                </span>
                                            )}
                                        </span>
                                        {member.name}
                                    </button>
                                ))}
                            </div>
                            {!isEveryone && (
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    {t('participants.subsetHint', 'Only the selected travelers are part of this — others can hide it from their view.')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Shared expense (group budget only) */}
                    {renderExpenseSection(color, chipActiveClasses)}

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
                            {t('documents.title', 'Documents')} {(existingDocuments.length + documentFiles.length + documentLinks.length) > 0 && `(${existingDocuments.length + documentFiles.length + documentLinks.length})`}
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
                                            {doc.file_type === 'link' ? (
                                                <Link2 className="w-5 h-5 flex-shrink-0 text-sky-500" />
                                            ) : (
                                                <FileText className={`w-5 h-5 flex-shrink-0 ${doc.is_personal ? 'text-amber-500' : 'text-green-500'
                                                    }`} />
                                            )}
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

                        {/* New link documents to create */}
                        {documentLinks.length > 0 && (
                            <div className="space-y-2 mb-3">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    {t('documents.newLinks', 'New links to add')}
                                </p>
                                {documentLinks.map((link, index) => (
                                    <div key={index} className="flex items-center gap-2 p-3 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-200 dark:border-sky-800">
                                        <Link2 className="w-5 h-5 text-sky-500 flex-shrink-0" />
                                        <span className="text-sm font-medium truncate flex-1" title={link.url}>
                                            {link.title || link.url}
                                        </span>

                                        {/* Privacy toggle for this link */}
                                        <button
                                            type="button"
                                            onClick={() => updateLinkPrivacy(index, !link.isPersonal)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${link.isPersonal
                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                }`}
                                            title={link.isPersonal ? t('budget.personal', 'Personal') : t('budget.shared', 'Shared')}
                                        >
                                            {link.isPersonal ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                            <span className="hidden sm:inline">{link.isPersonal ? t('budget.personal', 'Personal') : t('budget.shared', 'Shared')}</span>
                                        </button>

                                        {/* Remove button */}
                                        <button
                                            type="button"
                                            onClick={() => removeDocumentLink(index)}
                                            className="p-1 hover:bg-sky-100 dark:hover:bg-sky-800 rounded-full"
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

                        {/* Add link */}
                        {showLinkInput ? (
                            <div className="mt-2 p-3 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2">
                                <input
                                    type="url"
                                    value={linkUrlInput}
                                    onChange={(e) => setLinkUrlInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDocumentLink(); } }}
                                    placeholder={t('documents.linkUrlPlaceholder', 'https://example.com/my-ticket')}
                                    autoFocus
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                                />
                                <input
                                    type="text"
                                    value={linkTitleInput}
                                    onChange={(e) => setLinkTitleInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDocumentLink(); } }}
                                    placeholder={t('documents.linkTitlePlaceholder', 'Title (optional, e.g. "Shinkansen QR code")')}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setShowLinkInput(false); setLinkUrlInput(''); setLinkTitleInput(''); }}
                                        className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        {t('common.cancel', 'Cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addDocumentLink}
                                        disabled={!linkUrlInput.trim()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                                    >
                                        <Link2 className="w-3.5 h-3.5" />
                                        {t('documents.addLink', 'Add Link')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowLinkInput(true)}
                                className="mt-2 w-full flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:border-sky-400 hover:text-sky-500 dark:hover:border-sky-500 transition-colors"
                            >
                                <Link2 className="w-4 h-4" />
                                {t('documents.addLink', 'Add Link')}
                            </button>
                        )}
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
