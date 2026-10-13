/**
 * 数据访问层 —— book_type 表
 *
 * 试卷要求「具体类型数据必须来源于图书类型表 book_type」，
 * 页面的类型下拉框一律通过本 DAO 取数，严禁在页面或控制器中写死。
 */
import { query, queryOne } from '../config/db.js';
import { BookType } from '../models/BookType.js';

/**
 * 创建 book_type 数据访问对象
 * @returns {object} DAO 实例
 */
export function createBookTypeDao() {
  return {
    /**
     * 查询全部图书类型，按主键升序（与试卷列出的顺序一致：
     * 小说、文学、传记、艺术、少儿、经济、管理、科技）
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<BookType[]>}
     */
    async findAll(conn) {
      const rows = await query('SELECT id, typeName FROM book_type ORDER BY id ASC', [], conn);
      return rows.map((row) => BookType.fromRow(row));
    },

    /**
     * 按主键查询类型，用于校验表单提交的类型是否存在
     * @param {number} id 类型 ID
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<BookType|null>}
     */
    async findById(id, conn) {
      const row = await queryOne('SELECT id, typeName FROM book_type WHERE id = ?', [id], conn);
      return BookType.fromRow(row);
    },
  };
}

export default createBookTypeDao;