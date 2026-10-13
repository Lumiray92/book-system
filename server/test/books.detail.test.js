/**
 * 接口回归测试 —— 查看图书详情（图-3）与修改页回填（图-6）
 *
 * 对应试卷要求：
 *   · 查看页面所有字段均只读，不可修改
 *   · 点击返回按钮回到列表并保留查询条件与结果（前端实现，见 common.js）
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createTestBook, get } from './helpers/client.js';
import { deleteBookRow } from './helpers/db.js';

/** 本文件新增的图书，用后即清 */
const createdIds = [];

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

describe('GET /api/books/:id 图书详情（图-3）', () => {
  it('返回示例数据中第一条的完整详情', async () => {
    // BK000023 是示例数据里入库时间最晚的一条
    const list = await get('/api/books');
    const first = list.body.data.list[0];

    const res = await get(`/api/books/${first.bookId}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toEqual({
      bookId: first.bookId,
      bookCode: 'BK000023',
      bookName: '企业应用架构模式',
      bookType: 8,
      typeName: '科技',
      bookAuthor: '(英) Martin Fowler',
      publishPress: '机械工业出版社',
      borrowed: 0,
      borrowedText: '未借阅',
      createdBy: '系统管理员',
      creationTime: '2014-07-03',
    });
  });

  it('入库时间按「年-月-日」输出', async () => {
    const res = await get('/api/books/1');

    expect(res.body.data.creationTime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('类型名称由 book_type 表关联得出', async () => {
    const res = await get('/api/books/3');

    expect(res.body.data.bookName).toBe('天龙八部');
    expect(res.body.data.bookType).toBe(1);
    expect(res.body.data.typeName).toBe('小说');
  });

  it('图书不存在时返回 404', async () => {
    const res = await get('/api/books/99999999');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(1002);
    expect(res.body.message).toContain('不存在');
  });

  it('图书 ID 不是数字时返回 400', async () => {
    const res = await get('/api/books/abc');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1001);
    expect(res.body.message).toContain('ID');
  });

  it('图书 ID 为负数时按不存在的记录处理', async () => {
    const res = await get('/api/books/-1');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(1002);
  });
});

describe('GET /api/books/:id/edit 修改页回填数据（图-6）', () => {
  it('返回表单所需的全部字段', async () => {
    const res = await get('/api/books/1');

    expect(res.body.code).toBe(0);

    const edit = await get('/api/books/1/edit');
    expect(edit.status).toBe(200);
    expect(edit.body.code).toBe(0);
    expect(Object.keys(edit.body.data).sort()).toEqual(
      [
        'bookId',
        'bookCode',
        'bookName',
        'bookType',
        'typeName',
        'bookAuthor',
        'publishPress',
        'borrowed',
        'createdBy',
        'creationTime',
      ].sort()
    );
  });

  it('是否借阅返回数值而非中文文案，供下拉框选中', async () => {
    const res = await get('/api/books/2/edit');

    expect(typeof res.body.data.borrowed).toBe('number');
    expect([0, 1]).toContain(res.body.data.borrowed);
    expect(res.body.data.borrowed).toBe(1);
  });

  it('入库时间用 yyyy-MM-dd 以适配日期控件', async () => {
    const res = await get('/api/books/1/edit');

    expect(res.body.data.creationTime).toBe('2014-07-03');
  });

  it('图书类型返回 id，供下拉框选中', async () => {
    const res = await get('/api/books/3/edit');

    expect(typeof res.body.data.bookType).toBe('number');
    expect(res.body.data.bookType).toBe(1);
  });

  it('图书不存在时返回 404', async () => {
    const res = await get('/api/books/99999999/edit');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(1002);
  });

  it('图书 ID 不是数字时返回 400', async () => {
    const res = await get('/api/books/abc/edit');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(1001);
  });

  it('回填数据与详情数据中的只读字段保持一致', async () => {
    const bookId = await createAndTrack({
      bookCode: 'TEST_EDIT_CONSISTENT',
      createdBy: '系统管理员',
      creationTime: '2022-05-06 07:08:09',
    });

    const [detail, edit] = await Promise.all([
      get(`/api/books/${bookId}`),
      get(`/api/books/${bookId}/edit`),
    ]);

    expect(edit.body.data.createdBy).toBe(detail.body.data.createdBy);
    expect(edit.body.data.creationTime).toBe(detail.body.data.creationTime);
    expect(edit.body.data.bookCode).toBe(detail.body.data.bookCode);
  });
});