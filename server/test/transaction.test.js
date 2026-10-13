/**
 * 接口回归测试 —— 声明式事务
 *
 * 对应试卷「四、具体要求」第 9 条：
 * 为业务对象添加声明式事务支持（原文强调「以代码方式实现事务不得分」）。
 *
 * 本项目以 withTransaction(fn) 提供等价能力：事务边界由该包装器接管，
 * 业务代码只声明「这段逻辑在一个事务内」，不出现 begin / commit / rollback。
 * 本文件既验证事务行为本身，也守住「业务代码里不得手写事务语句」这条约束。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { config } from '../src/config/env.js';
import { pool, withTransaction } from '../src/config/db.js';
import { cleanupTestBooks, findBookRowByCode } from './helpers/db.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** 业务代码所在目录：Service 层是声明式事务的适用对象 */
const SERVICES_DIR = path.resolve(currentDir, '../src/services');

describe('withTransaction 声明式事务', () => {
  describe('行为', () => {
    it('回调正常返回时提交，数据落库', async () => {
      const result = await withTransaction(async (conn) => {
        await conn.execute(
          `INSERT INTO book_info
             (bookCode, bookName, bookType, bookAuthor, publishPress,
              publishDate, borrowed, createdBy, creationTime)
           VALUES (?, ?, 1, '', '', '2024-01-01', 0, '系统管理员', '2024-01-01 00:00:00')`,
          ['TEST_TX_COMMIT', '事务提交测试']
        );
        return 'done';
      });

      expect(result).toBe('done');
      expect(await findBookRowByCode('TEST_TX_COMMIT')).not.toBeNull();

      await cleanupTestBooks();
    });

    it('回调抛异常时回滚，已执行的写操作全部撤销', async () => {
      await expect(
        withTransaction(async (conn) => {
          await conn.execute(
            `INSERT INTO book_info
               (bookCode, bookName, bookType, bookAuthor, publishPress,
                publishDate, borrowed, createdBy, creationTime)
             VALUES (?, ?, 1, '', '', '2024-01-01', 0, '系统管理员', '2024-01-01 00:00:00')`,
            ['TEST_TX_ROLLBACK', '事务回滚测试']
          );

          throw new Error('模拟业务失败');
        })
      ).rejects.toThrow('模拟业务失败');

      // 插入语句执行过了，但事务回滚后不应留下任何痕迹
      expect(await findBookRowByCode('TEST_TX_ROLLBACK')).toBeNull();
    });

    it('遍历半数图书记录后失败，改动依然全部撤销', async () => {
      const before = await pool.query('SELECT bookCode FROM book_info ORDER BY bookId');

      await expect(
        withTransaction(async (conn) => {
          await conn.execute("UPDATE book_info SET bookName = '被事务改过的名字'");
          await conn.execute("DELETE FROM book_info WHERE bookCode LIKE 'BK00003%'");

          throw new Error('模拟中途失败');
        })
      ).rejects.toThrow('模拟中途失败');

      const after = await pool.query('SELECT bookCode FROM book_info ORDER BY bookId');

      // 行数与内容都与事务前完全一致
      expect(after[0]).toEqual(before[0]);

      const [changed] = await pool.query(
        "SELECT COUNT(*) AS total FROM book_info WHERE bookName = '被事务改过的名字'"
      );
      expect(changed[0].total).toBe(0);
    });

    it('异常原样向上传播，不被包装或吞掉', async () => {
      const original = new Error('原始错误');

      await expect(
        withTransaction(async () => {
          throw original;
        })
      ).rejects.toBe(original);
    });

    it('事务结束后连接归还连接池，连续多次事务不会耗尽连接', async () => {
      const limit = config.db.connectionLimit;

      // 串行执行次数远超连接上限，若连接未归还此处会挂起直至超时
      for (let i = 0; i < limit * 3; i += 1) {
        await withTransaction(async (conn) => {
          await conn.query('SELECT 1');
        });
      }

      // 失败路径同样要归还连接
      for (let i = 0; i < limit * 3; i += 1) {
        await expect(
          withTransaction(async () => {
            throw new Error('失败路径');
          })
        ).rejects.toThrow('失败路径');
      }

      const [rows] = await pool.query('SELECT 1 AS ok');
      expect(rows[0].ok).toBe(1);
    });

    it('嵌套调用会各自开启独立事务，内层回滚不影响外层', async () => {
      const result = await withTransaction(async () => {
        await expect(
          withTransaction(async () => {
            throw new Error('内层失败');
          })
        ).rejects.toThrow('内层失败');

        await pool.query('SELECT 1');
        return '外层完成';
      });

      expect(result).toBe('外层完成');
    });
  });

  describe('业务代码中不得手写事务语句', () => {
    it('Service 层不出现 beginTransaction / commit / rollback', async () => {
      const files = (await fs.readdir(SERVICES_DIR)).filter((name) => name.endsWith('.js'));
      expect(files.length).toBeGreaterThan(0);

      for (const name of files) {
        const source = await fs.readFile(path.join(SERVICES_DIR, name), 'utf8');

        // 去掉注释后再检查，避免注释里提到这些词造成误报
        const code = source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');

        expect(code, `${name} 不应出现 beginTransaction`).not.toContain('beginTransaction');
        expect(code, `${name} 不应出现 conn.commit`).not.toContain('.commit(');
        expect(code, `${name} 不应出现 conn.rollback`).not.toContain('.rollback(');
      }
    });

    it('Service 层的写操作都通过 withTransaction 声明事务边界', async () => {
      const source = await fs.readFile(
        path.join(SERVICES_DIR, 'BookInfoService.js'),
        'utf8'
      );

      // createBook / updateBook / removeBook 三个写操作
      const usageCount = (source.match(/withTransaction\(/g) ?? []).length;
      expect(usageCount).toBe(3);
    });

    it('事务语句只出现在连接池模块中', async () => {
      const source = await fs.readFile(
        path.resolve(currentDir, '../src/config/db.js'),
        'utf8'
      );

      expect(source).toContain('beginTransaction');
      expect(source).toContain('conn.commit()');
      expect(source).toContain('conn.rollback()');
    });
  });
});