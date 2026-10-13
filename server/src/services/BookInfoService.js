/**
 * 业务层 —— 图书信息
 *
 * 对应试卷「四、具体要求」第 7、9 条：
 *   - Service 实现相应业务，并在类中加入 DAO 引用；
 *   - 为业务对象添加声明式事务支持。
 *
 * 本模块通过 createBookInfoService({ bookInfoDao, bookTypeDao }) 注入 DAO 依赖；
 * 写操作统一包在 withTransaction 中，业务代码内不出现 begin/commit/rollback。
 */
import { withTransaction } from '../config/db.js';
import { createBookInfoDao } from '../dao/BookInfoDao.js';
import { createBookTypeDao } from '../dao/BookTypeDao.js';
import {
  BORROWED,
  BookInfo,
  DEFAULT_CREATED_BY,
  FIELD_LIMITS,
} from '../models/BookInfo.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js';
import { paginate } from '../utils/response.js';
import {
  collectIntegerInRange,
  collectMaxLength,
  collectRequired,
  normalizeDateTime,
  nowDateTimeString,
  toIntegerOrNull,
  toTrimmedString,
} from '../utils/validate.js';

/** 试卷要求：列表每页显示五条数据 */
export const DEFAULT_PAGE_SIZE = 5;

/** 每页条数上限，防止被要求一次拉全表 */
const MAX_PAGE_SIZE = 100;

/**
 * 校验并规范化表单提交的图书数据
 *
 * 必填项按试卷正文与图-4 的星号标记：
 * 图书编号、图书名称、图书类型、是否借阅、入库人、入库时间。
 * 作者、出版社在原型图中无星号，故不作必填要求。
 *
 * @param {object} input 表单原始数据
 * @param {{forUpdate: boolean, bookTypeDao: object}} options 校验上下文
 * @returns {Promise<{values: object, errors: string[]}>}
 */
async function validateBookInput(input, { forUpdate, bookTypeDao }) {
  const errors = [];
  const values = {};

  // ---------- 文本字段 ----------
  values.bookCode = toTrimmedString(input.bookCode);
  values.bookName = toTrimmedString(input.bookName);
  values.bookAuthor = toTrimmedString(input.bookAuthor);
  values.publishPress = toTrimmedString(input.publishPress);

  if (collectRequired(values.bookCode, '图书编号', errors)) {
    collectMaxLength(values.bookCode, '图书编号', FIELD_LIMITS.bookCode, errors);
  }
  if (collectRequired(values.bookName, '图书名称', errors)) {
    collectMaxLength(values.bookName, '图书名称', FIELD_LIMITS.bookName, errors);
  }
  collectMaxLength(values.bookAuthor, '作者', FIELD_LIMITS.bookAuthor, errors);
  collectMaxLength(values.publishPress, '出版社', FIELD_LIMITS.publishPress, errors);

  // ---------- 图书类型：必须存在于 book_type 表 ----------
  values.bookType = toIntegerOrNull(input.bookType);
  if (collectRequired(input.bookType, '图书类型', errors)) {
    if (values.bookType === null || values.bookType < 1) {
      errors.push('图书类型不合法');
    } else {
      const type = await bookTypeDao.findById(values.bookType);
      if (!type) {
        errors.push('图书类型不存在，请从图书类型列表中选择');
      }
    }
  }

  // ---------- 是否借阅：1 已借阅 / 0 未借阅 ----------
  // 注意 borrowed 允许取 0，不能用真值判断
  values.borrowed = toIntegerOrNull(input.borrowed);
  if (collectRequired(input.borrowed, '是否借阅', errors)) {
    collectIntegerInRange(values.borrowed, '是否借阅', { min: 0, max: 1 }, errors);
  }

  // ---------- 入库人、入库时间 ----------
  if (forUpdate) {
    // 试卷要求：修改时「入库人」「入库时间」只读不可改。
    // 此处直接忽略提交值，真实取值在 updateBook 中沿用库中原值。
  } else {
    // 入库人默认当前登录用户；本次不实现登录，固定为「系统管理员」
    values.createdBy = toTrimmedString(input.createdBy) || DEFAULT_CREATED_BY;
    collectMaxLength(values.createdBy, '入库人', FIELD_LIMITS.createdBy, errors);

    // 入库时间默认为当前时间
    const rawCreationTime = toTrimmedString(input.creationTime);
    if (rawCreationTime === '') {
      values.creationTime = nowDateTimeString();
    } else {
      values.creationTime = normalizeDateTime(rawCreationTime);
      if (values.creationTime === null) {
        errors.push('入库时间格式不正确');
      }
    }
  }

  return { values, errors };
}

/**
 * 创建图书信息业务对象
 * @param {{bookInfoDao?: object, bookTypeDao?: object}} [deps] 依赖注入
 * @returns {object} Service 实例
 */
