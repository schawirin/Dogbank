import React from 'react';

const Button = ({ 
  children, 
  type = 'button', 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false, 
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  onClick,
  className = '',
}) => {
  const baseClasses = `
    inline-flex items-center justify-center
    rounded-xl font-semibold
    transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
  `.replace(/\s+/g, ' ').trim();
  
  const variantClasses = {
    primary: `
      bg-gradient-to-r from-violet-600 to-purple-600
      text-white
      hover:from-violet-500 hover:to-purple-500
      hover:shadow-lg hover:shadow-purple-500/25
      focus:ring-purple-500
    `.replace(/\s+/g, ' ').trim(),
    
    secondary: `
      bg-slate-100 text-slate-700
      hover:bg-slate-200
      focus:ring-slate-400
    `.replace(/\s+/g, ' ').trim(),
    
    outline: `
      bg-transparent
      border-2 border-purple-500
      text-purple-600
      hover:bg-purple-50
      focus:ring-purple-500
    `.replace(/\s+/g, ' ').trim(),
    
    ghost: `
      bg-transparent
      text-purple-600
      hover:bg-purple-50
      focus:ring-purple-500
    `.replace(/\s+/g, ' ').trim(),
    
    danger: `
      bg-gradient-to-r from-red-600 to-rose-600
      text-white
      hover:from-red-500 hover:to-rose-500
      hover:shadow-lg hover:shadow-red-500/25
      focus:ring-red-500
    `.replace(/\s+/g, ' ').trim(),
    
    success: `
      bg-gradient-to-r from-emerald-600 to-green-600
      text-white
      hover:from-emerald-500 hover:to-green-500
      hover:shadow-lg hover:shadow-emerald-500/25
      focus:ring-emerald-500
    `.replace(/\s+/g, ' ').trim(),
    
    white: `
      bg-white text-purple-600
      hover:bg-gray-50
      shadow-md hover:shadow-lg
      focus:ring-purple-500
    `.replace(/\s+/g, ' ').trim(),
  };
  
  const sizeClasses = {
    xs: 'py-1.5 px-3 text-xs gap-1.5',
    sm: 'py-2 px-4 text-sm gap-2',
    md: 'py-2.5 px-5 text-base gap-2',
    lg: 'py-3.5 px-7 text-lg gap-2.5',
    xl: 'py-4 px-8 text-xl gap-3',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  const LoadingSpinner = () => (
    <svg 
      className="animate-spin h-4 w-4" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <>
          <LoadingSpinner />
          <span>Carregando...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
