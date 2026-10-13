/**
 * 数据库初始化脚本
 *
 * 依次执行 sql/01_schema.sql 与 sql/02_seed.sql，
 * 完成建库、建表、主键自增设置与测试数据灌入。
 *
 * 用法：npm run db:init
 *
 * 连接时不指定 database，因为 01_schema.sql 自身会 CREATE DATABASE。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../src/config/env.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
// server/scripts -> ../../sql，即项目根目录下的 sql/
const SQL_DIR = path.resolve(currentDir, '../../sql');

/** 按顺序执行的脚本清单 */
const SCRIPTS = ['01_schema.sql', '02_seed.sql'];

/**
 * 读取并执行单个 SQL 文件
 * @param {import('mysql2/promise').Connection} conn 数据库连接
 * @param {string} fileName 脚本文件名
 */
async function runScript(conn, fileName) {
  const filePath = path.join(SQL_DIR, fileName);
  const sql = await fs.readFile(filePath, 'utf8');

  process.stdout.write(`  → 执行 ${fileName} ... `);
  // multipleStatements 允许一次提交整个脚本
  const [result] = await conn.query(sql);
  process.stdout.write('完成\n');

  return result;
}

async function main() {
  console.log('数据库初始化开始');
  console.log(`  目标：${config.db.host}:${config.db.port}  脚本目录：${SQL_DIR}`);

  // 不指定 database，交由 01_schema.sql 创建
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
    charset: 'utf8mb4_general_ci',
  });

  try {
    for (const script of SCRIPTS) {
      await runScript(conn, script);
    }
    console.log('数据库初始化完成 ✓');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('\n数据库初始化失败：');
  console.error(`  ${error.message}`);
  process.exitCode = 1;
});