module.exports = {
  testEnvironment: 'node',
  roots: [ '<rootDir>/unit-test', '<rootDir>/e2e-test' ],
  testMatch: [ '**/*.test.ts' ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
