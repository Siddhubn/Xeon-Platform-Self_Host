"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  prefixIcon?: React.ReactNode;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  prefixIcon,
  searchable = false,
  disabled = false,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
  }>({ top: 0, left: 0, minWidth: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = searchQuery
    ? options.filter((o) =>
        o.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Calculate dropdown position using fixed positioning
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownEstimateHeight = searchable ? 280 : 260;

    const spaceBelow = viewportHeight - rect.bottom;
    const openUpward = spaceBelow < dropdownEstimateHeight && rect.top > spaceBelow;

    setDropdownPos({
      top: openUpward ? rect.top - dropdownEstimateHeight - 4 : rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });
  }, [searchable]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Focus search when opened and recalculate position
  useEffect(() => {
    if (open) {
      calculatePosition();
      if (searchable && searchRef.current) {
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
  }, [open, searchable, calculatePosition]);

  // Recalculate on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const recalc = () => calculatePosition();
    window.addEventListener("scroll", recalc, true);
    window.addEventListener("resize", recalc);
    return () => {
      window.removeEventListener("scroll", recalc, true);
      window.removeEventListener("resize", recalc);
    };
  }, [open, calculatePosition]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) =>
            Math.min(i + 1, filteredOptions.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
            onChange(filteredOptions[highlightedIndex].value);
            setOpen(false);
            setSearchQuery("");
          }
          break;
      }
    },
    [open, highlightedIndex, filteredOptions, onChange]
  );

  const selectOption = (opt: CustomSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setSearchQuery("");
  };

  // NOTE: Do NOT use the `dropdown-menu` CSS class here — it sets
  // `position: absolute` and `z-index: 50` which overrides the
  // Tailwind classes and causes the dropdown to be hidden behind modals.
  const dropdownPanel = open ? (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] rounded-xl overflow-hidden animate-dropdown-enter"
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        minWidth: dropdownPos.minWidth,
        maxHeight: 280,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-hover)",
        boxShadow: "var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Search bar */}
      {searchable && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search..."
              className="w-full h-8 pl-8 pr-3 text-[12px] rounded-md border border-[var(--border-default)] bg-[var(--bg-inset)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] transition-colors"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Options list */}
      <div className="py-1 overflow-y-auto" style={{ maxHeight: searchable ? 220 : 260 }}>
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-3 text-[12px] text-[var(--text-tertiary)] text-center">
            No options found
          </div>
        ) : (
          filteredOptions.map((opt, i) => {
            const isSelected = opt.value === value;
            const isHighlighted = i === highlightedIndex;

            return (
              <button
                key={opt.value}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlightedIndex(i)}
                disabled={opt.disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors duration-75
                  ${opt.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  ${isSelected
                    ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : isHighlighted
                    ? "bg-[var(--bg-hover-strong)] text-[var(--text-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)]"
                  }
                `}
              >
                {opt.icon && (
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {opt.icon}
                  </span>
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.badge && (
                  <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-1.5 py-0.5 rounded font-mono">
                    {opt.badge}
                  </span>
                )}
                {isSelected && (
                  <Check
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            setHighlightedIndex(0);
          }
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] font-medium transition-all duration-150 w-full text-left
          ${open
            ? "border-[var(--accent)] ring-2 ring-[var(--focus-ring)]"
            : "border-[var(--border-default)] hover:border-[var(--border-hover)]"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          bg-[var(--bg-surface)] text-[var(--text-primary)]`}
      >
        {prefixIcon && (
          <span className="flex-shrink-0">{prefixIcon}</span>
        )}
        <span className="flex-1 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        {selectedOption?.badge && (
          <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-1.5 py-0.5 rounded font-mono">
            {selectedOption.badge}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown panel — rendered via portal to escape overflow containers */}
      {typeof document !== "undefined" && createPortal(dropdownPanel, document.body)}
    </div>
  );
}
