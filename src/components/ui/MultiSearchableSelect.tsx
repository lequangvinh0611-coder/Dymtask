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
    <div className={cn("relative z-[60]", className)} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-8 font-black text-slate-600 cursor-pointer hover:border-indigo-300 transition-colors uppercase tracking-widest relative select-none",
          isOpen && "border-indigo-400 ring-2 ring-indigo-500/5 bg-white"
        )}
      >
        <div className="flex-1 flex items-center overflow-hidden pr-4">
          {selectedOptions.length > 0 ? (
            <span className="truncate">
              {selectedOptions[0].name}
              {selectedOptions.length > 1 && (
                <span className="ml-1 text-indigo-500 text-[9px] font-black">+{selectedOptions.length - 1}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform flex-shrink-0 absolute right-2.5", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 z-[100] min-w-[260px] mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input 
                autoFocus
                type="text"
                className="w-full pl-8.5 pr-3 py-2 text-[12px] font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-600"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-white">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.id);
                return (
                  <div 
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all mb-0.5 last:mb-0 select-none",
                      isSelected 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                        : "hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span className="truncate pr-3">{option.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center italic">Không tìm thấy</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
