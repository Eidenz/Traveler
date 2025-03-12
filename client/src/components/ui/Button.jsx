// client/src/components/ui/Button.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  onClick,
  icon,
  ...props
}) => {
  // Button variants
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
    danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800',
    success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800',
    transparent: 'bg-transparent hover:bg-gray-100 text-gray-800 dark:hover:bg-gray-800 dark:text-gray-200',
    outline: 'bg-transparent border border-gray-300 hover:bg-gray-100 text-gray-800 dark:border-gray-600 dark:hover:bg-gray-800 dark:text-gray-200',
  };

  // Button sizes
  const sizes = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
    xl: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        rounded-lg font-medium flex items-center justify-center transition-colors
        ${disabled || loading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {icon && !loading && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;