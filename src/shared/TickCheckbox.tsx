import React from 'react';

interface TickCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: React.ReactNode;
  hint?: React.ReactNode; // e.g. price delta
  className?: string;
}

const TickCheckbox: React.FC<TickCheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  hint,
  className = '',
}) => {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 cursor-pointer text-sm ${className}`}
    >
      <span
        className={`flex items-center justify-center w-6 h-6 rounded border ${
          checked
            ? 'bg-[var(--brand-accent)] border-transparent'
            : 'bg-white border-gray-300'
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked ? (
          // Simple checkmark icon in white
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>

      <div className="flex-1 min-w-0">
        <div className="truncate">{label}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
    </label>
  );
};

export default TickCheckbox;
