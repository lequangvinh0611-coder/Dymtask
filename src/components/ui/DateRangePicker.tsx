import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState<string | null>(startDate || null);
  const [tempEnd, setTempEnd] = useState<string | null>(endDate || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempStart(startDate || null);
    setTempEnd(endDate || null);
  }, [startDate, endDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateToDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const handleDateClick = (dateStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd(null);
    } else {
      const startParts = tempStart.split('-').map(Number);
      const endParts = dateStr.split('-').map(Number);
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      
      if (end < start) {
        setTempStart(dateStr);
        setTempEnd(null);
      } else {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 62) {
          toast.warning("Khoảng thời gian chọn không được vượt quá 62 ngày!");
          const adjustedEndDate = new Date(start.getTime() + 62 * 24 * 60 * 60 * 1000);
          const adjustedEndDateStr = formatDate(adjustedEndDate);
          setTempEnd(adjustedEndDateStr);
          onChange(tempStart, adjustedEndDateStr);
          setIsOpen(false);
          return;
        }
        setTempEnd(dateStr);
        onChange(tempStart, dateStr);
        setIsOpen(false);
      }
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const days = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const startOffset = days[0].getDay();
  const blanks = Array(startOffset).fill(null);

  return (
    <div className={cn("relative h-8 flex items-center shrink-0 z-20 overflow-visible", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 h-8 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all min-w-[180px] shrink-0 cursor-pointer pointer-events-auto"
      >
        <CalendarIcon size={14} className="text-slate-400 shrink-0" />
        <span className="truncate">
          {startDate ? `${formatDateToDisplay(startDate)} - ${formatDateToDisplay(endDate || startDate)}` : "Chọn ngày"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 z-[100] w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <button 
              type="button"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
            >
              <ChevronLeft size={16} />
            </button>
            <h4 className="text-xs font-semibold text-slate-900">
              {currentMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </h4>
            <button 
              type="button"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
            ))}
            {blanks.map((_, i) => <div key={`b-${i}`} />)}
            {days.map(d => {
              const dStr = formatDate(d);
              const isStart = tempStart === dStr;
              const isEnd = tempEnd === dStr;
              const isInRange = tempStart && tempEnd && dStr > tempStart && dStr < tempEnd;
              
              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => handleDateClick(dStr)}
                  className={cn(
                    "text-xs font-medium py-1.5 rounded-lg transition-all z-10",
                    isStart || isEnd ? "bg-indigo-600 text-white" :
                    isInRange ? "bg-indigo-50 text-indigo-600" :
                    "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <p className="text-xs font-medium text-slate-400 italic">Tối đa 62 ngày</p>
            <button 
              type="button"
              onClick={() => { setTempStart(null); setTempEnd(null); onChange('', ''); setIsOpen(false); }}
              className="text-xs font-semibold text-rose-500 hover:text-rose-600"
            >
              Xóa lọc
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
