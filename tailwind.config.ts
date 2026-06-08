import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui tokens
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary-hsl))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // ── Stitch Design System ──────────────────────────────
        surface: {
          DEFAULT:             'var(--surface)',
          deep:                'var(--surface-deep)',
          dim:                 'var(--surface-dim)',
          card:                'var(--surface-card)',
          'container-lowest':  'var(--surface-container-lowest)',
          'container-low':     'var(--surface-container-low)',
          container:           'var(--surface-container)',
          'container-high':    'var(--surface-container-high)',
          'container-highest': 'var(--surface-container-highest)',
          variant:             'var(--surface-variant)',
          bright:              'var(--surface-bright)',
        },
        'on-surface':          'var(--on-surface)',
        'on-surface-variant':  'var(--on-surface-variant)',
        'text-p':              'var(--text-primary)',
        'text-s':              'var(--text-secondary)',
        'text-m':              'var(--text-muted)',

        stitch: {
          primary:              'var(--primary)',
          'on-primary':         'var(--on-primary)',
          'primary-container':  'var(--primary-container)',
          'on-container':       'var(--on-primary-container)',
          secondary:            'var(--secondary-accent)',
          'secondary-container':'var(--secondary-container)',
        },

        outline: {
          DEFAULT: 'var(--outline)',
          variant: 'var(--outline-variant)',
        },

        // Semantic status
        'ss-bg':   'var(--status-success-bg)',
        'ss-text': 'var(--status-success-text)',
        'sw-bg':   'var(--status-warning-bg)',
        'sw-text': 'var(--status-warning-text)',
        'se-bg':   'var(--status-error-bg)',
        'se-text': 'var(--status-error-text)',
        'si-bg':   'var(--status-info-bg)',
        'si-text': 'var(--status-info-text)',

        // Border accents
        'border-primary': 'var(--border-primary)',
        'border-success': 'var(--border-success)',
        'border-warning': 'var(--border-warning)',
        'border-error':   'var(--border-error)',

        // Brand
        'nt-navy': '#1B3D8F',
        'nt-sky':  '#4BA3F5',

        // Backward-compat dp-* aliases (existing components not yet migrated still work)
        'dp-bg-base':        'var(--dp-bg-base)',
        'dp-bg-card':        'var(--dp-bg-card)',
        'dp-bg-card-hover':  'var(--dp-bg-card-hover)',
        'dp-border':         'var(--dp-border-default)',
        'dp-border-blue':    'var(--dp-border-blue)',
        'dp-border-green':   'var(--dp-border-green)',
        'dp-border-amber':   'var(--dp-border-amber)',
        'dp-border-red':     'var(--dp-border-red)',
        'dp-blue':           'var(--dp-accent-blue)',
        'dp-green':          'var(--dp-accent-green)',
        'dp-amber':          'var(--dp-accent-amber)',
        'dp-red':            'var(--dp-accent-red)',
        'dp-text':           'var(--dp-text-primary)',
        'dp-text-secondary': 'var(--dp-text-secondary)',
        'dp-text-muted':     'var(--dp-text-muted)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'glow-primary': 'var(--glow-primary)',
        'glow-success': 'var(--glow-success)',
        'glow-warning': 'var(--glow-warning)',
        'glow-error':   'var(--glow-error)',
        'dp-glow-blue': 'var(--dp-glow-blue)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
