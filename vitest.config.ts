import { defineConfig } from 'vitest/config';

// Unit tests live next to the source; Playwright e2e specs are run by `npm test`.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
