import React from 'react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  defaultOptionLabel: string;
  options: FilterOption[];
  className?: string;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  defaultOptionLabel,
  options,
  className
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[140px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer text-center ${className || ''}`}
    >
      <option value="">{defaultOptionLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
