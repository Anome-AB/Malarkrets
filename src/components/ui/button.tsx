"use client";

import React from "react";

const variantStyles = {
  primary:
    "bg-[#3d6b5e] text-white hover:bg-[#345c51] border border-transparent",
  secondary:
    "bg-transparent text-[#3d6b5e] border border-[#3d6b5e] hover:bg-[#e8f0ec]",
  danger:
    "bg-[#dc3545] text-white hover:bg-[#c82333] border border-transparent",
  ghost:
    "bg-transparent text-[#2d2d2d] border border-transparent hover:bg-[#e8f0ec]",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
} as const;

type ButtonProps = {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const Spinner = () => (
  <svg
    className="animate-spin -ml-1 mr-2 h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      className = "",
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center
          min-h-[44px]
          rounded-[8px]
          font-medium
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-[#3d6b5e] focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...rest}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps };
