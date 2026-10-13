/**
 * 路由配置
 *
 * 把 URL 映射到控制器动作，控制器内部持有 Service 引用，
 * 形成 路由 → 控制器 → 业务层 → 数据访问层 的完整调用链。
 *
 * 注意：Express 5 使用的 path-to-regexp 已移除 :id(\\d+) 这类内联正则写法，
 * 因此路径参数统一为 :id，数值合法性由业务层校验。
 */
import { Router } from 'express';
import { createBookController } from '../controllers/bookController.js';
import { createBookTypeController } from '../controllers/bookTypeController.js';

/**
 * 创建 API 路由
 * @param {object} [deps] 依赖注入，透传给各控制器（便于测试替换）
 * @returns {import('express').Router}
 */
export function createApiRouter(deps = {}) {
  const router = Router();

  const bookController = createBookController(deps);
  const bookTypeController = createBookTypeController(deps);

  // ---------- 图书类型 ----------
  // 新增页 / 修改页的类型下拉框数据源，必须来自 book_type 表
  router.get('/book-types', bookTypeController.list);

  // ---------- 图书信息 ----------
  // 列表：支持 bookName 模糊查询与分页，默认按入库时间降序
  router.get('/books', bookController.list);

  // 编辑数据回填（图-6），需放在 /books/:id 之前声明，语义更清晰
  router.get('/books/:id/edit', bookController.edit);

  // 详情（图-3）
  router.get('/books/:id', bookController.detail);

  // 新增（图-4）
  router.post('/books', bookController.create);

  // 修改（图-6）
  router.put('/books/:id', bookController.update);

  // 删除（图-8）
  router.delete('/books/:id', bookController.remove);

  return router;
}

export default createApiRouter;