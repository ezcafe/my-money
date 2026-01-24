import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: '50%', // Use half of available CPUs
  testTimeout: 10000, // 10 second timeout
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@resolvers/(.*)$': '<rootDir>/src/resolvers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/**/*.interface.ts', // Exclude type-only files
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'ESNext',
        },
        isolatedModules: true, // Faster compilation
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;
