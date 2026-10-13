/**
 * 每个测试文件的收尾工作
 *
 * Vitest 默认按文件隔离模块，每个测试文件都会新建一个连接池，
 * 若不关闭，进程会因连接池持有句柄而无法退出。
 */
import { afterAll } from 'vitest';

import { closePool } from '../src/config/db.js';

afterAll(async () => {
  await closePool();
});