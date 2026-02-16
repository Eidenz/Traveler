// client/src/pages/trips/CreateTrip.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, MapPin, Upload, X, Image, 
  Sparkles, ChevronRight, Check
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { tripAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const CreateTrip = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    start_date: new Date(),
    end_date: new Date(new Date().setDate(new Date().getDate() + 7)),
  });
  
  const [coverImage, setCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [dragActive, setDragActive] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  const handleDateChange = (field, date) => {
    setFormData(prev => ({ ...prev, [field]: date }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const processImage = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('errors.invalidImage', 'Please select an image file'));
      return;
    }
    
    setCoverImage(file);
    const reader = new FileReader();
    reader.onload = () => setCoverImagePreview(reader.result);
    reader.readAsDataURL(file);
    
    if (errors.cover_image) {
      setErrors(prev => ({ ...prev, cover_image: '' }));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImage(e.dataTransfer.files[0]);
    }
  };
  
  const handleRemoveImage = () => {
    setCoverImage(null);
    setCoverImagePreview(null);
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('errors.required', { field: t('trips.tripName') });
    }
    
    if (!formData.start_date) {
      newErrors.start_date = t('errors.required', { field: t('trips.startDate') });
    }
    
    if (!formData.end_date) {
      newErrors.end_date = t('errors.required', { field: t('trips.endDate') });
    }
    
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = t('errors.dateAfter', {
        endField: t('trips.endDate'),
        startField: t('trips.startDate')
      });
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      try {
        setLoading(true);
        
        const formattedData = {
          ...formData,
          start_date: dayjs(formData.start_date).format('YYYY-MM-DD'),
          end_date: dayjs(formData.end_date).format('YYYY-MM-DD'),
        };
        
        const tripFormData = new FormData();
        Object.keys(formattedData).forEach(key => {
          tripFormData.append(key, formattedData[key]);
        });
        
        if (coverImage) {
          tripFormData.append('cover_image', coverImage);
        }
        
        const response = await tripAPI.createTrip(tripFormData);
        
        toast.success(t('trips.createSuccess'));
        navigate(`/trips/${response.data.trip.id}`);
      } catch (error) {
        console.error('Error creating trip:', error);
        toast.error(error.response?.data?.message || t('errors.saveFailed'));
      } finally {
        setLoading(false);
      }
    }
  };

  // Calculate trip duration
  const tripDuration = formData.start_date && formData.end_date
    ? dayjs(formData.end_date).diff(dayjs(formData.start_date), 'day')
    : 0;
  
  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/trips" 
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t('common.back', 'Back to trips')}
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent-soft flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
                {t('trips.createTrip', 'Create a new trip')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {t('trips.createSubtitle', 'Start planning your next adventure')}
              </p>
            </div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Cover Image Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {coverImagePreview ? (
              <div className="relative h-56">
                <img 
                  src={coverImagePreview} 
                  alt="Cover preview" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="text-sm opacity-80">{t('trips.coverImage', 'Cover image')}</p>
                  <p className="font-medium">{coverImage?.name}</p>
                </div>
              </div>
            ) : (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`
                  h-56 flex flex-col items-center justify-center p-8 transition-colors cursor-pointer
                  ${dragActive 
                    ? 'bg-accent-soft border-2 border-dashed border-accent' 
                    : 'bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-accent hover:bg-accent-soft/30'
                  }
                `}
                onClick={() => document.getElementById('cover_image').click()}
              >
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('trips.dropCover', 'Drop your cover image here')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('trips.orClickUpload', 'or click to browse')}
                </p>
                <input
                  id="cover_image"
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            )}
          </div>

          {/* Trip Details */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
            <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white">
              {t('trips.tripDetails', 'Trip details')}
            </h2>
            
            <Input
              label={t('trips.tripName', 'Trip name')}
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('trips.tripNamePlaceholder', 'Summer in Tokyo')}
              error={errors.name}
              required
            />
            
            <Input
              label={t('trips.location', 'Destination')}
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder={t('trips.locationPlaceholder', 'Tokyo, Japan')}
              icon={<MapPin className="h-5 w-5 text-gray-400" />}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('trips.description', 'Description')}
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder={t('trips.descriptionPlaceholder', 'A brief description of your trip...')}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Dates Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-display font-medium text-gray-900 dark:text-white">
                {t('trips.dates', 'Dates')}
              </h2>
              {tripDuration > 0 && (
                <span className="px-3 py-1 bg-accent-soft text-accent text-sm font-medium rounded-full">
                  {tripDuration} {tripDuration === 1 ? t('common.night', 'night') : t('common.nights', 'nights')}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('trips.startDate', 'Start date')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <DatePicker
                    selected={formData.start_date}
                    onChange={(date) => handleDateChange('start_date', date)}
                    selectsStart
                    startDate={formData.start_date}
                    endDate={formData.end_date}
                    dateFormat="MMMM d, yyyy"
                    className={`
                      w-full rounded-xl pl-12 py-3 pr-4 
                      text-gray-900 dark:text-white
                      border ${errors.start_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                      bg-white dark:bg-gray-800
                      focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                      transition-all
                    `}
                  />
                </div>
                {errors.start_date && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.start_date}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('trips.endDate', 'End date')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <DatePicker
                    selected={formData.end_date}
                    onChange={(date) => handleDateChange('end_date', date)}
                    selectsEnd
                    startDate={formData.start_date}
                    endDate={formData.end_date}
                    minDate={formData.start_date}
                    dateFormat="MMMM d, yyyy"
                    className={`
                      w-full rounded-xl pl-12 py-3 pr-4 
                      text-gray-900 dark:text-white
                      border ${errors.end_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                      bg-white dark:bg-gray-800
                      focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                      transition-all
                    `}
                  />
                </div>
                {errors.end_date && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.end_date}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/trips')}
              disabled={loading}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            
            <Button
              type="submit"
              loading={loading}
              icon={<Check className="w-5 h-5" />}
            >
              {t('trips.createTrip', 'Create trip')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTrip;
