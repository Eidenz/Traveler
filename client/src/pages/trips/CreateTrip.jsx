// client/src/pages/trips/CreateTrip.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Upload, X } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { tripAPI } from '../../services/api';
import toast from 'react-hot-toast';

const CreateTrip = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    start_date: new Date(),
    end_date: new Date(new Date().setDate(new Date().getDate() + 7)), // Default to 1 week
  });
  
  const [coverImage, setCoverImage] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
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
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      setCoverImage(file);
      
      // Create a preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setCoverImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Clear error for cover image
      if (errors.cover_image) {
        setErrors(prev => ({ ...prev, cover_image: '' }));
      }
    }
  };
  
  const handleRemoveImage = () => {
    setCoverImage(null);
    setCoverImagePreview(null);
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Trip name is required';
    }
    
    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }
    
    if (!formData.end_date) {
      newErrors.end_date = 'End date is required';
    }
    
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = 'End date must be after start date';
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
          start_date: formData.start_date.toISOString().split('T')[0],
          end_date: formData.end_date.toISOString().split('T')[0],
        };
        
        // Create FormData object for file upload
        const tripFormData = new FormData();
        
        // Append all text data
        Object.keys(formattedData).forEach(key => {
          tripFormData.append(key, formattedData[key]);
        });
        
        // Append cover image if exists
        if (coverImage) {
          tripFormData.append('cover_image', coverImage);
        }
        
        const response = await tripAPI.createTrip(tripFormData);
        
        toast.success('Trip created successfully');
        navigate(`/trips/${response.data.trip.id}`);
      } catch (error) {
        console.error('Error creating trip:', error);
        toast.error(error.response?.data?.message || 'Failed to create trip');
      } finally {
        setLoading(false);
      }
    }
  };
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/trips" 
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to trips
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Trip</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {/* Trip Name */}
              <Input
                label="Trip Name"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Summer in Tokyo"
                error={errors.name}
                required
              />
              
              {/* Trip Description */}
              <div className="space-y-1">
                <label 
                  htmlFor="description" 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="A brief description of your trip"
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
              
              {/* Trip Location */}
              <Input
                label="Location"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Tokyo, Japan"
                icon={<MapPin className="h-5 w-5 text-gray-400" />}
              />
              
              {/* Trip Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label 
                    htmlFor="start_date" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                        block w-full rounded-md pl-10 py-2 pr-3 
                        text-gray-900 dark:text-white
                        border ${errors.start_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                        bg-white dark:bg-gray-800
                        focus:outline-none focus:ring-2 
                        ${errors.start_date ? 'focus:ring-red-500' : 'focus:ring-blue-500'} 
                        focus:border-transparent
                      `}
                    />
                  </div>
                  {errors.start_date && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                      {errors.start_date}
                    </p>
                  )}
                </div>
                
                <div className="space-y-1">
                  <label 
                    htmlFor="end_date" 
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                        block w-full rounded-md pl-10 py-2 pr-3 
                        text-gray-900 dark:text-white
                        border ${errors.end_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                        bg-white dark:bg-gray-800
                        focus:outline-none focus:ring-2 
                        ${errors.end_date ? 'focus:ring-red-500' : 'focus:ring-blue-500'} 
                        focus:border-transparent
                      `}
                    />
                  </div>
                  {errors.end_date && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                      {errors.end_date}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Cover Image */}
              <div className="space-y-1">
                <label 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Cover Image
                </label>
                
                {coverImagePreview ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden">
                    <img 
                      src={coverImagePreview} 
                      alt="Cover preview" 
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1 bg-gray-800/70 rounded-full text-white hover:bg-gray-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 dark:text-gray-400">
                        <label
                          htmlFor="cover_image"
                          className="relative cursor-pointer rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="cover_image"
                            name="cover_image"
                            type="file"
                            className="sr-only"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PNG, JPG, GIF up to 10MB
                      </p>
                    </div>
                  </div>
                )}
                
                {errors.cover_image && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                    {errors.cover_image}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/trips')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
              >
                Create Trip
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTrip;