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
    <div className={cn("relative", className)} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex flex-wrap items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 cursor-pointer hover:border-indigo-300 transition-colors min-h-[32px]",
        )}
      >
        {selectedOptions.length > 0 ? (
          <div className="flex items-center gap-1 overflow-hidden">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase tracking-tight max-w-[80px]">
              <span className="truncate">{selectedOptions[0].name}</span>
              <X className="w-2.5 h-2.5 cursor-pointer hover:text-indigo-900 shrink-0" onClick={(e) => removeOption(e, selectedOptions[0].id)} />
            </span>
            {selectedOptions.length > 1 && (
              <span className="text-[9px] font-bold text-slate-400">+{selectedOptions.length - 1}</span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 uppercase tracking-widest text-[10px] w-full text-center pr-2">{placeholder}</span>
        )}
        <ChevronDown className={cn("ml-auto w-3 h-3 text-slate-400 transition-transform flex-shrink-0", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-100">
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
