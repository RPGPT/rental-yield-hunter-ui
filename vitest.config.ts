import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        plugins: [angular()],
        test: {
          name: 'angular',
          environment: 'jsdom',
          setupFiles: ['src/test-setup.ts'],
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['api/**/*.spec.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/app/**/*.ts', 'api/**/*.ts'],
      exclude: [
        'src/test-setup.ts',
        'src/main.ts',
        'src/environments/**',
        'src/styles/**',
        '**/*.spec.ts',
        '**/*.d.ts',
      ],
    },
  },
});
