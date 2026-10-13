/**
 * Express 应用装配
 *
 * 把中间件、API 路由与前端静态页面组装成一个可测试的 app 实例。
 * 与 server.js 分离，便于回归测试直接引入 app 而不真正监听端口。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRequestLogger } from './middleware/requestLogger.js';
import { createApiRouter } from './routes/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** 前端页面目录：server/src -> ../../web */
const WEB_DIR = path.resolve(currentDir, '../../web');

/**
 * 创建 Express 应用
 * @param {{enableLogger?: boolean}} [options] 运行选项
 * @returns {import('express').Express}
 */
export function createApp(options = {}) {
  const app = express();

  // 关闭 X-Powered-By，减少无用指纹
  app.disable('x-powered-by');

  // ---------- 基础中间件 ----------
  // 表单以 application/json 提交；同时兼容表单编码，便于直接用 curl 调试
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(createRequestLogger({ enabled: options.enableLogger ?? !config.isTest }));

  // ---------- 接口 ----------
  app.use('/api', createApiRouter(options.deps ?? {}));

  // 未命中的 /api 路径统一返回 JSON 结构，避免前端拿到 HTML 解析失败
  app.use('/api', notFoundHandler);

  // ---------- 前端静态页面 ----------
  // 试卷要求的四个页面（列表 / 查看 / 新增 / 修改）由 Express 直接托管
  app.use(express.static(WEB_DIR, { extensions: ['html'] }));

  // ---------- 异常处理（必须最后注册） ----------
  app.use(errorHandler);

  return app;
}

export default createApp;