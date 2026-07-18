/**
 * Jest configuration for backend testing.
 * 
 * For mid-level projects:
 * - preset: ts-jest for TypeScript
 * - testEnvironment: node
 * - Clear mocks between tests
 * - Coverage thresholds (aim for 70%+ on services)
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/services/**/*.ts',
    '!src/**/*.test.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
