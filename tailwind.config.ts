import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        fg: '#e5e5e5',
        coal: '#0b0b0c',
        soot: '#151314',
        ink: '#0f0e10',
        ember: '#b7410e',
        emberDeep: '#7a2606',
        rust: '#8c2f1b',
        blood: '#a11616',
        claret: '#5a0b0b',
        brass: '#b58b2a',
        amber: '#c27b32',
        parchment: '#e6d3b1',
      },
      boxShadow: {
        glowEmber: '0 0 20px rgba(183,65,14,0.35), 0 0 40px rgba(183,65,14,0.2)',
        glowBlood: '0 0 20px rgba(161,22,22,0.35), 0 0 40px rgba(161,22,22,0.2)'
      }
    },
  },
  plugins: [],
}

export default config
