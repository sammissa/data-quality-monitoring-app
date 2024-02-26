module.exports = {
  testEnvironment: 'node',
  roots: [ '<rootDir>/unit-test' ],
  testMatch: [ '**/*.test.ts' ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};
