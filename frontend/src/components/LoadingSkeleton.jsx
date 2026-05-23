import React from 'react';

function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className}`} />
  );
}

export default function LoadingSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-6 animate-fade-in">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
