---
name: 后端任务
about: 图书借阅系统后台管理 — Express 接口开发
title: '[后端] '
labels: backend
---

## 需求来源

试卷《图书借阅系统（后台）》「二、功能要求」「三、数据库设计」「四、具体要求」。

## 任务清单

- [ ] **持久化层**
  - [ ] `BookInfo` / `BookType` 实体
  - [ ] `book_info` / `book_type` 的 SQL 映射
- [ ] **DAO 层**：数据访问接口及实现，完成所需数据库操作
- [ ] **Service 层**：业务接口及实现，持有 DAO 引用，声明式事务支持
- [ ] **Controller 层**：持有 Service 引用，保存结果与消息并导航到指定页面
- [ ] **接口**
  - [ ] `GET /api/books` — 列表：`bookName` 模糊查询、分页 5 条/页、`creationTime` 降序
  - [ ] `GET /api/books/:id` — 详情
  - [ ] `POST /api/books` — 新增：入库时间取当前时间、入库人默认「系统管理员」、借阅默认 0
  - [ ] `PUT /api/books/:id` — 修改：忽略入库人与入库时间，刷新 `lastUpdatetime`
  - [ ] `DELETE /api/books/:id` — 删除
  - [ ] `GET /api/book-types` — 类型下拉数据源
- [ ] **工程要求**
  - [ ] 统一响应体 `{ code, message, data }`
  - [ ] 统一异常处理中间件，数据库异常不外泄
  - [ ] 参数校验（必填项、类型、长度）
  - [ ] 事务边界声明式收口在 Service 层

## 验收标准

逐条对照试卷「四、具体要求及推荐实现步骤」第 5 ~ 9 条，接口回归测试全部通过。