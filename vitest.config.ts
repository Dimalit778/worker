import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const postgresSuites = 'tests/*-postgres.test.ts'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
          exclude: [...configDefaults.exclude, postgresSuites],
        },
      },
      {
        // These suites share one test database and run Serializable transactions,
        // which conflict across files even for different facilities. Run them one at a time.
        extends: true,
        test: {
          name: 'postgres',
          include: [postgresSuites],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
