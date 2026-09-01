import { defineConfig } from 'vitest/config';

/**
 * The web app's tests read source files as text rather than rendering
 * anything, so they want plain Node — no jsdom, no React transform.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
