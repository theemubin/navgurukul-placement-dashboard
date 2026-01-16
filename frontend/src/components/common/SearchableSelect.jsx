import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, ChevronDown } from 'lucide-react';

const SearchableSelect = ({
    options = [],
    value,
    onChange,
    onAdd,
    placeholder = 'Select an option',
    label,
    disabled = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const showAddOption = searchTerm && !options.some(opt => opt.toLowerCase() === searchTerm.toLowerCase());

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (option) => {
        onChange(option);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleAdd = () => {
        if (onAdd && searchTerm) {
            onAdd(searchTerm);
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <div
                className={`relative w-full cursor-pointer bg-white border rounded-lg py-2 pl-3 pr-10 text-left transition-all ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500'
                    }`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className={`block truncate ${!value ? 'text-gray-400' : 'text-gray-900'}`}>
                    {value || placeholder}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-fadeIn">
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-1.5 text-sm border-none focus:ring-0 outline-none"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, i) => (
                                <div
                                    key={i}
                                    className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-primary-50 ${value === opt ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                                        }`}
                                    onClick={() => handleSelect(opt)}
                                >
                                    {opt}
                                    {value === opt && <Check className="w-4 h-4" />}
                                </div>
                            ))
                        ) : !showAddOption && (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">No options found</div>
                        )}

                        {showAddOption && (
                            <div
                                className="px-4 py-2 text-sm text-primary-600 cursor-pointer flex items-center gap-2 hover:bg-primary-50 border-t mt-1"
                                onClick={handleAdd}
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add "{searchTerm}"</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
