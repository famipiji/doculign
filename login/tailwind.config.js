export default {
  content: ['./*.tsx', './*.html'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#F3F4F6',
        primary: { DEFAULT: '#1e3a8a', dark: '#172554' },
        'text-main': '#374151',
        'text-muted': '#6B7280',
        border: '#E5E7EB',
        accent: '#3B82F6',
      },
    },
  },
  plugins: [],
}
