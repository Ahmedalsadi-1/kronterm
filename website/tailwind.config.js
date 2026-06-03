/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          primary: '#0A0A0B',
          secondary: '#111113',
          card: '#18181B',
          'card-hover': '#1E1E21',
          alt: '#141416',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#A1A1AA',
          tertiary: '#71717A',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          hover: 'rgba(255,255,255,0.12)',
          glow: 'rgba(0,212,170,0.15)',
        },
        accent: {
          DEFAULT: '#00D4AA',
          light: '#5EEAD4',
          subtle: 'rgba(0,212,170,0.08)',
          glow: 'rgba(0,212,170,0.12)',
        },
        amber: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          subtle: 'rgba(245,158,11,0.08)',
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        glow: 'glow 2s ease-in-out infinite alternate',
        'grid-scroll': 'gridScroll 20s linear infinite',
        'cursor-blink': 'cursorBlink 1.2s step-end infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        glow: {
          from: { boxShadow: '0 0 20px rgba(0,212,170,0.05), 0 0 40px rgba(0,212,170,0.02)' },
          to: { boxShadow: '0 0 30px rgba(0,212,170,0.12), 0 0 60px rgba(0,212,170,0.04)' },
        },
        gridScroll: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(-40px)' },
        },
        cursorBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
}
