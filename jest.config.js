/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['<rootDir>/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '__fixtures__'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['html', 'json'],
  testTimeout: 20_000,
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],
  maxConcurrency: 5,
  testPathIgnorePatterns: ['/node_modules/', '/dist/*'],
  modulePathIgnorePatterns: ['<rootDir>/dist'],
}
