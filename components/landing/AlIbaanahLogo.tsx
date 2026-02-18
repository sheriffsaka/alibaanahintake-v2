
import React from 'react';

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  logoUrl?: string;
}

const AlIbaanahLogo: React.FC<LogoProps> = ({ logoUrl, ...props }) => {
  if (!logoUrl) {
    // Fallback or placeholder if URL is not provided
    return (
      <div className="flex items-center justify-center h-12 w-auto bg-gray-200 text-gray-500 rounded" {...props}>
        <span className="text-xs">Logo</span>
      </div>
    );
  }

  return (
    <img src={logoUrl} alt="Al-Ibaanah Logo" {...props} />
  );
};

export default AlIbaanahLogo;
