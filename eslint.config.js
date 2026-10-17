import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Module boundaries: a folder's index.ts is its only public surface.
const AREAS = [
  'shared',
  'glafka',
  'agents',
  'chat',
  'filter',
  'track',
  'store',
  'search',
  'app',
  'workflow',
  'epics',
  'memory',
  'host',
  'webview',
];

const boundaries = AREAS.map((name) => ({
  group: [`**/${name}/*`, `!**/${name}/index`, `!**/${name}/index.js`],
  message: `import from @/${name} — the internals are not the public surface`,
}));

// Only the host may touch VS Code. Everything else stays testable in plain Node.
const NO_VSCODE = {
  name: 'vscode',
  message: 'only src/host/ may import vscode — pass what you need in as an argument',
};

// The webview and shared types run in a browser too, so no Node built-ins.
const NO_NODE = { group: ['node:*'], message: 'the webview runs in a browser — no Node modules' };

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.vscode-test/**', '.worktrees/**'],
  },
  { ignores: ['.glafka/**'] },

  { files: ['**/*.js', '**/*.mjs'], ...js.configs.recommended },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly' },
    },
  },

  ...tseslint.configs.recommended.map((c) => ({ ...c, files: ['**/*.ts', '**/*.tsx'] })),

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Mandatory, not advisory. Over the limit? Split into a folder with an index.
      'max-lines': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': ['error', { paths: [NO_VSCODE], patterns: boundaries }],
    },
  },

  {
    files: ['src/host/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: boundaries }] },
  },

  {
    files: ['src/webview/**/*.ts', 'src/webview/**/*.tsx', 'src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [NO_VSCODE], patterns: [...boundaries, NO_NODE] },
      ],
    },
  },

  // Long test files are usually fine. Long production files rarely are.
  {
    files: ['test/**/*.ts', 'test/**/*.tsx'],
    rules: { 'max-lines': 'off', 'max-lines-per-function': 'off', 'no-restricted-imports': 'off' },
  },

  prettier,
];
