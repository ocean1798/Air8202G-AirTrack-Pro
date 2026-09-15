import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify()
  ],
  theme: {
    colors: {
      cyber: {
        950: '#030712',
        900: '#070d1d',
        850: '#0c152a',
        800: '#121f3d',
        700: '#192b54',
        primary: '#00f0ff',
        emerald: '#10b981',
        amber: '#f59e0b',
        rose: '#f43f5e',
        indigo: '#6366f1'
      }
    },
    boxShadow: {
      'glow-cyan': '0 0 20px -2px rgba(0, 240, 255, 0.45)',
      'glow-emerald': '0 0 20px -2px rgba(16, 185, 129, 0.45)',
      'glow-rose': '0 0 20px -2px rgba(244, 63, 94, 0.45)',
      'handle-glow': '0 0 14px rgba(0, 240, 255, 0.95)',
      'popover-shadow': '0 20px 40px -10px rgba(0, 0, 0, 0.85), 0 0 25px rgba(0, 240, 255, 0.25)',
      'sheet-shadow': '0 -10px 30px -5px rgba(0, 0, 0, 0.85), 0 -2px 10px rgba(0, 240, 255, 0.15)',
      'fab-shadow': '0 8px 24px -4px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.45)'
    }
  },
  shortcuts: {
    'glass-panel': 'bg-[#070d1d]/92 backdrop-blur-[24px] border border-white/8'
  }
});
