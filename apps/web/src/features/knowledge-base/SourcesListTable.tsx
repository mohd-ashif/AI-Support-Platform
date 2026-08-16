import React from "react";
import { Globe, FileText, CheckCircle2, Loader2, Trash2, RefreshCw } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Permissions } from "@/lib/permissions";

export interface KnowledgeSourceItem {
  id: string;
  type: "web" | "file";
  name: string;
  info: string;
  status: string;
}

interface SourcesListTableProps {
  sources: KnowledgeSourceItem[];
  isLoading: boolean;
  onDeleteSource: (id: string, type: "web" | "file") => void;
  onRefresh: () => void;
}

export function SourcesListTable({
  sources,
  isLoading,
  onDeleteSource,
  onRefresh,
}: SourcesListTableProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Indexed Knowledge Sources ({sources.length})</h3>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#252525] text-neutral-400 hover:text-white transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-[#D4AF37]" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 text-[#D4AF37] animate-spin" />
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#222222] rounded-xl text-neutral-500 text-xs">
          No knowledge sources indexed yet. Add your company website or documents above.
        </div>
      ) : (
        <div className="divide-y divide-[#1A1A1A]">
          {sources.map((item) => (
            <div key={item.id} className="py-3 flex items-center justify-between hover:bg-[#141414] px-2 rounded-xl transition-all">
              <div className="flex items-center space-x-3 truncate">
                {item.type === "web" ? (
                  <Globe className="h-4 w-4 text-[#D4AF37] shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-[#D4AF37] shrink-0" />
                )}
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                  <p className="text-[10px] text-neutral-400">{item.info}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="capitalize">{item.status}</span>
                </span>

                <Can permission={Permissions.KNOWLEDGE_MANAGE}>
                  <button
                    onClick={() => onDeleteSource(item.id, item.type)}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Can>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
