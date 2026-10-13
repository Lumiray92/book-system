/**
 * 业务层 —— 图书类型
 *
 * 试卷要求新增/修改页面的类型下拉框「数据必须来源于图书类型表 book_type」，
 * 该业务只做一件事：把类型表的数据原样提供给页面。
 */
import { createBookTypeDao } from '../dao/BookTypeDao.js';

/**
 * 创建图书类型业务对象
 * @param {{bookTypeDao?: object}} [deps] 依赖注入
 * @returns {object} Service 实例
 */
export function createBookTypeService(deps = {}) {
  const bookTypeDao = deps.bookTypeDao ?? createBookTypeDao();

  return {
    /** 已注入的 DAO 引用 */
    bookTypeDao,

    /**
     * 查询全部图书类型，供下拉框渲染
     * @returns {Promise<Array<{value: number, label: string}>>}
     */
    async listOptions() {
      const types = await bookTypeDao.findAll();
      return types.map((type) => type.toOptionVO());
    },
  };
}

/** 默认实例 */
export const bookTypeService = createBookTypeService();

export default createBookTypeService;