/**
 * 统一响应体
 *
 * 试卷要求「无论操作成功或失败都要给出提示信息」，页面据此弹出
 * 新增成功！/ 新增失败！ 等提示，因此所有接口必须返回同一种结构：
 *   { code, message, data }
 * code 为 0 表示成功，非 0 表示失败，message 直接用于页面提示。
 */
import { ERROR_CODE } from '../errors/AppError.js';

/**
 * 返回成功响应
 * @param {import('express').Response} res     响应对象
 * @param {*}      [data]    业务数据
 * @param {string} [message] 提示信息
 * @returns {import('express').Response}
 */
export function sendSuccess(res, data = null, message = '操作成功') {
  return res.status(200).json({
    code: ERROR_CODE.SUCCESS,
    message,
    data,
  });
}

/**
 * 返回失败响应
 * @param {import('express').Response} res       响应对象
 * @param {number} code      业务状态码
 * @param {string} message   提示信息
 * @param {number} [httpStatus] HTTP 状态码
 * @returns {import('express').Response}
 */
export function sendError(res, code, message, httpStatus = 400) {
  return res.status(httpStatus).json({
    code,
    message,
    data: null,
  });
}

/**
 * 分页结果包装
 * @param {{rows: Array, total: number, page: number, pageSize: number}} payload
 * @returns {object} 含页码信息与列表数据的分页对象
 */
export function paginate({ rows, total, page, pageSize }) {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    list: rows,
    total,
    page,
    pageSize,
    totalPages,
  };
}