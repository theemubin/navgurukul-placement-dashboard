import React from 'react';

const CircularProgress = ({ 
  value, 
  max = 100, 
  size = 80, 
  strokeWidth = 8, 
  label = '', 
  showPercentage = true,
  className = '',
  colors = {
    danger: '#ef4444', // red-500
    warning: '#f59e0b', // amber-500  
    safe: '#10b981' // emerald-500
  }
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Determine color based on value
  const getColor = () => {
    if (percentage >= 70) return colors.safe;
    if (percentage >= 40) return colors.warning;
    return colors.danger;
  };
  
  const color = getColor();
  
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg
          width={size}
          height={size}
          className="absolute top-0 left-0 -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb" // gray-200
            strokeWidth={strokeWidth}
          />
        </svg>
        
        {/* Progress circle */}
        <svg
          width={size}
          height={size}
          className="absolute top-0 left-0 -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        {/* Center text */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          style={{ fontSize: size * 0.2 }}
        >
          <span className="font-black" style={{ color }}>
            {showPercentage ? Math.round(percentage) : value}
            {showPercentage && <span className="text-xs opacity-75">%</span>}
          </span>
        </div>
      </div>
      
      {label && (
        <span 
          className="mt-2 text-center font-medium text-gray-600"
          style={{ fontSize: size * 0.12 }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

// Trust Score specific circular progress
export const TrustScoreCircle = ({ 
  score, 
  size = 100, 
  className = '',
  showLabel = true 
}) => {
  const getVerdict = (score) => {
    if (score >= 70) return { text: 'SAFE', color: '#10b981' };
    if (score >= 40) return { text: 'WARNING', color: '#f59e0b' };
    return { text: 'DANGER', color: '#ef4444' };
  };
  
  const verdict = getVerdict(score);
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <CircularProgress
        value={score}
        max={100}
        size={size}
        strokeWidth={size * 0.08}
        showPercentage={true}
        colors={{
          danger: verdict.color,
          warning: verdict.color,
          safe: verdict.color
        }}
      />
      {showLabel && (
        <div className="mt-2 text-center">
          <div 
            className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full"
            style={{ 
              color: verdict.color,
              backgroundColor: `${verdict.color}10`,
              border: `1px solid ${verdict.color}30`
            }}
          >
            {verdict.text}
          </div>
          <div className="text-xs text-gray-500 mt-1">Trust Score</div>
        </div>
      )}
    </div>
  );
};

// Mini version for the sub-scores grid
export const MiniCircularProgress = ({ 
  value, 
  label, 
  size = 50,
  className = ''
}) => {
  return (
    <div className={`text-center ${className}`}>
      <CircularProgress
        value={value}
        size={size}
        strokeWidth={4}
        showPercentage={true}
      />
      <div className="mt-1 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
};

export default CircularProgress;