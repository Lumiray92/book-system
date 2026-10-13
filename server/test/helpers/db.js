/**
 * 数据库直查助手
 *
 * 接口返回正确不代表数据真写进去了，因此写操作类用例
 * 会再直接查一次库来确认持久化结果。
 */
import { query, queryOne } from '../../src/config/db.js';

/**
 * 按主键查图书原始行（未经视图层加工）
 * @param {number} bookId 图书 ID
 * @returns {Promise<object|null>}
 */
export function findBookRow(bookId) {
  return queryOne('SELECT * FROM book_info WHERE bookId = ?', [bookId]);
}

/**
 * 按图书编号查图书原始行
 * @param {string} bookCode 图书编号
 * @returns {Promise<object|null>}
 */
export function findBookRowByCode(bookCode) {
  return queryOne('SELECT * FROM book_info WHERE bookCode = ?', [bookCode]);
}

/**
 * 统计图书总数
 * @returns {Promise<number>}
 */
export async function countBooks() {
  const row = await queryOne('SELECT COUNT(*) AS total FROM book_info');
  return row.total;
}

/**
 * 直接插入一条图书（绕过接口），用于构造排序、分页等前置数据
 * @param {object} data 字段值
 * @returns {Promise<number>} 新记录主键
 */
export async function insertBookRow(data) {
  const result = await query(
    `INSERT INTO book_info
       (bookCode, bookName, bookType, bookAuthor, publishPress, publishDate,
        borrowed, createdBy, creationTime, lastUpdatetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      data.bookCode,
      data.bookName,
      data.bookType,
      data.bookAuthor ?? '',
      data.publishPress ?? '',
      data.publishDate ?? '2024-01-01',
      data.borrowed ?? 0,
      data.createdBy ?? '系统管理员',
      data.creationTime ?? '2024-01-01 00:00:00',
    ]
  );
  return result.insertId;
}

/**
 * 删除指定图书（清理测试数据用，忽略不存在的情况）
 * @param {number} bookId 图书 ID
 */
export async function deleteBookRow(bookId) {
  await query('DELETE FROM book_info WHERE bookId = ?', [bookId]);
}

/**
 * 清空所有测试用图书（图书编号以 TEST 开头）。
 *
 * 用例若在中途失败可能留下残数据，导致后续文件的分页/总数断言失准，
 * 因此各测试文件开始时先调用一次，保证从示例数据出发。
 *
 * @returns {Promise<number>} 清理掉的条数
 */
export async function cleanupTestBooks() {
  const result = await query("DELETE FROM book_info WHERE bookCode LIKE 'TEST%'");
  return result.affectedRows;
}