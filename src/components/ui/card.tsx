import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "danger";
  title?: string;
}

export function Card({ children, className = "", variant = "default", title }: CardProps) {
  const base = "rounded-[10px] p-6";
  const variants = {
    default: "bg-white border border-[#dddddd]",
    danger: "bg-red-50 border border-red-200",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`}>
      {title && (
        <h2 className={`text-base font-semibold mb-4 ${variant === "danger" ? "text-[#dc3545]" : "text-[#2d2d2d]"}`}>
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
