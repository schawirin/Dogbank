import React from 'react';

const Input = ({ 
  label, 
  type = 'text', 
  id, 
  name, 
  value, 
  onChange, 
  placeholder = '', 
  error = '', 
  disabled = false,
  className = '' 
}) => {
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 bg-white border ${
          error ? 'border-error focus:ring-error' : 'border-neutral-300 focus:ring-primary-500'
        } rounded-lg shadow-sm focus:outline-none focus:ring-2 ${disabled ? 'bg-neutral-100 cursor-not-allowed' : ''} ${className}`}
      />
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
};

export default Input;