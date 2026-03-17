import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      'out/**',
      'dist/**',
      'resources/**',
      'node_modules/**',
      '*.config.mjs',
      'scripts/**',
    ],
  },

  // JS 基础规则
  js.configs.recommended,

  // TypeScript 规则（主进程 + preload + shared + 测试）
  ...tseslint.configs.recommended,

  // React 渲染层
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+ 不需要手动引入
      'react/prop-types': 'off',          // 使用 TypeScript 类型代替
    },
  },

  // 全局 TypeScript 规则调整
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': 'off', // Electron 应用允许 console
      // react-hooks v7 新增规则过于严格，合法 React 模式会被误报，暂时关闭
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },

  // 关闭与 Prettier 冲突的格式规则（必须放最后）
  prettierConfig,
)
