/**
 * 统一业务异常定义
 *
 * 把「可预期的业务错误」（参数不合法、记录不存在、编号重复）与
 * 「不可预期的系统错误」（数据库宕机、代码缺陷）区分开：
 * 前者按既定 code/message 返回给页面，后者统一收敛为 5000，不泄漏内部细节。
 */

/** 业务状态码 */
export const ERROR_CODE = Object.freeze({
  /** 成功 */
  SUCCESS: 0,
  /** 参数校验失败 */
  VALIDATION_FAILED: 1001,
  /** 记录不存在 */
  NOT_FOUND: 1002,
  /** 业务规则冲突，如图书编号重复 */
  CONFLICT: 1003,
  /** 服务器内部错误 */
  INTERNAL: 5000,
});

/**
 * 业务异常基类
 */
export class AppError extends Error {
  /**
   * @param {string} message    给页面显示的错误信息
   * @param {object} [options]
   * @param {number} [options.code]       业务状态码
   * @param {number} [options.httpStatus] HTTP 状态码
   */
  constructor(message, { code = ERROR_CODE.INTERNAL, httpStatus = 500 } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    /** 标记为可预期异常，异常处理器据此决定是否打印堆栈 */
    this.expected = true;
  }
}

/**
 * 参数校验失败
 */
export class ValidationError extends AppError {
  /**
   * @param {string}   message 错误信息
   * @param {string[]} [details] 逐字段的错误明细
   */
  constructor(message = '参数校验失败', details = []) {
    super(message, { code: ERROR_CODE.VALIDATION_FAILED, httpStatus: 400 });
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * 记录不存在
 */
export class NotFoundError extends AppError {
  constructor(message = '记录不存在') {
    super(message, { code: ERROR_CODE.NOT_FOUND, httpStatus: 404 });
    this.name = 'NotFoundError';
  }
}

/**
 * 业务规则冲突
 */
export class ConflictError extends AppError {
  constructor(message = '数据冲突') {
    super(message, { code: ERROR_CODE.CONFLICT, httpStatus: 409 });
    this.name = 'ConflictError';
  }
}

export default AppError;