// client/src/components/ui/Card.jsx
import React from 'react';

export const Card = ({ 
  children, 
  variant = 'default', 
  hover = false, 
  padding = true,
  className = '', 
  ...props 
}) => {
  const variants = {
    default: 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700',
    elevated: 'bg-white dark:bg-gray-800 shadow-lg',
    timeline: 'bg-white border border-gray-100 shadow-sm',
    transport: 'bg-blue-50 dark:bg-blue-900/20 border-0',
    lodging: 'bg-emerald-50 dark:bg-emerald-900/20 border-0',
    activity: 'bg-purple-50 dark:bg-purple-900/20 border-0',
    glass: 'bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border border-white/20',
  };

  return (
    <div 
      className={`
        rounded-2xl overflow-hidden
        transition-all duration-300
        ${variants[variant]}
        ${hover ? 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer' : ''}
        ${padding ? '' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '', ...props }) => {
  return (
    <h3 
      className={`text-lg font-semibold text-gray-900 dark:text-white font-display ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription = ({ children, className = '', ...props }) => {
  return (
    <p 
      className={`text-sm text-gray-500 dark:text-gray-400 mt-1 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
};

export const CardContent = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardFooter = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// Compact card for timeline items
export const MiniCard = ({ 
  children, 
  variant = 'default', 
  icon,
  className = '', 
  ...props 
}) => {
  const variants = {
    default: 'bg-gray-50 dark:bg-gray-700/50',
    transport: 'bg-blue-50 dark:bg-blue-900/20',
    lodging: 'bg-emerald-50 dark:bg-emerald-900/20',
    activity: 'bg-purple-50 dark:bg-purple-900/20',
    warning: 'bg-amber-50 dark:bg-amber-900/20',
  };

  const iconColors = {
    default: 'bg-gray-500',
    transport: 'bg-blue-500',
    lodging: 'bg-emerald-500',
    activity: 'bg-purple-500',
    warning: 'bg-amber-500',
  };

  return (
    <div 
      className={`
        flex items-center gap-3 p-3 rounded-xl
        transition-all duration-200
        hover:shadow-sm
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {icon && (
        <div className={`w-8 h-8 rounded-lg ${iconColors[variant]} flex items-center justify-center flex-shrink-0`}>
          {React.cloneElement(icon, { className: 'w-4 h-4 text-white' })}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
};
