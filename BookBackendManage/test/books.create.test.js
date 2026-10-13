/**
 * 接口回归测试 —— 新增图书（图-4 / 图-5）
 *
 * 对应试卷要求：
 *   · 入库时间默认为当前时间，入库人默认为当前登录用户（本项目固定「系统管理员」）
 *   · 无论成功或失败都要给出提示信息
 *   · 操作数据库时进行必要的异常处理
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { createTestBook, get, post } from './helpers/client.js';
import { countBooks, deleteBookRow, findBookRow, findBookRowByCode } from './helpers/db.js';

/** 示例数据条数 */
const SEED_TOTAL = 12;

/** 本文件新增的图书，用后即清 */
const createdIds = [];

/** 记一笔待清理的图书 */
function track(bookId) {
  createdIds.push(bookId);
  return bookId;
}

/** 新增一本图书并登记清理 */
async function createAndTrack(overrides = {}) {
  return track(await createTestBook(overrides));
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

describe('POST /api/books 新增图书', () => {
  describe('成功场景', () => {
    it('返回 code 0 与可直接展示的「新增成功！」提示', async () => {
      const res = await post('/api/books', {
        bookCode: 'TEST_OK',
        bookName: '新增测试书',
        bookType: 1,
        bookAuthor: '作者甲',
        publishPress: '出版社甲',
        borrowed: 0,
        createdBy: '系统管理员',
        creationTime: '2024-05-06 10:20:30',
      });

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.message).toBe('新增成功！');
      expect(typeof res.body.data.bookId).toBe('number');

      track(res.body.data.bookId);
    });

    it('数据真正写入数据库，字段逐一对应', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_PERSIST',
        bookName: '落库测试书',
        bookType: 3,
        bookAuthor: '作者乙',
        publishPress: '出版社乙',
        borrowed: 1,
        createdBy: '系统管理员',
        creationTime: '2024-05-06 10:20:30',
      });

      const row = await findBookRow(bookId);

      expect(row).not.toBeNull();
      expect(row.bookCode).toBe('TEST_PERSIST');
      expect(row.bookName).toBe('落库测试书');
      expect(row.bookType).toBe(3);
      expect(row.bookAuthor).toBe('作者乙');
      expect(row.publishPress).toBe('出版社乙');
      expect(row.borrowed).toBe(1);
      expect(row.createdBy).toBe('系统管理员');
      expect(row.creationTime).toBe('2024-05-06 10:20:30');
      // 新增时还没有更新过，最新更新时间应为 NULL
      expect(row.lastUpdatetime).toBeNull();
    });

    it('新增后总数 +1，且因入库时间最新而排在列表首位', async () => {
      const before = await countBooks();

      await createAndTrack({
        bookCode: 'TEST_ORDER',
        bookName: '排序测试书',
        creationTime: '2099-01-01 00:00:00',
      });

      const after = await countBooks();
      expect(after).toBe(before + 1);

      const list = await get('/api/books');
      expect(list.body.data.total).toBe(SEED_TOTAL + 1);
      expect(list.body.data.list[0].bookCode).toBe('TEST_ORDER');
    });
  });

  describe('默认值', () => {
    it('入库时间省略时取当前时间', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_DEFAULT_TIME',
        creationTime: undefined,
      });

      const row = await findBookRow(bookId);
      const now = new Date();

      expect(row.creationTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      // 允许一分钟误差
      const diff = Math.abs(new Date(row.creationTime.replace(' ', 'T')) - now);
      expect(diff).toBeLessThan(60_000);
    });

    it('入库人省略时默认为「系统管理员」', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_DEFAULT_BY',
        createdBy: '',
      });

      const row = await findBookRow(bookId);
      expect(row.createdBy).toBe('系统管理员');
    });

    it('入库时间只给日期时补足为当天 00:00:00', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_DATE_ONLY',
        creationTime: '2024-03-08',
      });

      const row = await findBookRow(bookId);
      expect(row.creationTime).toBe('2024-03-08 00:00:00');
    });

    it('出版日期由入库时间的当天补齐，满足表结构非空约束', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_PUBDATE',
        creationTime: '2024-07-09 15:30:00',
      });

      const row = await findBookRow(bookId);
      expect(row.publishDate).toBe('2024-07-09');
    });
  });

  describe('非必填字段', () => {
    it('作者与出版社留空时以空串入库，不报错', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_EMPTY_OPTIONAL',
        bookAuthor: '',
        publishPress: '',
      });

      const row = await findBookRow(bookId);
      expect(row.bookAuthor).toBe('');
      expect(row.publishPress).toBe('');
    });

    it('作者与出版社省略时同样以空串入库', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_MISSING_OPTIONAL',
        bookAuthor: undefined,
        publishPress: undefined,
      });

      const row = await findBookRow(bookId);
      expect(row.bookAuthor).toBe('');
      expect(row.publishPress).toBe('');
    });
  });

  describe('校验：必填项', () => {
    /**
     * 逐个删掉一个必填字段，确认都会被拦下
     * 必填范围依据试卷正文与图-4 的星号：图书编号 / 图书名称 / 图书类型 / 是否借阅 / 入库人 / 入库时间
     */
    const requiredCases = [
      ['bookCode', '图书编号'],
      ['bookName', '图书名称'],
      ['bookType', '图书类型'],
      ['borrowed', '是否借阅'],
    ];

    requiredCases.forEach(([field, label]) => {
      it(`缺少「${label}」时返回 400 并提示具体原因`, async () => {
        const before = await countBooks();

        const res = await post('/api/books', {
          bookCode: 'TEST_REQUIRED',
          bookName: '必填项测试',
          bookType: 1,
          borrowed: 0,
          creationTime: '2024-01-01 00:00:00',
          [field]: '',
        });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe(1001);
        expect(res.body.message).toContain(label);

        // 校验失败不应留下任何数据
        expect(await countBooks()).toBe(before);
      });
    });

    it('图书编号为纯空格时视为未填写', async () => {
      const res = await post('/api/books', {
        bookCode: '    ',
        bookName: '空白编号测试',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toContain('图书编号');
    });

    it('失败时返回 errors 数组，逐条列出全部问题', async () => {
      const res = await post('/api/books', {
        bookCode: '',
        bookName: '',
        bookType: '',
        borrowed: '',
      });

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.data.errors)).toBe(true);
      expect(res.body.data.errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('校验：字段取值范围', () => {
    it('是否借阅为 0 时视为有效值（不能被真值判断误伤）', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_BORROWED_ZERO',
        borrowed: 0,
      });

      const row = await findBookRow(bookId);
      expect(row.borrowed).toBe(0);
    });

    it('是否借阅为 1 时有效', async () => {
      const bookId = await createAndTrack({
        bookCode: 'TEST_BORROWED_ONE',
        borrowed: 1,
      });

      const row = await findBookRow(bookId);
      expect(row.borrowed).toBe(1);
    });

    it('是否借阅为 2 时被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'TEST_BORROWED_BAD',
        bookName: '借阅状态测试',
        bookType: 1,
        borrowed: 2,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('是否借阅');
    });

    it('图书类型不存在于 book_type 表时被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'TEST_TYPE_MISSING',
        bookName: '类型测试',
        bookType: 9999,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toContain('图书类型');
    });

    it('图书类型为 0 或负数时被拦下', async () => {
      const [zero, negative] = await Promise.all([
        post('/api/books', {
          bookCode: 'TEST_TYPE_ZERO',
          bookName: '类型零测试',
          bookType: 0,
          borrowed: 0,
          creationTime: '2024-01-01 00:00:00',
        }),
        post('/api/books', {
          bookCode: 'TEST_TYPE_NEG',
          bookName: '类型负测试',
          bookType: -1,
          borrowed: 0,
          creationTime: '2024-01-01 00:00:00',
        }),
      ]);

      expect(zero.status).toBe(400);
      expect(negative.status).toBe(400);
    });

    it('入库时间格式非法时被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'TEST_BAD_TIME',
        bookName: '时间格式测试',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024年1月1日',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('入库时间');
    });

    it('入库时间为不存在的日期时被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'TEST_FEB30',
        bookName: '非法日期测试',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-02-30',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('入库时间');
    });
  });

  describe('校验：字段长度', () => {
    it('图书编号超过 50 字符时被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'X'.repeat(51),
        bookName: '长度测试',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('图书编号');
    });

    it('图书名称超过 100 字符时被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'TEST_LONG_NAME',
        bookName: '名'.repeat(101),
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('图书名称');
    });

    it('长度正好等于上限时可以通过', async () => {
      const bookId = await createAndTrack({
        bookCode: 'Y'.repeat(50),
        bookName: '名'.repeat(100),
      });

      const row = await findBookRow(bookId);
      expect(row.bookCode).toHaveLength(50);
      expect(row.bookName).toHaveLength(100);
    });
  });

  describe('图书编号唯一性', () => {
    it('编号重复时返回 409 并提示具体编号', async () => {
      await createAndTrack({ bookCode: 'TEST_DUP' });

      const res = await post('/api/books', {
        bookCode: 'TEST_DUP',
        bookName: '重复编号测试',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(1003);
      expect(res.body.message).toContain('TEST_DUP');
      expect(res.body.message).toContain('已存在');
    });

    it('与示例数据中的编号重复时同样被拦下', async () => {
      const res = await post('/api/books', {
        bookCode: 'BK000023',
        bookName: '与示例数据重复',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe(1003);
    });

    it('编号重复时事务回滚，不会留下半条数据', async () => {
      await createAndTrack({ bookCode: 'TEST_DUP_ROLLBACK' });

      const before = await countBooks();

      await post('/api/books', {
        bookCode: 'TEST_DUP_ROLLBACK',
        bookName: '回滚测试',
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(await countBooks()).toBe(before);
      // 库里仍只有最初那一条
      const row = await findBookRowByCode('TEST_DUP_ROLLBACK');
      expect(row.bookName).not.toBe('回滚测试');
    });
  });
});