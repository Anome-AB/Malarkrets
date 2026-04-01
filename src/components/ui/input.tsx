"use client";

import React from "react";

type InputProps = {
  label?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#2d2d2d]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2
            min-h-[44px]
            rounded-[8px]
            border
            text-[#2d2d2d]
            bg-white
            placeholder:text-[#999999]
            transition-colors duration-150
            focus:outline-none focus:ring-1
            ${
              error
                ? "border-[#dc3545] focus:border-[#dc3545] focus:ring-[#dc3545]"
                : "border-[#dddddd] focus:border-[#3d6b5e] focus:ring-[#3d6b5e]"
            }
            ${className}
          `}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-[#dc3545]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
