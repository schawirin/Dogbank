/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
      "./public/index.html",
    ],
    theme: {
      extend: {
        colors: {
          primary: {
            50: '#f5f2ff',
            100: '#ece5ff', 
            200: '#d9cbff',
            300: '#baa6ff',
            400: '#9776ff',
            500: '#774af4', // Cor principal - roxo Datadog
            600: '#6931e6',
            700: '#5a26cc',
            800: '#4a21a5',
            900: '#3f1e85',
          },
          secondary: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0ea5e9',
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
          },
          neutral: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
          success: '#00b42a',
          warning: '#ff7a00',
          error: '#ff0022',
          background: '#f8f9fd',
        },
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
          display: ['Poppins', 'sans-serif'],
        },
        boxShadow: {
          card: '0 4px 12px rgba(0, 0, 0, 0.05)',
          nav: '0 2px 10px rgba(0, 0, 0, 0.05)',
          elevated: '0 10px 25px rgba(0, 0, 0, 0.1)',
        },
        borderRadius: {
          'xl': '1rem',
          '2xl': '1.5rem',
        },
      },
    },
    plugins: [
      require('@tailwindcss/forms'),
    ],
  }