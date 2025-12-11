/**
 * Utility functions
 */

/**
 * Concatenate class names conditionally
 * A simple utility to combine class names, filtering out falsy values
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
