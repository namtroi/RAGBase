import { useClickOutside } from '@/hooks/use-click-outside';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface SelectOption {
    label: string;
    value: string | number;
    count?: number; // Optional count badge
}

interface SelectProps {
    value: string | number;
    onChange: (value: string | number) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function Select({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className,
    disabled = false,
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false));

    const selectedOption = options.find((opt) => opt.value === value);

    const handleSelect = (option: SelectOption) => {
        if (value !== option.value) {
            onChange(option.value);
        }
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className={clsx('relative min-w-[140px]', className)}
        >
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={clsx(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left bg-white border rounded-lg transition-all duration-200 outline-none select-none',
                    isOpen
                        ? 'border-primary-500 ring-1 ring-primary-500 ring-opacity-50'
                        : 'border-gray-300 hover:border-gray-400',
                    disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer',
                    'shadow-sm'
                )}
            >
                <div className="flex items-center gap-2 truncate">
                    <span className={clsx(selectedOption ? 'text-gray-900' : 'text-gray-500')}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    {selectedOption?.count !== undefined && selectedOption.count > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {selectedOption.count}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={clsx(
                        'w-4 h-4 text-gray-500 transition-transform duration-200',
                        isOpen && 'transform rotate-180'
                    )}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 p-1">
                    {options.length > 0 ? (
                        <div className="space-y-0.5">
                            {options.map((option) => {
                                const isSelected = option.value === value;
                                return (
                                    <button
                                        key={String(option.value)}
                                        type="button"
                                        onClick={() => handleSelect(option)}
                                        className={clsx(
                                            'w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-md transition-colors',
                                            isSelected
                                                ? 'bg-primary-50 text-primary-700 font-medium'
                                                : 'text-gray-700 hover:bg-gray-100',
                                        )}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span>{option.label}</span>
                                            {option.count !== undefined && option.count > 0 && (
                                                <span className={clsx(
                                                    "inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium",
                                                    isSelected ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-600"
                                                )}>
                                                    {option.count}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-primary-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                            No options
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
