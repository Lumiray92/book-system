/**
 * 图书信息实体 —— 对应数据库表 book_info
 *
 * 【与试卷的两处出入及处理方式】
 * 1) 必填项范围
 *    试卷正文列出的必填项为「图书编号、图书名称、图书类型、是否借阅、入库人、入库时间」，
 *    而数据库设计中 bookAuthor / publishPress / publishDate 均标注「非空」。
 *    图-4 的星号标记与正文一致（作者、出版社无星号）。
 *    处理：表单校验按正文与原型图，仅校验上述 6 项；
 *          作者、出版社未填时以空串入库，兼顾表结构的「非空」约束。
 * 2) 出版日期（publishDate）
 *    该字段在表结构中「非空」，但图-1 ~ 图-9 的任何一个页面都没有出现。
 *    处理：不在页面暴露，新增时由服务端默认取「入库时间」当天，保证非空约束成立。
 */

/** 是否借阅：1 已借阅 / 0 未借阅 */
export const BORROWED = Object.freeze({
  YES: 1,
  NO: 0,
});

/** 是否借阅的中文显示 */
export const BORROWED_TEXT = Object.freeze({
  [BORROWED.YES]: '已借阅',
  [BORROWED.NO]: '未借阅',
});

/**
 * 入库人默认值。
 * 试卷明确说明本次不实现登录功能，当前登录人固定为「系统管理员」。
 */
export const DEFAULT_CREATED_BY = '系统管理员';

/** 字段长度上限，与建表语句保持一致 */
export const FIELD_LIMITS = Object.freeze({
  bookCode: 50,
  bookName: 100,
  bookAuthor: 50,
  publishPress: 100,
  createdBy: 50,
});

/**
 * 把任意日期值格式化为「年-月-日」
 * @param {string|Date|null|undefined} value
 * @returns {string} 形如 2014-03-12；非法值返回空串
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // mysql2 配置了 dateStrings，日期以 'YYYY-MM-DD HH:mm:ss' 形式返回
  const matched = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return matched ? matched[1] : '';
}

export class BookInfo {
  constructor({
    bookId = null,
    bookCode = '',
    bookName = '',
    bookType = null,
    bookAuthor = '',
    publishPress = '',
    publishDate = null,
    borrowed = BORROWED.NO,
    createdBy = '',
    creationTime = null,
    lastUpdatetime = null,
    typeName = '',
  } = {}) {
    this.bookId = bookId;
    this.bookCode = bookCode;
    this.bookName = bookName;
    this.bookType = bookType;
    this.bookAuthor = bookAuthor;
    this.publishPress = publishPress;
    this.publishDate = publishDate;
    this.borrowed = borrowed;
    this.createdBy = createdBy;
    this.creationTime = creationTime;
    this.lastUpdatetime = lastUpdatetime;
    /** 关联 book_type 查出的类型名称，非 book_info 表字段 */
    this.typeName = typeName;
  }

  /**
   * 由数据库行构造实体
   * @param {object} row 数据库行（可含 JOIN 出的 typeName）
   * @returns {BookInfo}
   */
  static fromRow(row) {
    if (!row) return null;
    return new BookInfo({
      bookId: row.bookId,
      bookCode: row.bookCode,
      bookName: row.bookName,
      bookType: row.bookType,
      bookAuthor: row.bookAuthor,
      publishPress: row.publishPress,
      publishDate: row.publishDate,
      borrowed: row.borrowed,
      createdBy: row.createdBy,
      creationTime: row.creationTime,
      lastUpdatetime: row.lastUpdatetime,
      typeName: row.typeName ?? '',
    });
  }

  /**
   * 列表行视图（图-1 / 图-2 的列）
   * 日期按「年-月-日」输出
   */
  toListVO() {
    return {
      bookId: this.bookId,
      bookCode: this.bookCode,
      bookName: this.bookName,
      bookType: this.bookType,
      typeName: this.typeName,
      bookAuthor: this.bookAuthor,
      publishPress: this.publishPress,
      creationTime: formatDate(this.creationTime),
      borrowed: this.borrowed,
      borrowedText: BORROWED_TEXT[this.borrowed] ?? '',
    };
  }

  /**
   * 详情视图（图-3 的字段，全部只读）
   */
  toDetailVO() {
    return {
      bookId: this.bookId,
      bookCode: this.bookCode,
      bookName: this.bookName,
      bookType: this.bookType,
      typeName: this.typeName,
      bookAuthor: this.bookAuthor,
      publishPress: this.publishPress,
      borrowed: this.borrowed,
      borrowedText: BORROWED_TEXT[this.borrowed] ?? '',
      createdBy: this.createdBy,
      creationTime: formatDate(this.creationTime),
    };
  }

  /**
   * 编辑视图（图-6 需要回填表单，日期用 yyyy-MM-dd 以适配日期控件）
   */
  toEditVO() {
    return {
      bookId: this.bookId,
      bookCode: this.bookCode,
      bookName: this.bookName,
      bookType: this.bookType,
      typeName: this.typeName,
      bookAuthor: this.bookAuthor,
      publishPress: this.publishPress,
      borrowed: this.borrowed,
      createdBy: this.createdBy,
      creationTime: formatDate(this.creationTime),
    };
  }
}

export default BookInfo;