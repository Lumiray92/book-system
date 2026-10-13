/**
 * 回归测试的数据库准备
 *
 * 目的：每次执行 npm test 都从「一份干净的试卷示例数据」开始，
 * 使测试结果可重复，不受上一次运行残留数据的影响。
 *
 * 做法：直接复用项目交付的 sql/01_schema.sql 与 sql/02_seed.sql。
 * 试卷要求提交的正是这两份原样脚本，故不修改文件本身，
 * 只在执行前把其中的库名替换为测试库名。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';

import { config } from '../src/config/env.js';
import { TEST_DB_NAME } from './testEnv.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** sql 目录：server/test -> ../../sql，即项目根目录下的 sql/ */
const SQL_DIR = path.resolve(currentDir, '../../sql');

/**
 * 把脚本中的开发库名换成测试库名
 * @param {string} sql 原始脚本内容
 * @returns {string} 改写后的脚本内容
 */
function useTestDatabase(sql) {
  return sql.replaceAll('book_db', TEST_DB_NAME);
}

export default async function globalSetup() {
  const [schemaSql, seedSql] = await Promise.all([
    fs.readFile(path.join(SQL_DIR, '01_schema.sql'), 'utf8'),
    fs.readFile(path.join(SQL_DIR, '02_seed.sql'), 'utf8'),
  ]);

  // 建库脚本自身负责 CREATE DATABASE，故此处连接时不指定数据库
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    charset: 'utf8mb4_general_ci',
  });

  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${TEST_DB_NAME}\``);
    await conn.query(useTestDatabase(schemaSql));
    await conn.query(useTestDatabase(seedSql));

    const [[{ bookCount }]] = await conn.query(
      `SELECT COUNT(*) AS bookCount FROM \`${TEST_DB_NAME}\`.book_info`
    );
    const [[{ typeCount }]] = await conn.query(
      `SELECT COUNT(*) AS typeCount FROM \`${TEST_DB_NAME}\`.book_type`
    );

    // 示例数据是全部用例的前提，数量不对说明脚本没跑通，直接中止测试
    if (bookCount !== 12 || typeCount !== 8) {
      throw new Error(
        `测试数据初始化异常：期望 book_info 12 条 / book_type 8 条，` +
          `实际 ${bookCount} 条 / ${typeCount} 条`
      );
    }

    console.log(
      `\n[globalSetup] 测试库 ${TEST_DB_NAME} 已重建：` +
        `book_info ${bookCount} 条，book_type ${typeCount} 条`
    );
  } finally {
    await conn.end();
  }
}