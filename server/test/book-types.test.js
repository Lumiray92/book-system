/**
 * 接口回归测试 —— 图书类型下拉数据源
 *
 * 对应试卷要求：新增/修改页面的「图书类型」下拉框，
 * 具体类型数据必须来源于图书类型表，不得在页面写死。
 */
import { describe, expect, it } from 'vitest';

import { get } from './helpers/client.js';

describe('GET /api/book-types 图书类型下拉数据源', () => {
  it('返回 book_type 表全部类型，按 id 升序，且为 value/label 结构', async () => {
    const res = await get('/api/book-types');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toEqual([
      { value: 1, label: '小说' },
      { value: 2, label: '文学' },
      { value: 3, label: '传记' },
      { value: 4, label: '艺术' },
      { value: 5, label: '少儿' },
      { value: 6, label: '经济' },
      { value: 7, label: '管理' },
      { value: 8, label: '科技' },
    ]);
  });

  it('类型数据为 8 条，满足试卷「每表至少 5 条测试数据」的要求', async () => {
    const res = await get('/api/book-types');
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });
});