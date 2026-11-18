/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "Pretendard",
          "Noto Sans KR",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Noto Sans KR",
          "Malgun Gothic",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      colors: {
        lab: {
          bg: "#090d14",
          surface: "#0f1623",
          panel: "#141d2e",
          border: "#223047",
          muted: "#64748b",
          text: "#e2e8f0",
          q: "#38bdf8",
          sarsa: "#f59e0b",
          merged: "#10b981",
          builder: "#a78bfa",
          danger: "#f43f5e",
        },
      },
    },
  },
  plugins: [],
};
