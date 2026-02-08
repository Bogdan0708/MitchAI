/**
 * Design Tokens
 * 
 * Centralized spacing, typography, and transition values
 * for consistent design across the application.
 */

export const designTokens = {
  // Spacing scale (Tailwind-compatible)
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },

  // Typography scale
  typography: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
  },

  // Transitions
  transitions: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
  },

  // Border radius
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },

  // Breakpoints
  breakpoints: {
    mobile: '360px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1366px',
  },

  // Touch targets (WCAG/Apple HIG)
  touchTargets: {
    min: '44px',
    comfortable: '48px',
    spaceBetween: '10px',
  },

  // Z-index scale
  zIndex: {
    dropdown: 50,
    sticky: 100,
    modal: 200,
    popover: 300,
    toast: 400,
    tooltip: 500,
  },
} as const

// Type exports for TypeScript usage
export type SpacingKey = keyof typeof designTokens.spacing
export type TypographyKey = keyof typeof designTokens.typography
export type RadiusKey = keyof typeof designTokens.radius
export type BreakpointKey = keyof typeof designTokens.breakpoints
