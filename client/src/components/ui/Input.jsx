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
  ...props
}, ref) => {
  return (
    <div className="space-y-1 w-full">
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative rounded-md">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
            block w-full rounded-md 
            ${icon ? 'pl-10' : 'pl-3'} 
            py-2 pr-3 
            text-gray-900 dark:text-white
            border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
            bg-white dark:bg-gray-800
            focus:outline-none focus:ring-2 
            ${error ? 'focus:ring-red-500' : 'focus:ring-blue-500'} 
            focus:border-transparent
            disabled:opacity-70 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;