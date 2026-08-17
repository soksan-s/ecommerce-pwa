"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Theme-aware replacement for native <select>.
 * Native popups use the OS accent color (blue on Windows) for the hover
 * highlight, which CSS cannot override — this dropdown keeps every state
 * on the design tokens.
 *
 * Props:
 *   value      — current value
 *   onChange    — (value) => void
 *   options    — [{ value, label }] (or plain strings)
 *   className   — extra classes for the wrapper
 *   placeholder — shown when no value matches
 */
export function AppSelect({
  value,
  onChange,
  options = [],
  className = "",
  placeholder = "Select…",
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalized = options.map((option) =>
    typeof option === "object" && option !== null
      ? option
      : { value: option, label: String(option) }
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = normalized.find(
    (option) => String(option.value) === String(value)
  );

  return (
    <div ref={rootRef} className={"relative " + className}>
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="app-select flex w-full items-center justify-between gap-2 text-left"
      >
        <span className={"truncate " + (current ? "" : "text-[var(--muted-foreground)]")}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          className={
            "size-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute z-[120] mt-1 max-h-72 w-full overflow-y-auto border border-[var(--border-soft)] bg-[var(--surface-strong)] py-1 shadow-[var(--shadow-strong)]"
        >
          {normalized.map((option) => {
            const active = String(option.value) === String(value);
            return (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors " +
                  (active
                    ? "bg-[var(--action-surface)] font-bold text-[var(--action-on-muted)]"
                    : "text-[var(--foreground)] hover:bg-[var(--action-surface)] hover:text-[var(--action-on-muted)]")
                }
              >
                <span className="truncate">{option.label}</span>
                {active ? <Check className="size-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
