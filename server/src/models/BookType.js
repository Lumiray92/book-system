/**
 * 图书类型实体 —— 对应数据库表 book_type
 *
 * 试卷要求：新增/修改页面的「图书类型」下拉框数据必须来源于 book_type 表，
 * 不允许在页面写死，因此该实体只用于把类型表的数据喂给下拉框。
 */

/** 类型名称长度上限，与建表语句一致 */
export const TYPE_NAME_LIMIT = 50;

export class BookType {
  constructor({ id = null, typeName = '' } = {}) {
    this.id = id;
    this.typeName = typeName;
  }

  /**
   * 由数据库行构造实体
   * @param {object} row 数据库行
   * @returns {BookType}
   */
  static fromRow(row) {
    if (!row) return null;
    return new BookType({ id: row.id, typeName: row.typeName });
  }

  /**
   * 下拉框视图：前端用 value / label 渲染 option
   */
  toOptionVO() {
    return { value: this.id, label: this.typeName };
  }
}

export default BookType;