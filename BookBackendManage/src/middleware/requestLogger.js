/**
 * 简易请求日志中间件
 * 开发与调试阶段记录「方法 路径 状态码 耗时」，便于联调时定位问题。
 */

/**
 * 创建请求日志中间件
 * @param {{enabled?: boolean}} [options] 配置
 * @returns {import('express').RequestHandler}
 */
export function createRequestLogger(options = {}) {
  const enabled = options.enabled ?? true;

  return (req, res, next) => {
    if (!enabled) return next();

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      // 查询串一并打印，方便确认分页与查询条件是否按预期传递
      const query = req.originalUrl.includes('?')
        ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
        : '';

      console.log(
        `${req.method} ${req.path}${query} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`,
      );
    });

    return next();
  };
}

export default createRequestLogger;