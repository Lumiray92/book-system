/**
 * 接口回归测试 —— 图书列表（图-1 / 图-2）
 *
 * 对应试卷要求：
 *   · 默认按入库时间降序，查询所有图书
 *   · 每页显示 5 条数据
 *   · 按图书名称进行模糊查询
 *   · 入库时间按「年-月-日」显示
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { get } from './helpers/client.js';
import { cleanupTestBooks, deleteBookRow, insertBookRow } from './helpers/db.js';

/** 示例数据条数，与 sql/02_seed.sql 一致 */
const SEED_TOTAL = 12;

/** 本文件构造的测试数据，用后即清，避免影响分页与总数断言 */
const createdIds = [];

/** 插入一条测试图书并登记待清理 */
async function seedTestBook(data) {
  const bookId = await insertBookRow(data);
  createdIds.push(bookId);
  return bookId;
}

/** 清掉本次用例造的数据 */
async function cleanupCreatedBooks() {
  for (const bookId of createdIds.splice(0)) {
    await deleteBookRow(bookId);
  }
}

beforeAll(async () => {
  // 上一次运行若中途失败可能留下残数据，先清干净再断言总数
  await cleanupTestBooks();
});

// 每个用例自带数据自理，保证「总数 12 条」这类断言始终成立
afterEach(cleanupCreatedBooks);

afterAll(cleanupCreatedBooks);

