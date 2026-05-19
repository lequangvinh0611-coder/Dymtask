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
    <div className={cn("relative", isOpen ? "z-[100]" : "z-[50]", className)} ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-8 font-black text-slate-600 cursor-pointer hover:border-indigo-300 transition-all uppercase tracking-widest relative select-none",
          isOpen && "border-indigo-500 ring-4 ring-indigo-500/10 bg-white"
        )}
      >
        <div className="flex-1 flex items-center overflow-hidden pr-6">
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
        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 absolute right-2.5", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[110] w-[300px] bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top">
          <div className="p-3 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input 
                autoFocus
                type="text"
                className="w-full pl-9 pr-3 py-2 text-[12px] font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-700 placeholder:text-slate-300 shadow-sm"
                placeholder="Tìm kiếm danh sách..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-white">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.id);
                return (
                  <div 
                    key={option.id}
                    onClick={() => toggleOption(option.id)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl cursor-pointer transition-all mb-1 last:mb-0 select-none group",
                      isSelected 
                        ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200/50" 
                        : "hover:bg-slate-50 text-slate-500 hover:text-indigo-600"
                    )}
                  >
                    <span className="truncate pr-4 group-hover:translate-x-1 transition-transform">{option.name}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-10 text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center italic flex flex-col items-center gap-2">
                <Search className="w-6 h-6 opacity-20" />
                <span>Không tìm thấy kết quả</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
