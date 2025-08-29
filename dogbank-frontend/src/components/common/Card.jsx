import React from 'react';

const Card = ({ 
  children, 
  title,
  subtitle,
  className = '',
  headerClassName = '',
  bodyClassName = '',
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-card overflow-hidden ${className}`}>
      {(title || subtitle) && (
        <div className={`px-6 py-4 border-b border-neutral-200 ${headerClassName}`}>
          {title && <h3 className="text-lg font-semibold text-neutral-800">{title}</h3>}
          {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={`px-6 py-5 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
};

export default Card;