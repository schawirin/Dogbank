import React from 'react';

const Card = ({ 
  children, 
  title,
  subtitle,
  icon,
  action,
  variant = 'default',
  hover = false,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  onClick,
}) => {
  const variantClasses = {
    default: 'bg-white border border-slate-200/60',
    elevated: 'bg-white shadow-medium',
    outlined: 'bg-white border-2 border-slate-200',
    gradient: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0',
    glass: 'bg-white/80 backdrop-blur-lg border border-white/20',
    muted: 'bg-slate-50 border border-slate-200/60',
  };

  const hoverClasses = hover 
    ? 'cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg' 
    : '';

  const isGradient = variant === 'gradient';

  return (
    <div 
      className={`
        rounded-2xl overflow-hidden
        ${variantClasses[variant] || variantClasses.default}
        ${hoverClasses}
        ${className}
      `.replace(/\s+/g, ' ').trim()}
      onClick={onClick}
    >
      {(title || subtitle || icon || action) && (
        <div className={`
          px-6 py-4 
          ${!isGradient ? 'border-b border-slate-100' : 'border-b border-white/10'}
          flex items-center justify-between
          ${headerClassName}
        `.replace(/\s+/g, ' ').trim()}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center
                ${isGradient ? 'bg-white/20' : 'bg-violet-100'}
              `}>
                <span className={isGradient ? 'text-white' : 'text-violet-600'}>
                  {icon}
                </span>
              </div>
            )}
            <div>
              {title && (
                <h3 className={`
                  text-lg font-semibold
                  ${isGradient ? 'text-white' : 'text-slate-800'}
                `}>
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className={`
                  text-sm mt-0.5
                  ${isGradient ? 'text-white/70' : 'text-slate-500'}
                `}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && (
            <div className="flex-shrink-0">
              {action}
            </div>
          )}
        </div>
      )}
      <div className={`px-6 py-5 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

// Sub-components for more flexibility
Card.Header = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-slate-100 ${className}`}>
    {children}
  </div>
);

Card.Body = ({ children, className = '' }) => (
  <div className={`px-6 py-5 ${className}`}>
    {children}
  </div>
);

Card.Footer = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-t border-slate-100 bg-slate-50/50 ${className}`}>
    {children}
  </div>
);

export default Card;
