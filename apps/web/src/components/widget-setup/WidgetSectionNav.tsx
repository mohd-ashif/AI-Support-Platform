import React, { useState, useEffect } from "react";

export interface NavSection {
  id: string;
  label: string;
}

interface WidgetSectionNavProps {
  sections: NavSection[];
}

export const WidgetSectionNav: React.FC<WidgetSectionNavProps> = ({ sections }) => {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex items-center space-x-2 border-b border-[#1A1A1A] pb-2 overflow-x-auto scrollbar-none">
      <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider pr-2 select-none">
        Configuration:
      </span>
      {sections.map((sec) => {
        const isActive = activeSection === sec.id;
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => scrollToSection(sec.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center space-x-1.5 shrink-0 ${
              isActive
                ? "bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]"
                : "text-neutral-400 hover:text-white hover:bg-[#141414]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-[#D4AF37]" : "bg-neutral-600"
              }`}
            />
            <span>{sec.label}</span>
          </button>
        );
      })}
    </div>
  );
};
