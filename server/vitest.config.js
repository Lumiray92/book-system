import { defineConfig } from 'vitest/config';

import { TEST_DB_NAME } from './test/testEnv.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    globalSetup: ['./test/globalSetup.js'],
    setupFiles: ['./test/setupFiles.js'],

    // 让被测应用连到测试库。
    // src/config/env.js 用 dotenv 读取 .env，而 dotenv 默认不覆盖已存在的
    // 环境变量，所以这里设置的值优先于 .env 里的 DB_NAME。
    env: {
      NODE_ENV: 'test',
      DB_NAME: TEST_DB_NAME,
    },

    // 所有测试文件共用同一个库，串行执行避免互相干扰
    fileParallelism: false,

    testTimeout: 15000,
    hookTimeout: 30000,

    // 断言失败时打印完整差异，便于定位
    reporters: ['default'],
  },
});