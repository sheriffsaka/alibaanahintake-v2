
import React from 'react';

const AlIbaanahLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg width="150" height="40" viewBox="0 0 150 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <clipPath id="logoClip">
          <rect width="45" height="30" y="5" rx="4" />
        </clipPath>
      </defs>

      {/* Green Box */}
      <rect width="45" height="30" y="5" fill="#0f4c3b" rx="4"/>

      {/* Arabic text - simplified representation */}
      <g clipPath="url(#logoClip)">
        <text x="22.5" y="27" fontFamily="Amiri, serif" fontSize="16" fill="white" textAnchor="middle">
            مَركَزُ
        </text>
         <text x="22.5" y="18" fontFamily="Amiri, serif" fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">
            الإِبَانَة
        </text>
      </g>
      
      {/* English Text */}
      <g>
        <text x="55" y="18" fontFamily="sans-serif" fontSize="13" fill="#0f4c3b" fontWeight="bold">al ibaanah</text>
        <text x="55" y="32" fontFamily="sans-serif" fontSize="10" fill="gray">arabic centre</text>
      </g>

       {/* Vertical Line Separator */}
       <rect x="50" y="10" width="1" height="20" fill="#e5e7eb"/>
    </svg>
  );
};

export default AlIbaanahLogo;
