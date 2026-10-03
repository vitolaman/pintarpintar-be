module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // The build config leaves out the e2e tests, which are linted too.
    project: 'tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  // Template modules kept as reference only; the build excludes them too.
  ignorePatterns: [
    '.eslintrc.js',
    'src/api/admin/**',
    'src/api/cron-job/**',
    'src/api/leaderboard/**',
    'src/api/master-country/**',
    'src/api/master-pfp/**',
    'src/api/prediction/**',
    'src/api/task/**',
  ],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
  },
};
