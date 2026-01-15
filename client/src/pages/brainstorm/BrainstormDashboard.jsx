// client/src/pages/brainstorm/BrainstormDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Calendar, Map, ArrowRight, Lightbulb, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import { tripAPI } from '../../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getImageUrl, getFallbackImageUrl } from '../../utils/imageUtils';
import Brainstorm from '../trips/Brainstorm';

const BrainstormDashboard = () => {
    const { t } = useTranslation();
    const { tripId: urlTripId } = useParams();
    const navigate = useNavigate();

    const [trips, setTrips] = useState([]);
    const [selectedTrip, setSelectedTrip] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch trips on mount
    useEffect(() => {
        fetchTrips();
    }, []);

    // Handle URL-based trip selection
    useEffect(() => {
        if (urlTripId && trips.length > 0) {
            const trip = trips.find(t => t.id === urlTripId);
            if (trip) {
                setSelectedTrip(trip);
            } else {
                toast.error(t('errors.tripNotFound', 'Trip not found'));
                navigate('/brainstorm');
            }
        }
    }, [urlTripId, trips]);

    const fetchTrips = async () => {
        try {
            const response = await tripAPI.getUserTrips();
            if (response.data.trips) {
                setTrips(response.data.trips);
                // Auto-select if only one trip and no URL param
                if (response.data.trips.length === 1 && !urlTripId) {
                    setSelectedTrip(response.data.trips[0]);
                    navigate(`/brainstorm/${response.data.trips[0].id}`, { replace: true });
                }
            }
        } catch (error) {
            console.error('Error fetching trips:', error);
            toast.error(t('errors.failedFetch'));
        } finally {
            setLoading(false);
        }
    };

    const selectTrip = (trip) => {
        setSelectedTrip(trip);
        navigate(`/brainstorm/${trip.id}`);
    };

    // Loading state
    if (loading && !trips.length) {
        return (
            <div className="h-full flex items-center justify-center page-transition">
                <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // No trips state
    if (!trips.length) {
        return (
            <div className="h-full flex items-center justify-center p-4 page-transition">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-soft flex items-center justify-center">
                        <Lightbulb className="w-10 h-10 text-accent" />
                    </div>
                    <h2 className="text-2xl font-display font-semibold text-gray-900 dark:text-white mb-2">
                        {t('brainstorm.title', 'Brainstorm')}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        {t('brainstorm.noTripsMessage', 'Create a trip first to start brainstorming ideas')}
                    </p>
                    <Link to="/trips/new">
                        <Button icon={<Plus className="w-5 h-5" />}>
                            {t('trips.createTrip', 'Create trip')}
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    // Trip selection state (when no URL param and multiple trips)
    if (!selectedTrip && !urlTripId && trips.length > 1) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar page-transition">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
                                <Lightbulb className="w-6 h-6 text-accent" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
                                    {t('brainstorm.selectTrip', 'Select a trip')}
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {t('brainstorm.selectTripDescription', 'Choose which trip to brainstorm ideas for')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trips.map(trip => (
                            <button
                                key={trip.id}
                                onClick={() => selectTrip(trip)}
                                className="group text-left bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="h-40 relative">
                                    <img
                                        src={trip.cover_image ? getImageUrl(trip.cover_image) : getFallbackImageUrl('trip')}
                                        alt={trip.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                                    <div className="absolute bottom-0 left-0 p-4">
                                        <h2 className="text-lg font-display font-semibold text-white">{trip.name}</h2>
                                        <div className="flex items-center text-white/80 text-sm mt-1">
                                            <Calendar className="w-4 h-4 mr-1.5" />
                                            {dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D')}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                                        <Map className="w-4 h-4 mr-1.5" />
                                        <span className="text-sm">{trip.location || t('common.noLocation', 'No location')}</span>
                                    </div>
                                    <span className="text-accent font-medium text-sm flex items-center group-hover:underline">
                                        {t('brainstorm.start', 'Start brainstorming')}
                                        <ArrowRight className="w-4 h-4 ml-1" />
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Main brainstorm view - render the Brainstorm component with the selected trip
    if (selectedTrip) {
        return <Brainstorm tripId={selectedTrip.id} fromDashboard={true} />;
    }

    // Fallback loading
    return (
        <div className="h-full flex items-center justify-center page-transition">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
    );
};

export default BrainstormDashboard;
