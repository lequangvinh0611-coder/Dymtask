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
          "flex items-center justify-between px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-8 font-black text-slate-600 cursor-pointer hover:border-indigo-300 transition-colors min-w-[120px] uppercase tracking-widest relative",
        )}
      >
        <div className="flex-1 flex justify-center overflow-hidden pr-4">
          {selectedOptions.length > 0 ? (
            <span className="truncate text-center">
              {selectedOptions[0].name}
              {selectedOptions.length > 1 && (
                <span className="ml-1 text-indigo-500">+{selectedOptions.length - 1}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform flex-shrink-0 absolute right-2", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 min-w-[200px] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                autoFocus
                type="text"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.id);
                return (
                  <div 
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wide rounded-md cursor-pointer transition-colors mb-0.5 last:mb-0",
                      isSelected ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span className="truncate">{option.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Không tìm thấy kết quả</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
