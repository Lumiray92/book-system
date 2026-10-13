/**
 * 控制器层 —— 图书信息
 *
 * 对应试卷「四、具体要求」第 8 条：
 * 创建并配置控制器类，在类中加入 Service 的引用，
 * 对结果和消息进行保存并导航到指定页面完成显示。
 *
 * 因此每个动作除了返回数据，还必须返回一句可直接展示的提示信息
 * （新增成功！/ 修改成功！/ 删除成功！），供页面弹出。
 */
import { bookInfoService } from '../services/BookInfoService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

/**
 * 创建图书控制器
 * @param {{bookInfoService?: object}} [deps] 依赖注入，缺省使用默认 Service 实例
 * @returns {object} 各动作的请求处理器
 */
export function createBookController(deps = {}) {
  const service = deps.bookInfoService ?? bookInfoService;

  return {
    /**
     * 图书列表（图-1 / 图-2）
     * GET /api/books?bookName=&page=1&pageSize=5
     */
    list: asyncHandler(async (req, res) => {
      const { bookName, page, pageSize } = req.query;
      const data = await service.listBooks({ bookName, page, pageSize });
      return sendSuccess(res, data, '查询成功');
    }),

    /**
     * 图书详情（图-3）
     * GET /api/books/:id
     */
    detail: asyncHandler(async (req, res) => {
      const data = await service.getBookDetail(req.params.id);
      return sendSuccess(res, data, '查询成功');
    }),

    /**
     * 图书编辑数据回填（图-6）
     * GET /api/books/:id/edit
     */
    edit: asyncHandler(async (req, res) => {
      const data = await service.getBookForEdit(req.params.id);
      return sendSuccess(res, data, '查询成功');
    }),

    /**
     * 新增图书（图-4 / 图-5）
     * POST /api/books
     */
    create: asyncHandler(async (req, res) => {
      const data = await service.createBook(req.body ?? {});
      return sendSuccess(res, data, '新增成功！');
    }),

    /**
     * 修改图书（图-6 / 图-7）
     * PUT /api/books/:id
     */
    update: asyncHandler(async (req, res) => {
      const data = await service.updateBook(req.params.id, req.body ?? {});
      return sendSuccess(res, data, '修改成功！');
    }),

    /**
     * 删除图书（图-8 / 图-9）
     * DELETE /api/books/:id
     */
    remove: asyncHandler(async (req, res) => {
      const data = await service.removeBook(req.params.id);
      return sendSuccess(res, data, '删除成功！');
    }),
  };
}

export default createBookController;