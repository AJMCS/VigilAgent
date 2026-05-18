/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      colors: {
        neon: {
          blue:  '#00f0ff',
          green: '#00ff88',
        },
        void: '#0a0a0a',
      },
      boxShadow: {
        'neon-blue':  '0 0 8px rgba(0,240,255,0.4), 0 0 20px rgba(0,240,255,0.15)',
        'neon-green': '0 0 8px rgba(0,255,136,0.4), 0 0 20px rgba(0,255,136,0.15)',
        'neon-blue-lg':  '0 0 16px rgba(0,240,255,0.5), 0 0 40px rgba(0,240,255,0.2)',
        'neon-green-lg': '0 0 16px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.2)',
      },
      animation: {
        'pulse-dot':   'pulseDot 2s ease-in-out infinite',
        'pulse-slow':  'pulse 3s ease-in-out infinite',
        'scan-line':   'scanLine 8s linear infinite',
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'glow-blue':   'glowBlue 2s ease-in-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { boxShadow: '0 0 4px #00ff88, 0 0 8px #00ff88', opacity: 1 },
          '50%':      { boxShadow: '0 0 8px #00ff88, 0 0 24px #00ff88, 0 0 48px #00ff88', opacity: 0.8 },
        },
        glowBlue: {
          '0%, 100%': { boxShadow: '0 0 4px #00f0ff, 0 0 8px #00f0ff' },
          '50%':      { boxShadow: '0 0 10px #00f0ff, 0 0 30px #00f0ff' },
        },
        scanLine: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
