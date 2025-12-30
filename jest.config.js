module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/src/__tests__/setup.ts',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.{js,jsx,ts,tsx}',
    '<rootDir>/src/__tests__/**/*.test.{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/src/types/__tests__/manual-validation-check.ts',
    '<rootDir>/src/__tests__/test-data/',
    '<rootDir>/src/__tests__/pipeline/',
    '<rootDir>/src/__tests__/run-comprehensive-tests.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/__tests__/**',
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@expo/vector-icons': '<rootDir>/src/__tests__/__mocks__/expo-vector-icons.js',
    '^expo-haptics': '<rootDir>/src/__tests__/__mocks__/expo-haptics.js',
    '^react-native-gesture-handler': '<rootDir>/src/__tests__/__mocks__/react-native-gesture-handler.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|react-native-elements|react-native-vector-icons|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-screens)/)',
  ],
  maxWorkers: 1, // Run tests serially to avoid worker issues
};