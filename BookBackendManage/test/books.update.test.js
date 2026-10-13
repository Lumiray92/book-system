/**
 * 接口回归测试 —— 修改图书（图-6 / 图-7）
 *
 * 对应试卷要求：
 *   · 「入库人」和「入库时间」不允许修改（页面只读）
 *   · 无论成功或失败都要给出提示信息
 *   · 修改后刷新「最新更新时间」
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createTestBook, get, put } from './helpers/client.js';
import { deleteBookRow, findBookRow } from './helpers/db.js';

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

/** 提交修改时通用的可编辑字段 */
function editablePayload(overrides = {}) {
  return {
    bookCode: 'TEST_UPDATE',
    bookName: '修改后的书名',
    bookType: 2,
    bookAuthor: '修改后的作者',
    publishPress: '修改后的出版社',
    borrowed: 1,
    ...overrides,
  };
}

describe('PUT /api/books/:id 修改图书', () => {
  describe('成功场景', () => {
    it('返回 code 0 与可直接展示的「修改成功！」提示', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_UPDATE' });

      const res = await put(`/api/books/${bookId}`, editablePayload());

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('修改成功！');
      expect(res.body.data.bookId).toBe(bookId);
    });

    it('可编辑字段全部按提交值更新', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_UPDATE' });

      await put(`/api/books/${bookId}`, editablePayload());

      const row = await findBookRow(bookId);
      expect(row.bookName).toBe('修改后的书名');
      expect(row.bookType).toBe(2);
      expect(row.bookAuthor).toBe('修改后的作者');
      expect(row.publishPress).toBe('修改后的出版社');
      expect(row.borrowed).toBe(1);
    });

    it('刷新「最新更新时间」，且为当前时间附近', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_UPDATE' });

      const before = await findBookRow(bookId);
      expect(before.lastUpdatetime).toBeNull();

      await put(`/api/books/${bookId}`, editablePayload());

      const after = await findBookRow(bookId);
      expect(after.lastUpdatetime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      const diff = Math.abs(new Date(after.lastUpdatetime.replace(' ', 'T')) - new Date());
      expect(diff).toBeLessThan(60_000);
    });

    it('编号保持自身不变时可以正常保存（唯一性校验排除自身）', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_SELF_CODE' });

      const res = await put(
        `/api/books/${bookId}`,
        editablePayload({ bookCode: 'TEST_SELF_CODE', bookName: '改名不改号' })
      );

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);

      const row = await findBookRow(bookId);
      expect(row.bookCode).toBe('TEST_SELF_CODE');
      expect(row.bookName).toBe('改名不改号');
    });

    it('内容原样提交（未做任何改动）也能保存成功', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_NOCHANGE' });
      const row = await findBookRow(bookId);

      const res = await put(`/api/books/${bookId}`, {
        bookCode: row.bookCode,
        bookName: row.bookName,
        bookType: row.bookType,
        bookAuthor: row.bookAuthor,
        publishPress: row.publishPress,
        borrowed: row.borrowed,
      });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });
  });

  describe('只读字段：入库人与入库时间不可修改', () => {
    it('提交新的入库人时被忽略，库中仍是原值', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_READONLY_BY',
        createdBy: '系统管理员',
      });

      const res = await put(
        `/api/books/${bookId}`,
        editablePayload({ createdBy: '张三' })
      );

      expect(res.body.code).toBe(0);

      const row = await findBookRow(bookId);
      expect(row.createdBy).toBe('系统管理员');
      expect(row.createdBy).not.toBe('张三');
    });

    it('提交新的入库时间时被忽略，库中仍是原值', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_READONLY_TIME',
        creationTime: '2020-03-04 05:06:07',
      });

      const res = await put(
        `/api/books/${bookId}`,
        editablePayload({ creationTime: '2099-12-31 23:59:59' })
      );

      expect(res.body.code).toBe(0);

      const row = await findBookRow(bookId);
      expect(row.creationTime).toBe('2020-03-04 05:06:07');
    });

    it('同时篡改入库人与入库时间，两个字段都不受影响', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_READONLY_BOTH',
        createdBy: '系统管理员',
        creationTime: '2021-08-09 10:11:12',
      });

      await put(
        `/api/books/${bookId}`,
        editablePayload({
          bookName: '其它字段照常修改',
          createdBy: '李四',
          creationTime: '2099-01-01 00:00:00',
        })
      );

      const row = await findBookRow(bookId);
      expect(row.bookName).toBe('其它字段照常修改');
      expect(row.createdBy).toBe('系统管理员');
      expect(row.creationTime).toBe('2021-08-09 10:11:12');
    });

    it('出版日期同样保持原值，不被篡改的入库时间带偏', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_READONLY_PUBDATE',
        creationTime: '2019-02-03 08:00:00',
      });

      await put(
        `/api/books/${bookId}`,
        editablePayload({ creationTime: '2099-12-31 23:59:59' })
      );

      const row = await findBookRow(bookId);
      expect(row.publishDate).toBe('2019-02-03');
    });

    it('修改后列表中的入库时间与顺序都不变', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_READONLY_LIST',
        bookName: '只读字段列表校验',
        creationTime: '2018-06-07 08:00:00',
      });

      const before = await get('/api/books', { bookName: '只读字段列表校验' });
      const beforeTime = before.body.data.list[0].creationTime;

      await put(`/api/books/${bookId}`, editablePayload({
        bookCode: 'TEST_READONLY_LIST',
        bookName: '只读字段列表校验（已改）',
        creationTime: '2099-12-31 23:59:59',
      }));

      const after = await get('/api/books', { bookName: '只读字段列表校验（已改）' });
      expect(after.body.data.list[0].creationTime).toBe(beforeTime);
      expect(after.body.data.list[0].creationTime).toBe('2018-06-07');
    });
  });

  describe('编号唯一性', () => {
    it('改成其它图书已占用的编号时返回 409', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_OWN_CODE' });
      await createAndTrack({ bookCode: 'TEST_TAKEN_CODE' });

      const res = await put(
        `/api/books/${bookId}`,
        editablePayload({ bookCode: 'TEST_TAKEN_CODE' })
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(1003);
      expect(res.body.message).toContain('TEST_TAKEN_CODE');
    });

    it('编号冲突时事务回滚，原记录不被改动', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_ROLLBACK',
        bookName: '回滚前的书名',
      });
      await createAndTrack({ bookCode: 'TEST_ROLLBACK_TARGET' });

      await put(
        `/api/books/${bookId}`,
        editablePayload({
          bookCode: 'TEST_ROLLBACK_TARGET',
          bookName: '不应该被写入',
        })
      );

      const row = await findBookRow(bookId);
      expect(row.bookCode).toBe('TEST_ROLLBACK');
      expect(row.bookName).toBe('回滚前的书名');
      expect(row.lastUpdatetime).toBeNull();
    });

    it('改成示例数据中已有的编号时同样被拦下', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_VS_SEED' });

      const res = await put(
        `/api/books/${bookId}`,
        editablePayload({ bookCode: 'BK000023' })
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(1003);
    });
  });

  describe('异常场景', () => {
    it('图书不存在时返回 404', async () => {
      const res = await put('/api/books/99999999', editablePayload());

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(1002);
      expect(res.body.message).toContain('不存在');
    });

    it('图书 ID 不是数字时返回 400', async () => {
      const res = await put('/api/books/abc', editablePayload());

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toContain('ID');
    });

    it('缺少必填项时返回 400 并提示具体原因', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_UPDATE_REQUIRED' });

      const res = await put(`/api/books/${bookId}`, editablePayload({ bookName: '' }));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toContain('图书名称');
    });

    it('图书类型不存在时返回 400', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_UPDATE_TYPE' });

      const res = await put(`/api/books/${bookId}`, editablePayload({ bookType: 9999 }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('图书类型');
    });

    it('校验失败时不会刷新「最新更新时间」', async () => {
      const bookId = await createAndTrack({ bookCode: 'TEST_UPDATE_NOREFRESH' });

      await put(`/api/books/${bookId}`, editablePayload({ bookName: '' }));

      const row = await findBookRow(bookId);
      expect(row.lastUpdatetime).toBeNull();
    });
  });
});