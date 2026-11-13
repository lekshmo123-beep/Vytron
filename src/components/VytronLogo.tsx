import React from 'react';

export const VytronLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Minimal architectural connected-node lattice representing VYTRON */}
    <path
      d="M7 8L16 25L25 8"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
    <path
      d="M11 13.5H21"
      stroke="#3B82F6"
      strokeWidth="1.75"
      strokeLinecap="square"
    />
    <rect x="4.5" y="5.5" width="5" height="5" fill="#0F1115" stroke="currentColor" strokeWidth="1.8" />
    <rect x="22.5" y="5.5" width="5" height="5" fill="#0F1115" stroke="currentColor" strokeWidth="1.8" />
    <rect x="13.5" y="22.5" width="5" height="5" fill="#2563EB" stroke="#3B82F6" strokeWidth="1.5" />
  </svg>
);
