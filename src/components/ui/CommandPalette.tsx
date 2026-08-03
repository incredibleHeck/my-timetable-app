import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  LayoutDashboard,
  Users,
  BookOpen,
  Library,
  Zap,
  BarChart3,
  FileText,
  Shield,
  Sliders,
  Building2,
  User,
  GraduationCap,
} from "lucide-react";
import { AppData, ViewState } from "../../types";

interface CommandPaletteProps {
  data: AppData;
  onNavigate: (view: ViewState) => void;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

const NAV_ITEMS: { view: ViewState; label: string; icon: React.ReactNode }[] = [
  { view: "DASHBOARD", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { view: "CONFIG", label: "Configuration", icon: <Sliders size={16} /> },
  { view: "TEACHERS", label: "Teachers", icon: <Users size={16} /> },
  { view: "ROOMS", label: "Rooms", icon: <Building2 size={16} /> },
  { view: "SUBJECTS", label: "Subjects", icon: <Library size={16} /> },
  { view: "CLASSES", label: "Classes", icon: <BookOpen size={16} /> },
  { view: "GENERATOR", label: "Auto-Generator", icon: <Zap size={16} /> },
  { view: "WORKLOAD", label: "Workload Analysis", icon: <BarChart3 size={16} /> },
  { view: "EXAMS", label: "Exam Timetable", icon: <FileText size={16} /> },
  { view: "DUTY", label: "Duty Roster", icon: <Shield size={16} /> },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ data, onNavigate, onClose }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allItems = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.view}`,
      label: n.label,
      sublabel: "Navigate",
      icon: n.icon,
      action: () => onNavigate(n.view),
      category: "Navigation",
    }));

    const teacherItems: CommandItem[] = data.teachers.map((t) => ({
      id: `teacher-${t.id}`,
      label: t.name,
      sublabel: `Teacher · ${t.specialtyIds.length} subject${t.specialtyIds.length !== 1 ? "s" : ""}`,
      icon: <User size={16} />,
      action: () => onNavigate("TEACHERS"),
      category: "Teachers",
    }));

    const classItems: CommandItem[] = data.classes.map((c) => ({
      id: `class-${c.id}`,
      label: c.name,
      sublabel: `Class · ${c.curriculum.length} subjects`,
      icon: <GraduationCap size={16} />,
      action: () => onNavigate("CLASSES"),
      category: "Classes",
    }));

    const subjectItems: CommandItem[] = data.subjects.map((s) => ({
      id: `subject-${s.id}`,
      label: s.name,
      sublabel: "Subject",
      icon: <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: s.color }} />,
      action: () => onNavigate("SUBJECTS"),
      category: "Subjects",
    }));

    return [...navItems, ...teacherItems, ...classItems, ...subjectItems];
  }, [data, onNavigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12);
    const q = query.toLowerCase();
    return allItems
      .filter(
        (item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, allItems]);

  // Reset selection when results change
  useEffect(() => setSelectedIndex(0), [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach((item) => {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    });
    return map;
  }, [filtered]);

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Palette Panel */}
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search views, teachers, classes, subjects..."
            className="flex-1 text-slate-800 placeholder:text-slate-400 text-sm font-medium bg-transparent outline-none"
          />
          <kbd className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No results found.</div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {category}
                </div>
                {items.map((item) => {
                  const idx = globalIndex++;
                  const isActive = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive ? "bg-amber-50 text-amber-900" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`shrink-0 ${isActive ? "text-amber-600" : "text-slate-400"}`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-semibold block truncate">{item.label}</span>
                        {item.sublabel && (
                          <span className="text-[11px] text-slate-400">{item.sublabel}</span>
                        )}
                      </span>
                      {isActive && (
                        <kbd className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-4 text-[10px] text-slate-400 font-medium">
          <span>
            <kbd className="bg-slate-100 px-1 rounded border border-slate-200">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="bg-slate-100 px-1 rounded border border-slate-200">↵</kbd> Open
          </span>
          <span>
            <kbd className="bg-slate-100 px-1 rounded border border-slate-200">Esc</kbd> Close
          </span>
          <span className="ml-auto opacity-60">Ctrl+K to toggle</span>
        </div>
      </div>
    </div>
  );
};
