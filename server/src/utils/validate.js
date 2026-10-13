/**
 * 参数校验通用工具
 *
 * 收集式校验：每项检查把错误追加到 errors 数组，最后一次性返回全部问题，
 * 便于页面提示「某某不能为空」这类具体原因，而不是笼统的「操作失败」。
 */

/** 是否为正整数（含 0） */
export function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * 判断年月日是否为真实存在的日期（拦截 2014-02-30 这类非法值）
 * @param {number} year  年
 * @param {number} month 月（1-12）
 * @param {number} day   日
 * @returns {boolean}
 */
function isValidCalendarDate(year, month, day) {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

/**
 * 转为去空格字符串；null / undefined 返回空串
 * @param {*} value 原始值
 * @returns {string}
 */
export function toTrimmedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * 把任意值解析为整数；失败返回 null
 * @param {*} value 原始值
 * @returns {number|null}
 */
export function toIntegerOrNull(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * 校验必填
 * @param {*}        value 值
 * @param {string}   label 字段中文名
 * @param {string[]} errors 错误收集数组
 * @returns {boolean} 是否通过
 */
export function collectRequired(value, label, errors) {
  if (value === '' || value === null || value === undefined) {
    errors.push(`${label}不能为空`);
    return false;
  }
  return true;
}

/**
 * 校验字符串最大长度
 * @param {string}   value 值
 * @param {string}   label 字段中文名
 * @param {number}   max   最大长度
 * @param {string[]} errors 错误收集数组
 * @returns {boolean} 是否通过
 */
export function collectMaxLength(value, label, max, errors) {
  if (value && String(value).length > max) {
    errors.push(`${label}长度不能超过 ${max} 个字符`);
    return false;
  }
  return true;
}

/**
 * 校验整数是否落在允许区间
 * @param {number}   value 值
 * @param {string}   label 字段中文名
 * @param {{min: number, max: number}} range 允许区间（闭区间）
 * @param {string[]} errors 错误收集数组
 * @returns {boolean} 是否通过
 */
export function collectIntegerInRange(value, label, range, errors) {
  if (value === null) {
    errors.push(`${label}必须是整数`);
    return false;
  }
  if (value < range.min || value > range.max) {
    errors.push(`${label}取值必须在 ${range.min} 到 ${range.max} 之间`);
    return false;
  }
  return true;
}

/**
 * 规范化日期时间字符串为 MySQL DATETIME 可接受的 'YYYY-MM-DD HH:mm:ss'。
 *
 * 支持三种输入：
 *   - 'YYYY-MM-DD'           仅日期，补零点（页面日期控件提交的格式）
 *   - 'YYYY-MM-DD HH:mm:ss'  完整日期时间
 *   - Date 对象
 *
 * @param {*} value 原始值
 * @returns {string|null} 规范化结果；无法解析时返回 null
 */
export function normalizeDateTime(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const pad = (num) => String(num).padStart(2, '0');
    return (
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    );
  }

  const text = String(value).trim();
  if (text === '') return null;

  // 完整日期时间
  const dateTimeMatched = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (dateTimeMatched) {
    const [, year, month, day, hour, minute, second = '00'] = dateTimeMatched;
    if (!isValidCalendarDate(Number(year), Number(month), Number(day))) return null;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  // 仅日期
  const dateMatched = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatched) {
    const [, year, month, day] = dateMatched;
    if (!isValidCalendarDate(Number(year), Number(month), Number(day))) return null;
    return `${year}-${month}-${day} 00:00:00`;
  }

  return null;
}

/**
 * 生成当前时间的 'YYYY-MM-DD HH:mm:ss' 字符串（本地时区）
 * @returns {string}
 */
export function nowDateTimeString() {
  return normalizeDateTime(new Date());
}