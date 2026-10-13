/**
 * 接口回归测试 —— 统一异常处理
 *
 * 对应试卷「五、注意事项」第 3 条：请注意操作数据库时进行必要的异常处理。
 *
 * 关注两点：
 *   1) 无论何种失败，响应体结构必须与成功时一致，页面才能统一取 message 弹提示；
 *   2) 系统异常不得把堆栈、SQL 语句、库表结构等内部细节泄漏给前端。
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { app, get, post } from './helpers/client.js';
import { cleanupTestBooks } from './helpers/db.js';

beforeAll(async () => {
  // 后续有断言依赖「总数 12 条」，先清掉可能残留的测试数据
  await cleanupTestBooks();
});

describe('统一异常处理', () => {
  describe('响应结构一致性', () => {
    it('成功响应固定为 { code, message, data }', async () => {
      const res = await get('/api/books');

      expect(Object.keys(res.body).sort()).toEqual(['code', 'data', 'message']);
      expect(res.body.code).toBe(0);
      expect(typeof res.body.message).toBe('string');
    });

    it('失败响应同样是 { code, message, data }，且 code 非 0', async () => {
      const res = await get('/api/books/99999999');

      expect(Object.keys(res.body).sort()).toEqual(['code', 'data', 'message']);
      expect(res.body.code).not.toBe(0);
      // message 可直接交给页面弹窗展示
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('校验失败时附带逐字段错误明细', async () => {
      const res = await post('/api/books', { bookCode: '', bookName: '' });

      expect(res.body.code).toBe(1001);
      expect(Array.isArray(res.body.data.errors)).toBe(true);
      res.body.data.errors.forEach((item) => {
        expect(typeof item).toBe('string');
      });
    });
  });

  describe('未匹配的接口', () => {
    it('未知的 /api 路径返回 404 与统一结构，而不是 HTML', async () => {
      const res = await get('/api/not-exists');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(1002);
      expect(res.body.message).toContain('接口不存在');
    });

    it('对不存在的接口使用未支持的方法同样返回统一结构', async () => {
      const res = await request(app).patch('/api/books');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe(1002);
    });
  });

  describe('非法请求体', () => {
    it('提交非法 JSON 时返回 400 与友好提示，而不是 500', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Content-Type', 'application/json')
        .send('{"bookCode": "TEST_BAD_JSON",,}');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.message).toBe('请求数据格式不正确');
    });

    it('空请求体按「什么都没填」处理，返回逐项必填提示', async () => {
      const res = await request(app)
        .post('/api/books')
        .set('Content-Type', 'application/json')
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(1001);
      expect(res.body.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe('不泄漏内部细节', () => {
    it('错误信息中不含堆栈痕迹', async () => {
      const responses = await Promise.all([
        get('/api/books/99999999'),
        get('/api/books/abc'),
        post('/api/books', { bookCode: '' }),
        get('/api/not-exists'),
      ]);

      responses.forEach((res) => {
        expect(res.body.message).not.toContain('at ');
        expect(res.body.message).not.toContain('Error:');
        expect(res.body.message).not.toContain('.js:');
      });
    });

    it('错误信息中不含 SQL 语句或库表结构细节', async () => {
      const res = await post('/api/books', {
        bookCode: 'X'.repeat(200),
        bookName: 'Y'.repeat(300),
        bookType: 1,
        borrowed: 0,
        creationTime: '2024-01-01 00:00:00',
      });

      expect(res.status).toBe(400);
      expect(res.body.message).not.toContain('INSERT');
      expect(res.body.message).not.toContain('SELECT');
      expect(res.body.message).not.toContain('book_info');
      expect(res.body.message).not.toContain('mysql');
    });

    it('不暴露服务端技术栈标识', async () => {
      const res = await request(app).get('/api/books');

      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('异常不影响后续请求', () => {
    it('连续触发多种异常后，正常请求依然可用', async () => {
      await get('/api/books/99999999');
      await get('/api/books/abc');
      await post('/api/books', { bookCode: '' });
      await get('/api/not-exists');

      const res = await get('/api/books');

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.total).toBe(12);
    });
  });
});