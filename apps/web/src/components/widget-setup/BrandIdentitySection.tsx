import React from "react";
import { Palette, Building2, Globe, Image as ImageIcon, Sparkles, Check } from "lucide-react";
import { AssistantAvatar } from "../chat/AssistantAvatar";

interface BrandIdentitySectionProps {
  brandName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  onChange: (field: any, value: any) => void;
}

const PRESET_COLORS = [
  { name: "Gold", hex: "#D4AF37" },
  { name: "Royal Blue", hex: "#3B82F6" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Rose", hex: "#F43F5E" },
];

export const BrandIdentitySection: React.FC<BrandIdentitySectionProps> = ({
  brandName,
  tagline,
  logoUrl,
  primaryColor,
  onChange,
}) => {
  return (
    <section id="brand" className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-6 shadow-xl">
      <div className="flex items-center space-x-2.5 pb-3 border-b border-[#222222]">
        <Palette className="h-5 w-5 text-[#D4AF37]" />
        <div>
          <h2 className="text-sm font-extrabold text-white">Brand Identity & Theme</h2>
          <p className="text-[11px] text-neutral-400">
            Define your widget's visual identity, brand name, logo, and accent colors.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Brand Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center space-x-1.5">
            <Building2 className="h-3.5 w-3.5 text-neutral-400" />
            <span>Brand Name</span>
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => onChange("brand_name", e.target.value)}
            placeholder="e.g. bizpole"
            className="w-full bg-[#181818] border border-[#2A2A2A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37] transition-all"
          />
        </div>

        {/* Tagline Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center space-x-1.5">
            <Globe className="h-3.5 w-3.5 text-neutral-400" />
            <span>Tagline / Subtitle</span>
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => onChange("tagline", e.target.value)}
            placeholder="e.g. 24/7 AI Support Assistant"
            className="w-full bg-[#181818] border border-[#2A2A2A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37] transition-all"
          />
        </div>
      </div>

      {/* Logo URL & Preview */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-neutral-300 flex items-center space-x-1.5">
          <ImageIcon className="h-3.5 w-3.5 text-neutral-400" />
          <span>Company Logo URL</span>
        </label>
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <input
              type="text"
              value={logoUrl}
              onChange={(e) => onChange("logo_url", e.target.value)}
              placeholder="https://yourcompany.com/logo.png"
              className="w-full bg-[#181818] border border-[#2A2A2A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>
          <div className="flex items-center space-x-2 bg-[#181818] border border-[#2A2A2A] px-3 py-1.5 rounded-xl">
            <span className="text-[10px] text-neutral-400 font-semibold">Logo Preview:</span>
            <AssistantAvatar primaryColor={primaryColor} logoUrl={logoUrl} size="sm" />
          </div>
        </div>
      </div>

      {/* Primary Accent Color Picker & Presets */}
      <div className="space-y-2.5 pt-2 border-t border-[#1C1C1C]">
        <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
          <span>Primary Accent Color</span>
          <span className="text-[11px] font-mono text-[#D4AF37] uppercase">{primaryColor}</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {/* Custom Color Input */}
          <div className="flex items-center space-x-2 bg-[#181818] border border-[#2A2A2A] p-1.5 rounded-xl">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onChange("primary_color", e.target.value)}
              className="h-7 w-7 rounded-lg cursor-pointer bg-transparent border-0"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => onChange("primary_color", e.target.value)}
              className="w-20 bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
            />
          </div>

          {/* Color Presets */}
          <div className="flex items-center space-x-2 border-l border-[#262626] pl-3">
            {PRESET_COLORS.map((preset) => {
              const isSelected = primaryColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => onChange("primary_color", preset.hex)}
                  title={preset.name}
                  style={{ backgroundColor: preset.hex }}
                  className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                    isSelected ? "ring-2 ring-white scale-110 shadow-lg" : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-black font-bold" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