describe('GET /api/books 图书列表', () => {
  describe('默认查询', () => {
    it('不传任何参数时返回全部图书，共 3 页（每页 5 条）', async () => {
      const res = await get('/api/books');

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.total).toBe(SEED_TOTAL);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pageSize).toBe(5);
      expect(res.body.data.totalPages).toBe(3);
      expect(res.body.data.list).toHaveLength(5);
    });

    it('按入库时间降序排列，首条为示例数据中入库时间最晚的一条', async () => {
      const res = await get('/api/books');

      expect(res.body.data.list[0].bookCode).toBe('BK000023');
      expect(res.body.data.list[0].bookName).toBe('企业应用架构模式');
    });

    it('列表行字段与图-1 的列一一对应，入库时间已格式化为「年-月-日」', async () => {
      const res = await get('/api/books');
      const first = res.body.data.list[0];

      expect(Object.keys(first).sort()).toEqual(
        [
          'bookAuthor',
          'bookCode',
          'bookId',
          'bookName',
          'bookType',
          'borrowed',
          'borrowedText',
          'creationTime',
          'publishPress',
          'typeName',
        ].sort()
      );

      expect(first.creationTime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(first.creationTime).toBe('2014-07-03');
    });

    it('类型名称由 book_type 表关联得出，而非直接输出存库的 id', async () => {
      const res = await get('/api/books');
      const first = res.body.data.list[0];

      expect(first.bookType).toBe(8);
      expect(first.typeName).toBe('科技');
    });

    it('是否借阅输出可直接展示的中文文案', async () => {
      const res = await get('/api/books');
      const texts = res.body.data.list.map((row) => row.borrowedText);

      expect(texts).toContain('已借阅');
      texts.forEach((text) => expect(['已借阅', '未借阅']).toContain(text));
    });
  });

  describe('分页', () => {
    it('第 2 页返回 5 条，且与第 1 页无重复', async () => {
      const [first, second] = await Promise.all([
        get('/api/books', { page: 1 }),
        get('/api/books', { page: 2 }),
      ]);

      const firstIds = first.body.data.list.map((row) => row.bookId);
      const secondIds = second.body.data.list.map((row) => row.bookId);

      expect(secondIds).toHaveLength(5);
      expect(secondIds.filter((id) => firstIds.includes(id))).toEqual([]);
    });

    it('最后一页（第 3 页）返回剩余的 2 条', async () => {
      const res = await get('/api/books', { page: 3 });

      expect(res.body.data.page).toBe(3);
      expect(res.body.data.list).toHaveLength(2);
    });

    it('三页数据连起来正好是全部 12 条，无遗漏无重复', async () => {
      const pages = await Promise.all([
        get('/api/books', { page: 1 }),
        get('/api/books', { page: 2 }),
        get('/api/books', { page: 3 }),
      ]);

      const ids = pages.flatMap((res) => res.body.data.list.map((row) => row.bookId));

      expect(ids).toHaveLength(SEED_TOTAL);
      expect(new Set(ids).size).toBe(SEED_TOTAL);
    });

    it('页码越界时回落到最后一页（删除末页最后一条后返回列表会触发）', async () => {
      const res = await get('/api/books', { page: 99 });

      expect(res.body.data.page).toBe(3);
      expect(res.body.data.list).toHaveLength(2);
    });

    it('页码非数字或小于 1 时按第 1 页处理', async () => {
      const [notNumber, zero, negative] = await Promise.all([
        get('/api/books', { page: 'abc' }),
        get('/api/books', { page: 0 }),
        get('/api/books', { page: -3 }),
      ]);

      expect(notNumber.body.data.page).toBe(1);
      expect(zero.body.data.page).toBe(1);
      expect(negative.body.data.page).toBe(1);
    });

    it('pageSize 超过上限时被收敛，不会一次拉全表', async () => {
      const res = await get('/api/books', { pageSize: 99999 });

      expect(res.body.data.pageSize).toBe(100);
    });
  });

  describe('按图书名称模糊查询（图-2）', () => {
    it('命中单条时 total 为 1', async () => {
      const res = await get('/api/books', { bookName: '天龙八部' });

      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list[0].bookCode).toBe('BK000025');
    });

    it('支持部分匹配', async () => {
      const res = await get('/api/books', { bookName: '系列' });

      expect(res.body.data.total).toBe(1);
      expect(res.body.data.list[0].bookName).toBe('小猫咪成长系列');
    });

    it('查询条件前后空格被忽略', async () => {
      const res = await get('/api/books', { bookName: '  天龙八部  ' });

      expect(res.body.data.total).toBe(1);
    });

    it('按图书名称匹配，而不是按出版社或作者匹配', async () => {
      // 「机械工业出版社」是出版社名，不应作为图书名称命中任何记录
      const byPress = await get('/api/books', { bookName: '机械工业出版社' });
      expect(byPress.body.data.total).toBe(0);

      // 「金庸」是作者名，同样不应命中
      const byAuthor = await get('/api/books', { bookName: '金庸' });
      expect(byAuthor.body.data.total).toBe(0);
    });

    it('命中多条时依然按入库时间降序排列', async () => {
      // 示例数据的书名各不相同，造几条同前缀数据来验证「多命中 + 排序」
      const times = ['2015-03-01 08:00:00', '2017-09-20 12:00:00', '2016-06-15 18:30:00'];
      for (const [index, creationTime] of times.entries()) {
        await seedTestBook({
          bookCode: `TEST_SORT_${index}`,
          bookName: `降序验证丛书 第${index}册`,
          bookType: 1,
          creationTime,
        });
      }

      const res = await get('/api/books', { bookName: '降序验证丛书' });

      expect(res.body.data.total).toBe(3);
      expect(res.body.data.list.map((row) => row.creationTime)).toEqual([
        '2017-09-20',
        '2016-06-15',
        '2015-03-01',
      ]);
    });

    it('无命中时返回空列表且 total 为 0，而不是报错', async () => {
      const res = await get('/api/books', { bookName: '这本书一定不存在' });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.totalPages).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });

    it('LIKE 通配符被转义：查询 % 不会匹配到全部图书', async () => {
      const res = await get('/api/books', { bookName: '%' });

      expect(res.body.data.total).toBe(0);
      expect(res.body.data.list).toEqual([]);
    });

    it('LIKE 通配符被转义：查询 _ 不会匹配任意单字符', async () => {
      const res = await get('/api/books', { bookName: '_' });

      expect(res.body.data.total).toBe(0);
    });

    it('书名中的下划线能被字面量精确匹配', async () => {
      await seedTestBook({
        bookCode: 'TEST_UNDERSCORE',
        bookName: 'A_B 测试',
        bookType: 1,
        creationTime: '2025-01-01 00:00:00',
      });

      const hit = await get('/api/books', { bookName: 'A_B' });
      const miss = await get('/api/books', { bookName: 'AXB' });

      expect(hit.body.data.total).toBe(1);
      expect(miss.body.data.total).toBe(0);
    });

    it('查询结果同样分页，每页 5 条', async () => {
      // 造 7 条同前缀数据 → 查询结果 7 条，应为 2 页
      for (let i = 1; i <= 7; i += 1) {
        await seedTestBook({
          bookCode: `TEST_PAGE_${i}`,
          bookName: `分页测试丛书 第${i}册`,
          bookType: 1,
          creationTime: `2026-01-0${i} 08:00:00`,
        });
      }

      const page1 = await get('/api/books', { bookName: '分页测试丛书', page: 1 });
      const page2 = await get('/api/books', { bookName: '分页测试丛书', page: 2 });

      expect(page1.body.data.total).toBe(7);
      expect(page1.body.data.totalPages).toBe(2);
      expect(page1.body.data.list).toHaveLength(5);
      expect(page2.body.data.list).toHaveLength(2);

      // 入库时间最新的「第7册」应排在第一位
      expect(page1.body.data.list[0].bookName).toBe('分页测试丛书 第7册');
    });
  });

  describe('新增数据后的排序位置', () => {
    it('入库时间最新的图书排在列表首位，清理后总数复原', async () => {
      // 入库时间晚于全部示例数据
      const bookId = await insertBookRow({
        bookCode: 'TEST_LATEST',
        bookName: '最新入库的书',
        bookType: 1,
        creationTime: '2099-12-31 23:59:59',
      });

      const afterInsert = await get('/api/books');
      expect(afterInsert.body.data.list[0].bookCode).toBe('TEST_LATEST');
      expect(afterInsert.body.data.total).toBe(SEED_TOTAL + 1);

      await deleteBookRow(bookId);

      const afterDelete = await get('/api/books');
      expect(afterDelete.body.data.total).toBe(SEED_TOTAL);
      expect(afterDelete.body.data.list[0].bookCode).toBe('BK000023');
    });
  });
});