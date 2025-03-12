// client/src/pages/Calendar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Plane, Coffee, Bed, Info, PlusCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { tripAPI } from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const Calendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    fetchTrips();
  }, []);
  
  useEffect(() => {
    if (trips.length > 0) {
      generateEvents();
    }
  }, [trips, currentDate]);
  
  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await tripAPI.getUserTrips();
      setTrips(response.data.trips || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };
  
  const generateEvents = () => {
    // Get all events for the month
    const generatedEvents = [];
    
    // Generate trip dates
    trips.forEach(trip => {
      const startDate = dayjs(trip.start_date);
      const endDate = dayjs(trip.end_date);
      
      // Add trip start
      generatedEvents.push({
        date: startDate.format('YYYY-MM-DD'),
        type: 'trip-start',
        title: `Trip start: ${trip.name}`,
        trip: trip
      });
      
      // Add trip end
      generatedEvents.push({
        date: endDate.format('YYYY-MM-DD'),
        type: 'trip-end',
        title: `Trip end: ${trip.name}`,
        trip: trip
      });
      
      // Add days during trip
      let currentDay = startDate.add(1, 'day');
      while (currentDay.isBefore(endDate)) {
        generatedEvents.push({
          date: currentDay.format('YYYY-MM-DD'),
          type: 'trip-day',
          title: trip.name,
          trip: trip
        });
        currentDay = currentDay.add(1, 'day');
      }
    });
    
    setEvents(generatedEvents);
  };
  
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };
  
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const handleTodayClick = () => {
    setCurrentDate(new Date());
  };
  
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    // Create blank spaces for days before the 1st of the month
    const blanks = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      blanks.push(
        <div key={`blank-${i}`} className="h-24 md:h-32 border border-gray-200 dark:border-gray-700"></div>
      );
    }
    
    // Create calendar days
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = dayjs(date).format('YYYY-MM-DD');
      const isToday = dayjs().format('YYYY-MM-DD') === dateString;
      
      // Find events for this day
      const dayEvents = events.filter(event => event.date === dateString);
      
      days.push(
        <div 
          key={day} 
          className={`
            h-24 md:h-32 border border-gray-200 dark:border-gray-700 
            overflow-hidden p-1 transition-all
            ${isToday ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' : ''}
            ${dayEvents.length > 0 ? 'hover:shadow-md cursor-pointer' : ''}
          `}
          onClick={() => {
            if (dayEvents.length > 0) {
              // Navigate to the first trip associated with this day
              const tripEvent = dayEvents.find(e => e.trip);
              if (tripEvent) {
                navigate(`/trips/${tripEvent.trip.id}`);
              }
            }
          }}
        >
          <div className="flex items-start justify-between">
            <span className={`
              text-sm font-medium 
              ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}
            `}>
              {day}
            </span>
            
            {dayEvents.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {dayEvents.some(e => e.type === 'trip-start') && (
                  <div className="p-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Plane className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                )}
                
                {dayEvents.some(e => e.type === 'trip-end') && (
                  <div className="p-0.5 rounded-full bg-red-100 dark:bg-red-900/30">
                    <Info className="h-3 w-3 text-red-600 dark:text-red-400" />
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-1 space-y-1 overflow-y-auto max-h-[calc(100%-20px)]">
            {dayEvents.map((event, index) => (
              <div 
                key={index}
                className={`
                  text-xs truncate px-1 py-0.5 rounded
                  ${event.type === 'trip-start' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : ''}
                  ${event.type === 'trip-end' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' : ''}
                  ${event.type === 'trip-day' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : ''}
                `}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Combine blanks and days
    const totalSlots = [...blanks, ...days];
    const rows = [];
    let cells = [];
    
    totalSlots.forEach((slot, i) => {
      if (i % 7 === 0 && i > 0) {
        rows.push(cells);
        cells = [];
      }
      cells.push(slot);
    });
    
    // Add the last row
    if (cells.length > 0) {
      rows.push(cells);
    }
    
    return (
      <div className="grid grid-cols-7 gap-px">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {day}
          </div>
        ))}
        
        {/* Calendar grid */}
        {rows.flat().map((cell, i) => (
          <React.Fragment key={i}>{cell}</React.Fragment>
        ))}
      </div>
    );
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
          <p className="text-gray-500 dark:text-gray-400">
            View all your trips in one place
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button
            variant="outline"
            onClick={handleTodayClick}
            icon={<CalendarIcon className="h-5 w-5" />}
          >
            Today
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/trips/new')}
            icon={<PlusCircle className="h-5 w-5" />}
          >
            New Trip
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-lg font-semibold mx-4">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Trip Start</span>
            </div>
            <div className="flex items-center mr-4">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">During Trip</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Trip End</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded mx-auto"></div>
                <div className="grid grid-cols-7 gap-4">
                  {[...Array(35)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : trips.length > 0 ? (
            renderCalendar()
          ) : (
            <div className="h-96 flex flex-col items-center justify-center p-6">
              <CalendarIcon className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No trips planned
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
                You don't have any trips planned yet. Create your first trip to see it on the calendar.
              </p>
              <Button
                variant="primary"
                onClick={() => navigate('/trips/new')}
                icon={<PlusCircle className="h-5 w-5" />}
              >
                Create First Trip
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Trips</h2>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips
              .filter(trip => new Date(trip.start_date) > new Date())
              .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
              .slice(0, 3)
              .map(trip => (
                <Card key={trip.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/trips/${trip.id}`)}>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-lg mb-1">{trip.name}</h3>
                    <div className="flex items-center text-gray-500 dark:text-gray-400 mb-3">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        {dayjs(trip.start_date).format('MMM D')} - {dayjs(trip.end_date).format('MMM D, YYYY')}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <div className="p-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                          <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
                          <Bed className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="p-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <Coffee className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                      
                      <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        View Trip →
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
            {trips.filter(trip => new Date(trip.start_date) > new Date()).length === 0 && (
              <div className="col-span-full text-center p-6 bg-white dark:bg-gray-800 rounded-lg">
                <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No upcoming trips
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  You don't have any upcoming trips. Create a new trip to add it to your calendar.
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/trips/new')}
                  icon={<PlusCircle className="h-5 w-5" />}
                >
                  Create Trip
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;