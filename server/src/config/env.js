/**
 * 环境变量配置
 * 统一从 server/.env 读取，并做必要的缺省与校验，避免拼写错误导致连接串错乱。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// src/config -> ../../.env，即 server/.env
// quiet: 关闭 dotenv v17+ 默认打印的注入提示，避免污染服务启动日志与测试输出
dotenv.config({ path: path.resolve(currentDir, '../../.env'), quiet: true });

/**
 * 读取整型环境变量，缺省时回退
 * @param {string} name     变量名
 * @param {number} fallback 缺省值
 * @returns {number}
 */
function readInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`环境变量 ${name} 必须是整数，当前值为「${raw}」`);
  }
  return parsed;
}

/**
 * 读取必填字符串环境变量
 * @param {string} name 变量名
 * @returns {string}
 */
function readRequired(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    throw new Error(`缺少必填环境变量 ${name}，请检查 server/.env`);
  }
  return raw;
}

export const config = {
  /** HTTP 服务端口 */
  port: readInt('PORT', 3000),

  /** 数据库连接配置 */
  db: {
    // 测试环境允许覆盖为独立库，避免污染开发数据
    host: process.env.DB_HOST || '127.0.0.1',
    port: readInt('DB_PORT', 3306),
    user: readRequired('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'book_db',
    connectionLimit: readInt('DB_CONNECTION_LIMIT', 10),
  },

  /** 当前环境 */
  isTest: process.env.NODE_ENV === 'test',
};

export default config;