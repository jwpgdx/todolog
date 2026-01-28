/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // 1. 브랜드 & 포인트
        primary: "rgb(var(--color-primary) / <alpha-value>)",

        // 2. 상태 (Status)
        error: "rgb(var(--color-error) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",

        // 3. 배경 (Backgrounds)
        background: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",

        // 4. 텍스트 (Typography)
        text: "rgb(var(--color-text) / <alpha-value>)",
        "text-secondary": "rgb(var(--color-text-secondary) / <alpha-value>)",
        "text-inverted": "rgb(var(--color-text-inverted) / <alpha-value>)",

        // 5. 테두리 (Border)
        border: "rgba(var(--color-border) / 0.36)",
      },
    },
    fontFamily: {
    },
  },
  plugins: [],
}
