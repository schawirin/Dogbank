import React from 'react';

const PawIcon = ({ className = '' }) => (
  <svg
    viewBox="0 0 64 64"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <ellipse cx="19" cy="23" rx="7" ry="10" transform="rotate(-25 19 23)" />
    <ellipse cx="31" cy="16" rx="7" ry="10" />
    <ellipse cx="45" cy="23" rx="7" ry="10" transform="rotate(25 45 23)" />
    <ellipse cx="52" cy="36" rx="6" ry="8" transform="rotate(25 52 36)" />
    <path d="M18.5 45.2c0-9.4 6.4-17 14.3-17 8 0 15.7 8 15.7 17.2 0 6.1-3.6 9.9-8.8 9.9-3 0-4.5-1.5-7-1.5-2.4 0-4 1.5-7 1.5-4.4 0-7.2-3.8-7.2-10.1z" />
  </svg>
);

const Logo = ({
  className = '',
  textClassName = 'text-[22px]',
  iconClassName = 'w-6 h-6',
  showText = true,
}) => (
  <div className={`inline-flex items-center gap-1.5 text-purple-600 ${className}`}>
    {showText && (
      <span className={`${textClassName} font-extrabold tracking-normal leading-none`}>
        DogBank
      </span>
    )}
    <PawIcon className={`${iconClassName} fill-current -mt-1`} />
  </div>
);

export default Logo;
