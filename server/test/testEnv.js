/**
 * 测试环境常量
 *
 * 测试单独使用 book_db_test 库，与开发库 book_db 完全隔离，
 * 因此回归测试可以自由地增删改数据，不会污染开发数据。
 *
 * 该常量被 vitest.config.js、globalSetup.js 与各测试文件共用，
 * 避免库名在多处硬编码后失配。
 */

/** 测试库名 */
export const TEST_DB_NAME = 'book_db_test';