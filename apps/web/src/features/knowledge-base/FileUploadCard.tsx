import React, { RefObject } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Permissions } from "@/lib/permissions";

interface FileUploadCardProps {
  fileInputRef: RefObject<HTMLInputElement>;
  isUploading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileUploadCard({
  fileInputRef,
  isUploading,
  onFileUpload,
}: FileUploadCardProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
      <div className="flex items-center space-x-2">
        <FileText className="h-5 w-5 text-[#D4AF37]" />
        <h3 className="text-sm font-bold text-white">Upload Knowledge Documents</h3>
      </div>
      <p className="text-xs text-neutral-400">
        Upload PDF, DOCX, or TXT documentation to extract embeddings directly into vector storage.
      </p>

      <Can permission={Permissions.KNOWLEDGE_MANAGE}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          accept=".pdf,.csv,.txt,.docx"
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#222222] hover:border-[#D4AF37]/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[#141414] group"
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-[#D4AF37] animate-spin mb-2" />
          ) : (
            <Upload className="h-8 w-8 text-neutral-500 group-hover:text-[#D4AF37] transition-colors mb-2" />
          )}
          <span className="text-xs font-semibold text-neutral-300">
            {isUploading ? "Uploading Document..." : "Click to select PDF or TXT document"}
          </span>
          <span className="text-[10px] text-neutral-500 mt-1">Supports up to 25MB</span>
        </div>
      </Can>
    </div>
  );
}
