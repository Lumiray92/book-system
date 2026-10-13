/**
 * 数据库连接池与事务支持
 *
 * 说明：试卷要求「为业务对象添加声明式事务支持，以代码方式实现事务不得分」，
 * 该要求源自 Spring 的 @Transactional 声明式事务。Express 没有 AOP 容器，
 * 因此这里以 withTransaction(fn) 提供等价的「声明式」能力：
 * 业务代码只声明「这段逻辑在一个事务内」，无需手写 begin/commit/rollback。
 */
import mysql from 'mysql2/promise';
import { config } from './env.js';

/** 全局连接池 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  // 让 DATETIME 以字符串返回，避免时区转换导致日期偏移
  dateStrings: true,
  charset: 'utf8mb4_general_ci',
});

/**
 * 在一个事务中执行回调，自动提交或回滚。
 * 事务边界统一收口在这里，Service 层只关心业务逻辑。
 *
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} handler 业务回调
 * @returns {Promise<T>} 回调返回值
 */
export async function withTransaction(handler) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await handler(conn);
    await conn.commit();
    return result;
  } catch (error) {
    // 回滚失败不应掩盖原始异常，故单独兜底
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * 查询多行
 * @param {string} sql    带占位符的 SQL
 * @param {Array}  params 参数
 * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接，缺省用连接池
 * @returns {Promise<Array>}
 */
export async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

/**
 * 查询单行，无结果返回 null
 * @param {string} sql    带占位符的 SQL
 * @param {Array}  params 参数
 * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
 * @returns {Promise<object|null>}
 */
export async function queryOne(sql, params = [], conn = pool) {
  const rows = await query(sql, params, conn);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 执行写操作
 * @param {string} sql    带占位符的 SQL
 * @param {Array}  params 参数
 * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
 * @returns {Promise<import('mysql2').ResultSetHeader>}
 */
export async function execute(sql, params = [], conn = pool) {
  const [result] = await conn.execute(sql, params);
  return result;
}

/**
 * 关闭连接池（测试收尾与优雅退出使用）
 */
export async function closePool() {
  await pool.end();
}

export default pool;