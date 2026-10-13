/**
 * 控制器层 —— 图书类型
 *
 * 只提供一个查询动作，供新增页 / 修改页渲染类型下拉框。
 */
import { bookTypeService } from '../services/BookTypeService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

/**
 * 创建图书类型控制器
 * @param {{bookTypeService?: object}} [deps] 依赖注入
 * @returns {object} 请求处理器
 */
export function createBookTypeController(deps = {}) {
  const service = deps.bookTypeService ?? bookTypeService;

  return {
    /**
     * 图书类型下拉数据
     * GET /api/book-types
     */
    list: asyncHandler(async (req, res) => {
      const data = await service.listOptions();
      return sendSuccess(res, data, '查询成功');
    }),
  };
}

export default createBookTypeController;