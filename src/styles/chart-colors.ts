/**
 * Chart color constants — kept in sync with src/styles/_colors.scss.
 * Used in TypeScript chart configurations where SCSS variables are unavailable.
 */
export const CHART_COLORS = {
  primary:       '#1565C0',
  primaryAlpha:  'rgba(21, 101, 192, 0.1)',
  success:       '#2E7D32',
  error:         '#C62828',
  danger:        '#e53935',
  amber:         '#FF8F00',
  grey:          '#9E9E9E',
} as const;

