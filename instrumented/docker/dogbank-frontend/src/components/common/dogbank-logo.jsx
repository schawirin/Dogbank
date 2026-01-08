// src/components/common/Logo.jsx
import React from 'react';
import dogbankLogo from '../../assets/images/dogbank-logo.png';

/**
 * Logo do DogBank com patinha ao final.
 * Pode receber classes extras para ajustar tamanho/estilo.
 */
const Logo = ({ className = '' }) => (
  <img
    src={dogbankLogo}
    alt="DogBank"
    className={className}
  />
);

export default Logo;
