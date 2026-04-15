"use client";

import React from "react";

const variantStyles = {
  primary:
    "bg-primary text-white hover:bg-primary-hover border border-transparent",
  secondary:
    "bg-muted text-primary border border-primary hover:bg-primary-light",
  danger:
    "bg-error text-white hover:bg-error-hover border border-transparent",
  ghost:
    "bg-background text-heading border border-border hover:bg-primary-light",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm min-h-touch-target",
  md: "px-4 py-2 text-base min-h-touch-target",
  lg: "px-6 py-3 text-lg min-h-touch-target",
  /* compact: opt-out of the 44px touch target. Desktop-only dense contexts
     (admin toolbars, modal footers). Not for mobile surfaces. */
  compact: "px-4 py-2 text-sm",
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
      type = "button",
      children,
      className = "",
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center
          rounded-[8px]
          font-medium
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
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
