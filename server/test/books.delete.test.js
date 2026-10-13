/**
 * 接口回归测试 —— 删除图书（图-8 / 图-9）
 *
 * 对应试卷要求：
 *   · 删除前弹出确认提示（前端已实现，见 web/assets/js/index.js）
 *   · 删除后返回列表并提示「删除成功！」或「删除失败！」
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createTestBook, del, get } from './helpers/client.js';
import { countBooks, deleteBookRow, findBookRow } from './helpers/db.js';

/** 示例数据条数 */
const SEED_TOTAL = 12;

/** 本文件新增的图书，用后即清 */
const createdIds = [];

/** 新增一本图书并登记清理 */
async function createAndTrack(overrides = {}) {
  const bookId = await createTestBook(overrides);
  createdIds.push(bookId);
  return bookId;
}

afterEach(async () => {
  for (const bookId of createdIds.splice(0)) {
    await deleteBookRow(bookId);
  }
});

afterAll(async () => {
  for (const bookId of createdIds.splice(0)) {
    await deleteBookRow(bookId);
  }
});

describe('DELETE /api/books/:id 删除图书', () => {
  describe('成功场景', () => {
    it('返回 code 0 与可直接展示的「删除成功！」提示', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_DELETE' });

      const res = await del(`/api/books/${bookId}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('删除成功！');
      expect(res.body.data.bookId).toBe(bookId);
    });

    it('记录真的从数据库中消失', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_DELETE_GONE' });

      await del(`/api/books/${bookId}`);

      expect(await findBookRow(bookId)).toBeNull();
    });

    it('删除后总数减 1', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_DELETE_COUNT' });
      const before = await countBooks();

      await del(`/api/books/${bookId}`);

      expect(await countBooks()).toBe(before - 1);
      expect(await countBooks()).toBe(SEED_TOTAL);
    });

    it('删除后按图书名称查不到该记录', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_DELETE_SEARCH',
        bookName: '即将被删除的书',
      });

      const before = await get('/api/books', { bookName: '即将被删除的书' });
      expect(before.body.data.total).toBe(1);

      await del(`/api/books/${bookId}`);

      const after = await get('/api/books', { bookName: '即将被删除的书' });
      expect(after.body.data.total).toBe(0);
      expect(after.body.data.list).toEqual([]);
    });

    it('只删除目标记录，不波及其它图书记录', async () => {
      const keepId = await createAndTrack({ bookCode: 'TEST_KEEP' });
      const dropId = await createAndTrack({ bookCode: 'TEST_DROP' });

      await del(`/api/books/${dropId}`);

      expect(await findBookRow(dropId)).toBeNull();
      expect(await findBookRow(keepId)).not.toBeNull();
    });
  });

  describe('异常场景', () => {
    it('图书不存在时返回 404', async () => {
      const res = await del('/api/books/99999999');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(1002);
      expect(res.body.message).toContain('不存在');
    });

    it('图书 ID 不是数字时返回 400', async () => {
      const res = await del('/api/books/abc');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toContain('ID');
    });

    it('重复删除同一条记录，第二次返回 404', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_DELETE_TWICE' });

      const first = await del(`/api/books/${bookId}`);
      const second = await del(`/api/books/${bookId}`);

      expect(first.body.code).toBe(0);
      expect(second.status).toBe(404);
      expect(second.body.code).toBe(1002);
    });

    it('删除失败时不影响数据总数', async () => {
      const before = await countBooks();

      await del('/api/books/99999999');
      await del('/api/books/abc');

      expect(await countBooks()).toBe(before);
    });
  });

  describe('删除末页数据后的分页回退', () => {
    it('删掉最后一页的全部记录后，请求越界页码会自动回落到新的最后一页', async () => {
      // 造 5 条入库时间最早的图书，使它们排在最后一页
      const oldBookIds = [];
      for (let i = 1; i <= 5; i += 1) {
        oldBookIds.push(
          await createAndTrack({
            bookCode: `TEST_OLD_${i}`,
            bookName: `早期入库 第${i}册`,
            creationTime: `2010-01-0${i} 08:00:00`,
          })
        );
      }

      // 12 + 5 = 17 条 → 4 页，第 4 页有 2 条
      const page4 = await get('/api/books', { page: 4 });
      expect(page4.body.data.total).toBe(17);
      expect(page4.body.data.totalPages).toBe(4);
      expect(page4.body.data.list).toHaveLength(2);

      // 删掉第 4 页的两条
      for (const row of page4.body.data.list) {
        const res = await del(`/api/books/${row.bookId}`);
        expect(res.body.code).toBe(0);
      }

      // 15 条 → 3 页；再请求第 4 页应回落到第 3 页
      const overflow = await get('/api/books', { page: 4 });
      expect(overflow.body.data.total).toBe(15);
      expect(overflow.body.data.totalPages).toBe(3);
      expect(overflow.body.data.page).toBe(3);
      expect(overflow.body.data.list).toHaveLength(5);
    });
  });
});