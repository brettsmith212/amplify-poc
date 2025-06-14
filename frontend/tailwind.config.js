/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{vue,svelte}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'mono': ['Monaco', 'Menlo', 'Ubuntu Mono', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#1a1a1a',
          fg: '#ffffff',
          selection: '#4a90e2',
        }
      }
    },
  },
  plugins: [],
}
