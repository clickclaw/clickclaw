import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Node 环境，无需浏览器
    environment: 'node',
    // 全局 API（describe/it/expect）不需要每个文件 import
    globals: true,
    // 只扫描 src/test 下的测试文件
    include: ['src/test/**/*.test.ts'],
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/**/*.ts'],
      exclude: ['src/main/index.ts', 'src/main/tray.ts', 'src/main/logger.ts']
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      electron: resolve(__dirname, 'src/test/mocks/electron.ts'),
      'electron-log': resolve(__dirname, 'src/test/mocks/electron-log.ts'),
    }
  }
})
