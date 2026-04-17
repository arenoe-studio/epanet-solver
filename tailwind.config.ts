import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "cloud-gray": "#f5f5f7",
        "expo-black": "#111112",
        "near-black": "#1b1c1f",
        "slate-gray": "#6b7280",
        "mid-slate": "#9ca3af",
        silver: "#c4c7ce",
        "border-lavender": "#e4e5ea",
        "input-border": "#d8d9df",
        "link-cobalt": "#0070f3"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace"]
      },
      letterSpacing: {
        display: "-0.04em",
        heading: "-0.025em",
        ui: "-0.01em"
      },
      boxShadow: {
        whisper:
          "0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)",
        elevated:
          "0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)"
      }
    }
  },
  plugins: []
};

export default config;

