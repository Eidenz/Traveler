// client/src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Compass } from 'lucide-react';
import Button from '../components/ui/Button';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-9xl font-bold text-blue-600 dark:text-blue-500">404</h1>
        
        <div className="mb-8 mt-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Page not found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button 
            variant="primary"
            onClick={() => window.history.back()}
            icon={<ArrowLeft className="h-5 w-5" />}
          >
            Go Back
          </Button>
          
          <Link to="/dashboard">
            <Button
              variant="secondary"
              icon={<Home className="h-5 w-5" />}
            >
              Go to Dashboard
            </Button>
          </Link>
          
          <Link to="/trips">
            <Button
              variant="outline"
              icon={<Compass className="h-5 w-5" />}
            >
              View Trips
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;