/* --- START OF FILE tailwind-setup.js --- */
tailwind.config = {
    theme: {
        extend: {
            fontFamily: { 
                sans: ['var(--font-sans)'],
                serif: ['var(--font-serif)'],
            },
            colors: {
                brand: {
                    primary: 'var(--brand-primary)',
                    primaryDark: 'var(--brand-primary-dark)',
                    accent: 'var(--brand-accent)',
                    accentLight: 'var(--brand-accent-light)',
                    accentDark: 'var(--brand-accent-dark)',
                    cream: 'var(--brand-cream)',
                    sand: 'var(--brand-sand)',
                    surface: 'var(--brand-surface)',
                    danger: 'var(--brand-danger)',
                },
                stone: {
                    600: 'var(--text-body)',
                    500: 'var(--text-muted)'
                }
            },
            boxShadow: {
                'glow': '0 0 25px rgba(234, 88, 12, 0.2)'
            }
        }
    }
}