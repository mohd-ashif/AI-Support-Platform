import React from "react";
import { Bot } from "lucide-react";

interface AssistantAvatarProps {
  primaryColor?: string;
  size?: "sm" | "md" | "lg";
  logoUrl?: string;
}

export const AssistantAvatar: React.FC<AssistantAvatarProps> = ({
  primaryColor = "#D4AF37",
  size = "md",
  logoUrl,
}) => {
  const dimensions =
    size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-7 w-7 text-xs";

  return (
    <div
      style={{ backgroundColor: primaryColor }}
      className={`${dimensions} rounded-full flex items-center justify-center text-black font-bold shrink-0 shadow-md shadow-black/20 transition-transform duration-200 hover:scale-105`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="Bot Avatar" className="h-full w-full object-cover rounded-full" />
      ) : (
        <Bot className={size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      )}
    </div>
  );
};
