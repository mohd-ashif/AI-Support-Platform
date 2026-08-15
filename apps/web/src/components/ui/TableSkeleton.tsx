import React from "react";

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ columns = 4, rows = 3 }) => {
  return (
    <tbody className="divide-y divide-[#1A1A1A]">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-4 px-4">
              <div
                className="h-3.5 bg-neutral-800/60 rounded-md"
                style={{ width: `${Math.floor(Math.random() * 40) + 50}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
};
