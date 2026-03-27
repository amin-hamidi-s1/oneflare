/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0d0620',
          card: '#1a0a2e',
          elevated: '#1f0d38',
        },
        border: {
          DEFAULT: '#2d1b4e',
          subtle: '#1e1235',
        },
        accent: {
          orange: '#f38020',
          'orange-dim': '#c4641a',
          purple: '#a855f7',
          'purple-dim': '#7c3aed',
        },
        text: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
        severity: {
          critical: '#ef4444',
          high: '#f38020',
          medium: '#f59e0b',
          low: '#3b82f6',
        },
        category: {
          waf: '#f38020',
          access: '#a855f7',
          gateway: '#3b82f6',
          workers: '#ef4444',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s step-end infinite',
        'glow-orange': 'glowOrange 2s ease-in-out infinite alternate',
        'glow-purple': 'glowPurple 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        glowOrange: {
          '0%': { boxShadow: '0 0 5px rgba(243,128,32,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(243,128,32,0.6), 0 0 40px rgba(243,128,32,0.2)' },
        },
        glowPurple: {
          '0%': { boxShadow: '0 0 5px rgba(168,85,247,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.2)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
