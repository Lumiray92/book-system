/**
 * 数据访问层 —— book_info 表
 *
 * 对应试卷「四、具体要求」第 6 条：创建数据访问层 DAO 接口及其实现类，
 * 在实现类中完成所需数据库操作。
 *
 * 本模块导出 createBookInfoDao()，即该 DAO 的实现；
 * 其返回对象的方法签名构成上层依赖的「接口」。
 * 所有方法支持传入事务连接 conn，以便 Service 层把多个操作纳入同一事务。
 */
import { execute, query, queryOne } from '../config/db.js';
import { BookInfo } from '../models/BookInfo.js';

/**
 * 转义 LIKE 通配符，避免用户输入的 % 和 _ 被当作模式匹配
 * @param {string} value 原始输入
 * @returns {string} 转义后的片段
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * 校验并规范化分页参数为安全整数。
 * LIMIT / OFFSET 由服务端计算，不接受用户直接传入的字符串拼接；
 * 此处强制取整，杜绝 SQL 注入。
 * @param {number} value 待校验值
 * @param {number} fallback 非法时回退值
 * @returns {number} 非负整数
 */
function toSafeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

/** book_info 全部字段（含关联出的类型名称） */
const BASE_COLUMNS = `
    bi.bookId, bi.bookCode, bi.bookName, bi.bookType, bi.bookAuthor,
    bi.publishPress, bi.publishDate, bi.borrowed, bi.createdBy,
    bi.creationTime, bi.lastUpdatetime, bt.typeName
`;

/**
 * 创建 book_info 数据访问对象
 * @returns {object} DAO 实例
 */
export function createBookInfoDao() {
  return {
    /**
     * 分页查询图书列表
     * 排序：入库时间降序（试卷硬性要求），并以 bookId 兜底保证顺序稳定
     *
     * @param {{bookName?: string, limit: number, offset: number}} params 查询条件
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<BookInfo[]>}
     */
    async findPage({ bookName = '', limit, offset }, conn) {
      const safeLimit = toSafeInt(limit, 5);
      const safeOffset = toSafeInt(offset, 0);

      const conditions = [];
      const params = [];

      if (bookName) {
        conditions.push('bi.bookName LIKE ?');
        params.push(`%${escapeLike(bookName)}%`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const sql = `
        SELECT ${BASE_COLUMNS}
        FROM book_info bi
                 JOIN book_type bt ON bt.id = bi.bookType
        ${where}
        ORDER BY bi.creationTime DESC, bi.bookId DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
      `;

      const rows = await query(sql, params, conn);
      return rows.map((row) => BookInfo.fromRow(row));
    },

    /**
     * 统计符合条件的记录数，用于计算总页数
     * @param {{bookName?: string}} params 查询条件
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<number>}
     */
    async count({ bookName = '' } = {}, conn) {
      const conditions = [];
      const params = [];

      if (bookName) {
        conditions.push('bi.bookName LIKE ?');
        params.push(`%${escapeLike(bookName)}%`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const row = await queryOne(
        `SELECT COUNT(*) AS total FROM book_info bi ${where}`,
        params,
        conn,
      );
      return Number(row?.total ?? 0);
    },

    /**
     * 按主键查询单条图书
     * @param {number} bookId 图书 ID
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<BookInfo|null>}
     */
    async findById(bookId, conn) {
      const row = await queryOne(
        `SELECT ${BASE_COLUMNS}
         FROM book_info bi
                  JOIN book_type bt ON bt.id = bi.bookType
         WHERE bi.bookId = ?`,
        [bookId],
        conn,
      );
      return BookInfo.fromRow(row);
    },

    /**
     * 按图书编号查询，用于新增时的编号唯一性校验
     * @param {string} bookCode 图书编号
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<BookInfo|null>}
     */
    async findByCode(bookCode, conn) {
      const row = await queryOne(
        `SELECT ${BASE_COLUMNS}
         FROM book_info bi
                  JOIN book_type bt ON bt.id = bi.bookType
         WHERE bi.bookCode = ?`,
        [bookCode],
        conn,
      );
      return BookInfo.fromRow(row);
    },

    /**
     * 新增图书
     * @param {BookInfo} book 实体
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<number>} 新记录主键
     */
    async insert(book, conn) {
      const result = await execute(
        `INSERT INTO book_info
             (bookCode, bookName, bookType, bookAuthor, publishPress,
              publishDate, borrowed, createdBy, creationTime, lastUpdatetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          book.bookCode,
          book.bookName,
          book.bookType,
          book.bookAuthor,
          book.publishPress,
          book.publishDate,
          book.borrowed,
          book.createdBy,
          book.creationTime,
        ],
        conn,
      );
      return result.insertId;
    },

    /**
     * 修改图书
     * 注意：入库人 createdBy 与入库时间 creationTime 按试卷要求不可修改，
     *       因此不在 SET 子句中；最新更新时间 lastUpdatetime 由服务层传入。
     *
     * @param {BookInfo} book 实体
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<number>} 受影响行数
     */
    async update(book, conn) {
      const result = await execute(
        `UPDATE book_info
         SET bookCode      = ?,
             bookName      = ?,
             bookType      = ?,
             bookAuthor    = ?,
             publishPress  = ?,
             borrowed      = ?,
             lastUpdatetime = ?
         WHERE bookId = ?`,
        [
          book.bookCode,
          book.bookName,
          book.bookType,
          book.bookAuthor,
          book.publishPress,
          book.borrowed,
          book.lastUpdatetime,
          book.bookId,
        ],
        conn,
      );
      return result.affectedRows;
    },

    /**
     * 按主键删除图书
     * @param {number} bookId 图书 ID
     * @param {import('mysql2/promise').PoolConnection} [conn] 事务连接
     * @returns {Promise<number>} 受影响行数
     */
    async remove(bookId, conn) {
      const result = await execute('DELETE FROM book_info WHERE bookId = ?', [bookId], conn);
      return result.affectedRows;
    },
  };
}

export default createBookInfoDao;