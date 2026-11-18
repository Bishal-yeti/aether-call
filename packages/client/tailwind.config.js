/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aether: {
          dark: '#0b0f19',
          surface: '#111827',
          card: '#1f2937',
          border: '#374151',
          primary: '#10b981', // Privacy emerald green
          'primary-hover': '#059669',
          accent: '#3b82f6',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
