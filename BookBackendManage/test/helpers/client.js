/**
 * 接口测试客户端
 *
 * 统一封装成 { status, body } 结构，便于同时断言 HTTP 状态码与响应体。
 */
import request from 'supertest';

import { createApp } from '../../src/app.js';

/** 被测应用实例（nock 真实 Express 应用，连接测试库） */
export const app = createApp();

/**
 * 发起请求并解包结果
 * @param {'get'|'post'|'put'|'delete'} method HTTP 方法
 * @param {string} url 请求路径
 * @param {{query?: object, body?: object}} [options] 查询参数或请求体
 * @returns {Promise<{status: number, body: object, text: string}>}
 */
export async function call(method, url, options = {}) {
  let req = request(app)[method](url);

  if (options.query) {
    req = req.query(options.query);
  }
  if (options.body !== undefined) {
    req = req.send(options.body);
  }

  const res = await req;
  return { status: res.status, body: res.body, text: res.text };
}

export const get = (url, query) => call('get', url, { query });
export const post = (url, body) => call('post', url, { body });
export const put = (url, body) => call('put', url, { body });
export const del = (url) => call('delete', url);

/**
 * 新增一本用于测试的图书，返回其主键
 * @param {object} [overrides] 覆盖默认字段
 * @returns {Promise<number>} bookId
 */
export async function createTestBook(overrides = {}) {
  const payload = {
    bookCode: `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`,
    bookName: '测试图书',
    bookType: 1,
    bookAuthor: '测试作者',
    publishPress: '测试出版社',
    borrowed: 0,
    createdBy: '系统管理员',
    creationTime: '2024-01-01 09:00:00',
    ...overrides,
  };

  const res = await post('/api/books', payload);
  if (res.body.code !== 0) {
    throw new Error(`新增测试图书失败：${JSON.stringify(res.body)}`);
  }
  return res.body.data.bookId;
}