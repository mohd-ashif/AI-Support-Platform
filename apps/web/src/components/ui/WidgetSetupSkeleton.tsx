import React from "react";

export const WidgetSetupSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse pb-12">
      {/* Header Skeleton */}
      <div className="pb-4 border-b border-[#1F1F1F] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-neutral-800/60 rounded-md" />
          <div className="h-4 w-96 bg-neutral-800/40 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-neutral-800/60 rounded-xl" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Controls Left Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-5">
            <div className="h-5 w-40 bg-neutral-800/60 rounded-md mb-4" />
            <div className="space-y-2">
              <div className="h-3.5 w-24 bg-neutral-800/40 rounded-md" />
              <div className="h-10 w-full bg-neutral-800/40 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-20 bg-neutral-800/40 rounded-md" />
              <div className="h-10 w-full bg-neutral-800/40 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-28 bg-neutral-800/40 rounded-md" />
              <div className="flex space-x-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-neutral-800/60" />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
            <div className="h-5 w-48 bg-neutral-800/60 rounded-md mb-2" />
            <div className="h-20 w-full bg-neutral-800/40 rounded-xl" />
          </div>
        </div>

        {/* Live Widget Preview Right Column */}
        <div className="lg:col-span-5 bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 h-[520px]">
          <div className="h-5 w-48 bg-neutral-800/60 rounded-md mb-4" />
          <div className="h-full w-full bg-[#050505] border border-[#222222] rounded-xl overflow-hidden flex flex-col justify-between">
            <div className="h-16 bg-neutral-800/40 w-full" />
            <div className="p-4 space-y-3 flex-1">
              <div className="h-10 w-3/4 bg-neutral-800/30 rounded-2xl" />
              <div className="h-10 w-1/2 bg-neutral-800/30 rounded-2xl ml-auto" />
            </div>
            <div className="h-14 bg-neutral-800/40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
