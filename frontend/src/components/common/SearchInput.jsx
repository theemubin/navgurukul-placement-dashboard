import React from 'react';
import { Search, X } from 'lucide-react';

const SearchInput = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  onEnter,
  onClear,
  className = '',
  iconSize = 'w-4 h-4',
  showClearButton = true,
  disabled = false,
  autoFocus = false
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange({ target: { value: '' } });
    }
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={`relative flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <span className="pointer-events-none flex items-center pl-3 pr-2 text-gray-400">
        <Search className={iconSize} />
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full min-w-0 border-0 bg-transparent py-2.5 pr-3 pl-0 text-sm focus:outline-none focus:ring-0"
      />
      {showClearButton && value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
