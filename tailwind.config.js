/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#1D9E75',
          'teal-dark': '#0f6e56',
          'teal-deeper': '#0d1f18',
          'teal-bg': '#0a1510',
          purple: '#7F77DD',
          'purple-dark': '#534AB7',
          'purple-bg': '#120e2a',
          amber: '#BA7517',
        },
        surface: {
          DEFAULT: '#161616',
          elevated: '#1a1a1a',
          deep: '#0f0f0f',
        },
        border: {
          DEFAULT: '#2a2a2a',
          active: '#1D9E75',
          subtle: '#1e1e1e',
        },
        text: {
          primary: '#ffffff',
          secondary: '#aaaaaa',
          muted: '#555555',
          disabled: '#333333',
          faint: '#444444',
        },
        moment: {
          photo: '#BA7517',
          video: '#1D9E75',
          audio: '#7F77DD',
          gps: '#888780',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
