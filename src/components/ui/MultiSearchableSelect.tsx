import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
  id: string;
  name: string;
  [key: string]: any;
}

interface MultiSearchableSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  condensed?: boolean;
}

export const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  className,
  condensed = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter(o => value.includes(o.id));

  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is less than 300px and space above is greater, flip up
      if (spaceBelow < 300 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  const toggleOption = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const removeOption = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== id));
  };

  return (
    <div className={cn("relative overflow-visible", className)} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm cursor-pointer hover:border-indigo-300 transition-colors min-h-[40px]"
      >
        {selectedOptions.length > 0 ? (
          condensed ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium max-w-[120px]">
                <span className="truncate">{selectedOptions[0].name}</span>
                <X className="w-3 h-3 cursor-pointer hover:text-indigo-900 shrink-0" onClick={(e) => removeOption(e, selectedOptions[0].id)} />
              </span>
              {selectedOptions.length > 1 && (
                <span className="text-xs font-bold text-slate-400">+{selectedOptions.length - 1}</span>
              )}
            </div>
          ) : (
            selectedOptions.map(option => (
              <span key={option.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                {option.name}
                <X className="w-3 h-3 cursor-pointer hover:text-indigo-900" onClick={(e) => removeOption(e, option.id)} />
              </span>
            ))
          )
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown className={cn("ml-auto w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className={cn(
          "absolute z-[100] w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100",
          openUpward ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                autoFocus
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border-none rounded-md focus:ring-0"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.id);
                return (
                  <div 
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors",
                      isSelected ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="truncate">{option.name}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400 italic text-center">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
