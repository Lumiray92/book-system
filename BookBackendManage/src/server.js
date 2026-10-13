/**
 * 服务启动入口
 *
 * 用法：
 *   npm run dev    开发模式（文件变更自动重启）
 *   npm start      生产模式
 */
import { createApp } from './app.js';
import { closePool } from './config/db.js';
import { config } from './config/env.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log('图书借阅系统-后台管理');
  console.log(`  服务地址：http://localhost:${config.port}`);
  console.log(`  数据库：${config.db.host}:${config.db.port}/${config.db.database}`);
});

/**
 * 优雅退出：先停止接收新请求，再释放数据库连接池
 * @param {string} signal 信号名
 */
function shutdown(signal) {
  console.log(`\n收到 ${signal}，正在关闭服务 ...`);
  server.close(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error('关闭数据库连接池失败：', error.message);
    }
    console.log('服务已关闭');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;