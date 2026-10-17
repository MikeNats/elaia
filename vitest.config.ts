import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  test: {
    coverage: { include: ['src/**'], exclude: ['src/host/**', 'src/webview/main.tsx'] },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          // The unit suite stays fast: no test waits on a real agent.
          testTimeout: 5_000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'webview',
          include: ['test/webview/**/*.test.tsx'],
          environment: 'jsdom',
          testTimeout: 5_000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'glafka',
          include: ['test/glafka/**/*.test.ts'],
          environment: 'node',
          // Runs the real glafka CLI on a temp git repo.
          testTimeout: 60_000,
        },
      },
    ],
  },
});
