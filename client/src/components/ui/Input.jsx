// client/src/components/ui/Input.jsx
import React, { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  type = 'text',
  id,
  name,
  value,
  onChange,
  placeholder,
  className = '',
  error,
  required = false,
  disabled = false,
  icon,
  hint,
  ...props
}, ref) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            block w-full rounded-xl
            ${icon ? 'pl-12' : 'pl-4'} 
            py-3 pr-4 
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
            bg-white dark:bg-gray-800
            focus:outline-none focus:ring-2 
            ${error ? 'focus:ring-red-500/50 focus:border-red-500' : 'focus:ring-accent/50 focus:border-accent'} 
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${className}
          `}
          {...props}
        />
      </div>
      
      {hint && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
      
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
