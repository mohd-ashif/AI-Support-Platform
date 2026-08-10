"use client";

import React from "react";

interface NeuralNetworkLoaderProps {
  size?: "sm" | "md" | "lg" | "fullscreen";
  text?: string;
}

export function NeuralNetworkLoader({
  size = "md",
  text = "Processing AI Synapses...",
}: NeuralNetworkLoaderProps) {
  const sizeDimensions = {
    sm: "w-16 h-16",
    md: "w-28 h-28",
    lg: "w-40 h-40",
    fullscreen: "w-36 h-36",
  };

  const containerClasses =
    size === "fullscreen"
      ? "min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white p-6"
      : "flex flex-col items-center justify-center p-4";

  return (
    <div className={containerClasses}>
      <div className={`relative ${sizeDimensions[size]} flex items-center justify-center`}>
        {/* SVG Neural Network Graph with Animated Synapses */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] overflow-visible"
        >
          <defs>
            {/* Gradient definition for neural connections */}
            <linearGradient id="synapseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#F4D03F" stopOpacity="1" />
              <stop offset="100%" stopColor="#FFEAA7" stopOpacity="0.4" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Connected Synapse Lines with Flowing Dash Movement */}
          <g stroke="url(#synapseGradient)" strokeWidth="1.5" fill="none">
            {/* Outer to Center Connections */}
            <line x1="50" y1="50" x2="20" y2="25" className="animate-pulse" />
            <line x1="50" y1="50" x2="80" y2="25" className="animate-pulse duration-700" />
            <line x1="50" y1="50" x2="85" y2="50" className="animate-pulse duration-1000" />
            <line x1="50" y1="50" x2="80" y2="75" className="animate-pulse duration-500" />
            <line x1="50" y1="50" x2="20" y2="75" className="animate-pulse duration-900" />
            <line x1="50" y1="50" x2="15" y2="50" className="animate-pulse duration-300" />

            {/* Ring Connections */}
            <path
              d="M 20 25 L 80 25 L 85 50 L 80 75 L 20 75 L 15 50 Z"
              strokeDasharray="4,4"
              className="animate-[spin_8s_linear_infinite] origin-center opacity-60"
            />
          </g>

          {/* Outer Neural Nodes */}
          {[
            { cx: 20, cy: 25, delay: "0s" },
            { cx: 80, cy: 25, delay: "0.3s" },
            { cx: 85, cy: 50, delay: "0.6s" },
            { cx: 80, cy: 75, delay: "0.9s" },
            { cx: 20, cy: 75, delay: "1.2s" },
            { cx: 15, cy: 50, delay: "1.5s" },
          ].map((node, i) => (
            <g key={i}>
              <circle
                cx={node.cx}
                cy={node.cy}
                r="3.5"
                fill="#D4AF37"
                className="animate-ping origin-center opacity-75"
                style={{ animationDelay: node.delay, animationDuration: "2s" }}
              />
              <circle
                cx={node.cx}
                cy={node.cy}
                r="3"
                fill="#F4D03F"
                filter="url(#glow)"
              />
            </g>
          ))}

          {/* Central AI Core Node */}
          <circle
            cx="50"
            cy="50"
            r="8"
            fill="url(#synapseGradient)"
            className="animate-pulse"
            filter="url(#glow)"
          />
          <circle
            cx="50"
            cy="50"
            r="4"
            fill="#050505"
          />
          <circle
            cx="50"
            cy="50"
            r="2"
            fill="#FFEAA7"
            className="animate-ping"
          />
        </svg>
      </div>

      {/* Text Label */}
      {text && (
        <div className="mt-4 text-center space-y-1">
          <p className="text-xs font-bold text-neutral-200 tracking-wider uppercase font-mono">
            {text}
          </p>
          <div className="flex justify-center space-x-1">
            <span className="h-1 w-1 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1 w-1 bg-[#F4D03F] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1 w-1 bg-[#FFEAA7] rounded-full animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
}
