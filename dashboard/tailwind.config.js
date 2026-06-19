/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // agent accent palette (matches the "color-coded by agent" requirement)
        collector: '#38bdf8',
        risk: '#f87171',
        reporter: '#a78bfa',
        balancer: '#fbbf24',
        pm: '#34d399'
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
