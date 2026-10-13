/**
 * 异步路由处理器包装
 *
 * 把 async 处理器中抛出的异常统一交给 Express 错误中间件，
 * 避免每个控制器都写一遍 try/catch。
 *
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<*>} handler
 * @returns {import('express').RequestHandler}
 */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export default asyncHandler;