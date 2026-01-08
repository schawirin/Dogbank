/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
      "./public/index.html",
    ],
    theme: {
      extend: {
        colors: {
          // Sober Banking LIGHT Theme - Purple Datadog Accent
          primary: {
            50: '#f5f2ff',
            100: '#ece5ff',
            200: '#d9cbff',
            300: '#baa6ff',
            400: '#9776ff',
            500: '#774af4', // Roxo principal Datadog
            600: '#6931e6',
            700: '#5a26cc',
            800: '#4a21a5',
            900: '#3f1e85',
          },
          secondary: {
            50: '#f5f5f7',   // Light gray (Nubank)
            100: '#f0f0f2',  // Light gray alternative
            200: '#e5e5e5',  // Light borders
            300: '#d1d1d6',  // Muted gray
            400: '#b0b0b5',  // Medium gray
            500: '#8b91a0',  // Gray medium
            600: '#6d7385',
            700: '#4f556a',
            800: '#363b51',
            900: '#f0f0f2',  // Light gray (was black)
          },
          neutral: {
            50: '#fafafa',   // Almost white
            100: '#f5f5f5',  // Very light
            200: '#e5e5e5',  // Light
            300: '#d4d4d4',  // Light-medium
            400: '#a3a3a3',  // Medium
            500: '#737373',  // Medium-dark
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
          },
          success: '#22c55e',
          warning: '#fbbf24',
          error: '#ef4444',
          background: '#f5f5f7',      // Light gray (Nubank style)
          foreground: '#1a1a1a',      // Almost black (dark text)
          card: '#ffffff',            // White cards
          'card-foreground': '#1a1a1a', // Dark text on white
          muted: '#f0f0f2',           // Light muted
          'muted-foreground': '#6b7280', // Gray text
          accent: '#f5f5f7',          // Light accent
          'accent-foreground': '#1a1a1a', // Dark text
          destructive: '#ef4444',     // Red
          'destructive-foreground': '#ffffff',
          border: '#e5e5e5',          // Light gray borders
          input: '#ffffff',           // White input background
          ring: '#774af4',            // Purple focus ring
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