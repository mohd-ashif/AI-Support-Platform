import React from "react";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Permissions } from "@/lib/permissions";

interface WebCrawlerCardProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
  isCrawling: boolean;
  onStartCrawl: (e: React.FormEvent) => void;
}

export function WebCrawlerCard({
  urlInput,
  setUrlInput,
  isCrawling,
  onStartCrawl,
}: WebCrawlerCardProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
      <div className="flex items-center space-x-2">
        <Globe className="h-5 w-5 text-[#D4AF37]" />
        <h3 className="text-sm font-bold text-white">Crawl Website URL</h3>
      </div>
      <p className="text-xs text-neutral-400">
        Automatically crawl all pages from your company domain to index product FAQs and help articles.
      </p>

      <Can permission={Permissions.KNOWLEDGE_MANAGE}>
        <form onSubmit={onStartCrawl} className="space-y-3">
          <input
            type="url"
            placeholder="https://docs.yourcompany.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
          />
          <button
            type="submit"
            disabled={isCrawling || !urlInput.trim()}
            className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            {isCrawling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Crawling & Indexing Pages...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Start Crawl & Vectorization</span>
              </>
            )}
          </button>
        </form>
      </Can>
    </div>
  );
}
