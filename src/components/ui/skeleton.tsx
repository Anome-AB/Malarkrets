import React from "react";

type SkeletonProps = {
  className?: string;
};

function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
