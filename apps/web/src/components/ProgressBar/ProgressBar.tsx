import React from 'react';
import { ProgressBar as PRProgressBar } from 'primereact/progressbar';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label = "Progress",
  showPercentage = true,
  className = "",
  size = 'medium'
}) => {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  
  // Size configurations
  const sizeConfig = {
    small: 'h-1',
    medium: 'h-1.5', 
    large: 'h-2'
  };

  const textSizeConfig = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Label and percentage */}
      <div className="flex justify-between items-center mb-2 ">
        <span className={`font-medium text-brand-text ${textSizeConfig[size]}`}>
          {label}
        </span>
        {showPercentage && (
          <span className={`font-medium text-brand-text ${textSizeConfig[size]}`}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
      
      {/* Progress Bar */}
      <PRProgressBar 
        value={percentage}
        color={`#E36A2E`}
        className={`progress-bar-${size} text-xs`}
        style={{ height: size === 'small' ? '16px' : size === 'medium' ? '24px' : '32px' }} //adjust text size
      />
    </div>
  );
};

export default ProgressBar;