/**
 * 统一异常处理中间件
 *
 * 试卷要求「请注意操作数据库时进行必要的异常处理」，
 * 这里把异常分为两类分别处理：
 *   1) 可预期的业务异常（AppError 子类）：按既定 code/message 返回，页面直接展示；
 *   2) 不可预期的系统异常：记录堆栈，对外只返回通用提示，避免泄漏库表结构等内部细节。
 */
import { AppError, ERROR_CODE } from '../errors/AppError.js';
import { sendError } from '../utils/response.js';

/** 常见 MySQL 错误码 → 业务异常的映射 */
const MYSQL_ERROR_MAP = {
  ER_DUP_ENTRY: {
    code: ERROR_CODE.CONFLICT,
    httpStatus: 409,
    message: '数据已存在，请勿重复提交',
  },
  ER_NO_REFERENCED_ROW_2: {
    code: ERROR_CODE.VALIDATION_FAILED,
    httpStatus: 400,
    message: '关联的数据不存在',
  },
  ER_ROW_IS_REFERENCED_2: {
    code: ERROR_CODE.CONFLICT,
    httpStatus: 409,
    message: '该数据被其它记录引用，无法删除',
  },
  ER_DATA_TOO_LONG: {
    code: ERROR_CODE.VALIDATION_FAILED,
    httpStatus: 400,
    message: '输入内容过长',
  },
  ER_BAD_NULL_ERROR: {
    code: ERROR_CODE.VALIDATION_FAILED,
    httpStatus: 400,
    message: '存在必填字段为空',
  },
  ER_TRUNCATED_WRONG_VALUE: {
    code: ERROR_CODE.VALIDATION_FAILED,
    httpStatus: 400,
    message: '字段类型或日期格式不正确',
  },
};

/**
 * 未匹配到任何路由时返回统一结构，避免返回 HTML 导致前端解析失败
 * @type {import('express').RequestHandler}
 */
export function notFoundHandler(req, res) {
  return sendError(res, ERROR_CODE.NOT_FOUND, `接口不存在：${req.method} ${req.originalUrl}`, 404);
}

/**
 * 错误处理中间件（Express 依据 4 个入参识别为错误处理器，必须保留 next）
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // 响应已发出时交回 Express 默认处理，避免重复写响应头
  if (res.headersSent) {
    return next(err);
  }

  // 1) 业务异常
  if (err instanceof AppError) {
    return sendError(res, err.code, err.message, err.httpStatus);
  }

  // 2) 请求体 JSON 解析失败（客户端提交了非法 JSON）
  if (err instanceof SyntaxError && 'body' in err) {
    return sendError(res, ERROR_CODE.VALIDATION_FAILED, '请求数据格式不正确', 400);
  }

  // 3) 数据库异常
  if (err && typeof err.code === 'string' && MYSQL_ERROR_MAP[err.code]) {
    const mapped = MYSQL_ERROR_MAP[err.code];
    console.error(`[数据库异常] ${err.code}: ${err.message}`);
    return sendError(res, mapped.code, mapped.message, mapped.httpStatus);
  }

  // 4) 其余按系统异常处理：记录完整堆栈，对外仅给通用提示
  console.error('[系统异常]', err);
  return sendError(res, ERROR_CODE.INTERNAL, '系统繁忙，请稍后重试', 500);
}

export default errorHandler;