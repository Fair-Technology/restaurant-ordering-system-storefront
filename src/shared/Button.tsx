import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  onClick,
  className,
  disabled,
}) => {
  const base = 'px-4 py-2 rounded-full font-semibold transition-all duration-200 active:scale-95';
  const styles = {
    primary:
      'bg-gray-900 text-white shadow-sm hover:bg-[var(--brand-accent)] hover:shadow-md',
    secondary:
      'bg-gray-700 text-white shadow-sm hover:bg-gray-900',
    outline:
      'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className || ''} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
};

export default Button;