export function createBookInfoService(deps = {}) {
  const bookInfoDao = deps.bookInfoDao ?? createBookInfoDao();
  const bookTypeDao = deps.bookTypeDao ?? createBookTypeDao();

  return {
    /** 供外部（如测试）访问已注入的 DAO 引用 */
    bookInfoDao,
    bookTypeDao,

    /**
     * 分页查询图书列表
     * 默认按入库时间降序，页码越界时回落到最后一页
     * （删除最后一页最后一条后返回列表会触发该场景）
     *
     * @param {{bookName?: string, page?: number|string, pageSize?: number|string}} [query]
     * @returns {Promise<object>} 分页对象
     */
    async listBooks({ bookName = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
      const keyword = toTrimmedString(bookName);

      const requestedSize = toIntegerOrNull(pageSize) ?? DEFAULT_PAGE_SIZE;
      const safePageSize = Math.min(Math.max(requestedSize, 1), MAX_PAGE_SIZE);

      const requestedPage = toIntegerOrNull(page) ?? 1;
      const safePage = Math.max(requestedPage, 1);

      const total = await bookInfoDao.count({ bookName: keyword });
      const totalPages = total > 0 ? Math.ceil(total / safePageSize) : 0;

      // 页码越界时回落到最后一页
      const effectivePage = totalPages > 0 ? Math.min(safePage, totalPages) : 1;
      const offset = (effectivePage - 1) * safePageSize;

      const rows = await bookInfoDao.findPage({
        bookName: keyword,
        limit: safePageSize,
        offset,
      });

      return paginate({
        rows: rows.map((book) => book.toListVO()),
        total,
        page: effectivePage,
        pageSize: safePageSize,
      });
    },

    /**
     * 查询图书详情（图-3 全部字段只读）
     * @param {number|string} bookId 图书 ID
     * @returns {Promise<object>} 详情视图
     */
    async getBookDetail(bookId) {
      const id = toIntegerOrNull(bookId);
      if (id === null) {
        throw new ValidationError('图书 ID 不合法');
      }

      const book = await bookInfoDao.findById(id);
      if (!book) {
        throw new NotFoundError('图书不存在或已被删除');
      }
      return book.toDetailVO();
    },

    /**
     * 查询图书编辑数据（图-6 回填表单）
     * @param {number|string} bookId 图书 ID
     * @returns {Promise<object>} 编辑视图
     */
    async getBookForEdit(bookId) {
      const id = toIntegerOrNull(bookId);
      if (id === null) {
        throw new ValidationError('图书 ID 不合法');
      }

      const book = await bookInfoDao.findById(id);
      if (!book) {
        throw new NotFoundError('图书不存在或已被删除');
      }
      return book.toEditVO();
    },

    /**
     * 新增图书
     * @param {object} input 表单数据
     * @returns {Promise<{bookId: number}>} 新记录主键
     */
    async createBook(input = {}) {
      const { values, errors } = await validateBookInput(input, {
        forUpdate: false,
        bookTypeDao,
      });
      if (errors.length > 0) {
        throw new ValidationError(errors[0], errors);
      }

      return withTransaction(async (conn) => {
        // 图书编号唯一性校验放在事务内，避免并发下重复插入
        const duplicated = await bookInfoDao.findByCode(values.bookCode, conn);
        if (duplicated) {
          throw new ConflictError(`图书编号「${values.bookCode}」已存在，请更换`);
        }

        const book = new BookInfo({
          ...values,
          // publishDate 未在页面暴露，按入库时间当天补齐，满足表结构非空约束
          publishDate: values.creationTime.slice(0, 10),
        });

        const bookId = await bookInfoDao.insert(book, conn);
        return { bookId };
      });
    },

    /**
     * 修改图书
     * 入库人、入库时间沿用数据库原值，不接受页面提交的新值
     *
     * @param {number|string} bookId 图书 ID
     * @param {object} input 表单数据
     * @returns {Promise<{bookId: number}>}
     */
    async updateBook(bookId, input = {}) {
      const id = toIntegerOrNull(bookId);
      if (id === null) {
        throw new ValidationError('图书 ID 不合法');
      }

      const { values, errors } = await validateBookInput(input, {
        forUpdate: true,
        bookTypeDao,
      });
      if (errors.length > 0) {
        throw new ValidationError(errors[0], errors);
      }

      return withTransaction(async (conn) => {
        const existing = await bookInfoDao.findById(id, conn);
        if (!existing) {
          throw new NotFoundError('图书不存在或已被删除');
        }

        // 编号唯一性校验需排除自身
        const duplicated = await bookInfoDao.findByCode(values.bookCode, conn);
        if (duplicated && duplicated.bookId !== id) {
          throw new ConflictError(`图书编号「${values.bookCode}」已被其它图书占用`);
        }

        const book = new BookInfo({
          bookId: id,
          ...values,
          // 只读字段沿用库中原值
          publishDate: existing.publishDate,
          createdBy: existing.createdBy,
          creationTime: existing.creationTime,
          // 刷新最新更新时间
          lastUpdatetime: nowDateTimeString(),
        });

        await bookInfoDao.update(book, conn);
        return { bookId: id };
      });
    },

    /**
     * 删除图书
     * @param {number|string} bookId 图书 ID
     * @returns {Promise<{bookId: number}>}
     */
    async removeBook(bookId) {
      const id = toIntegerOrNull(bookId);
      if (id === null) {
        throw new ValidationError('图书 ID 不合法');
      }

      return withTransaction(async (conn) => {
        const existing = await bookInfoDao.findById(id, conn);
        if (!existing) {
          throw new NotFoundError('图书不存在或已被删除');
        }

        await bookInfoDao.remove(id, conn);
        return { bookId: id };
      });
    },

    /**
     * 借阅状态常量透出，供上层复用
     */
    BORROWED,
  };
}

/** 默认实例：控制器可直接使用；测试可自行构造带桩 DAO 的实例 */
export const bookInfoService = createBookInfoService();

export default createBookInfoService;