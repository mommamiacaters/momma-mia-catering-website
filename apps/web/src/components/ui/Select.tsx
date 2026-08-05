import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Rendered muted, above the options, when value is "". */
  placeholder?: string;
}

/**
 * Styled wrapper around a NATIVE <select>.
 *
 * Deliberately not a custom listbox: the native control gives us the OS picker
 * on mobile (a wheel on iOS, a full-screen list on Android), keyboard type-ahead,
 * and correct screen-reader semantics for free. All we change is the chrome —
 * `appearance-none` drops the default arrow so the chevron can match the rest of
 * the console, and the padding gives it the same 44px-ish target as our inputs.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ placeholder, className = "", children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        className={`w-full appearance-none rounded-lg border border-brand-divider bg-white py-2.5 pl-3 pr-9 font-poppins text-sm text-brand-text transition-colors cursor-pointer hover:border-brand-primary/50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {placeholder !== undefined && (
          <option value="">{placeholder}</option>
        )}
        {children}
      </select>
      <i
        className="pi pi-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-text/40"
        aria-hidden="true"
      />
    </div>
  ),
);

Select.displayName = "Select";

export default Select;
