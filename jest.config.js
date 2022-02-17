module.exports = {
  testEnvironment: 'node',
  transform: {
    '\\.(ts)$': 'ts-jest'
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/templates/'
  ],
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'ts',
    'tsx',
    'node'
  ],
  testMatch: [
    '**/*.spec.ts'
  ]
}
