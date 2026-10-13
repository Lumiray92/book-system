# 图书借阅系统（后台管理）

基于 **Express + MySQL** 的图书借阅系统后台管理模块。

- **功能规格**：来自《2016年10月学士后Java毕业考试机试试卷-2.pdf》（含图-1 ~ 图-9 页面原型、book_info / book_type 表结构）
- **技术栈**：按 `quiz07.md` 要求，由原卷的 Java 栈改为 **Node.js / Express + MySQL** 实现

> 原卷要求 Java（Struts2 / SpringMVC + Spring + Hibernate / MyBatis、Tomcat），
> `quiz07.md` 明确指定「前后端：Express、数据库：MySQL」。
> 本项目保留原卷**全部业务规则、表结构、页面原型与分层架构要求**，用 Express 重新实现。

### 关于开发工具

`quiz07.md` 第 1 条要求「使用 Qwen code 开发」。**本项目的实际开发工具是 Claude Code，
不是 Qwen Code**，此处据实说明，未作替换或美化。

其余要求（Express + MySQL 技术栈、Git 版本管理、GitHub 托管并初始化前后端 Issue、
完成任务提交 PR 并在合并后删除分支、使用 Actions 进行回归测试）均已按原文落实，
逐条落实情况见 [`docs/需求对照表.md`](docs/需求对照表.md)。

---

## 交付文档

| 文档 | 内容 |
|---|---|
| [`docs/需求对照表.md`](docs/需求对照表.md) | 逐条对照试卷「四、具体要求」15 条与「五、注意事项」，并说明有意偏离之处 |
| [`docs/验收记录.md`](docs/验收记录.md) | 回归测试、CI、浏览器端到端验收的实际结果与数据 |
| [`docs/design/页面设计说明.md`](docs/design/页面设计说明.md) | 各页面的布局、字段、交互与提示语设计 |
| [`docs/screenshots/`](docs/screenshots/) | 12 张实际页面截图，按试卷图号命名 |

---

## 一、功能一览

| # | 功能 | 说明 |
|---|---|---|
| 1 | 图书列表 | 默认按入库时间降序，每页 5 条，列表隔行变色，日期显示为 `年-月-日` |
| 2 | 图书查询 | 按图书名称模糊查询，结果同样按入库时间降序；查询条件可记忆、可回带 |
| 3 | 查看详情 | 全部字段只读；提供「返回」按钮，返回列表后保留查询条件与结果 |
| 4 | 新增图书 | 必填项 jQuery 校验；入库时间默认当前时间、入库人默认「系统管理员」、是否借阅默认「未借阅」；成功/失败均有提示 |
| 5 | 修改图书 | 必填项校验；「入库人」「入库时间」只读不可改；成功/失败均有提示 |
| 6 | 删除图书 | 删除前 `confirm` 二次确认；删除后回列表并提示成功/失败 |

---

## 二、技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Node.js ≥ 18 |
| Web 框架 | Express 5 |
| 数据库 | MySQL 8（`mysql2` 连接池） |
| 前端 | HTML + CSS + jQuery 1.8.3（贴合原卷，无构建步骤） |
| 测试 | Vitest + Supertest（接口回归测试） |
| CI | GitHub Actions |
| 版本管理 | Git + GitHub（Issue → PR → 合并后删除分支） |

---

## 三、目录结构

```
book-system/
├─ .github/
│  ├─ workflows/ci.yml          # Actions 回归测试（后端接口 + 前端静态资源）
│  └─ ISSUE_TEMPLATE/           # 前端 / 后端 Issue 模板
├─ sql/                         # 试卷要求提交的数据库对象导出脚本
│  ├─ 01_schema.sql             # 建表 + 主键自增
│  └─ 02_seed.sql               # 测试数据（每表 ≥ 5 条）
├─ server/                      # 后端：Express 应用
│  ├─ src/
│  │  ├─ app.js                 # 应用装配
│  │  ├─ server.js              # 启动入口
│  │  ├─ config/                # 数据库连接池、环境变量、声明式事务
│  │  ├─ models/                # 实体（BookInfo / BookType）
│  │  ├─ dao/                   # 数据访问层
│  │  ├─ services/              # 业务层（事务边界）
│  │  ├─ controllers/           # 控制器
│  │  ├─ routes/                # 路由
│  │  └─ middleware/            # 请求日志、统一异常处理
│  ├─ scripts/
│  │  ├─ init-db.js             # 执行 sql/ 下的建表与测试数据脚本
│  │  └─ e2e-pages.js           # 页面端到端验收（真实 Chrome）
│  ├─ test/                     # 接口回归测试（Vitest + Supertest）
│  └─ vitest.config.js
├─ web/                         # 前端：页面
│  ├─ index.html                # 列表页（图-1 / 图-2）
│  ├─ detail.html               # 查看页（图-3）
│  ├─ add.html                  # 新增页（图-4）
│  ├─ edit.html                 # 修改页（图-6）
│  └─ assets/{css,js}
├─ scripts/check-web-assets.mjs # 前端静态资源检查
├─ docs/                        # 需求对照表、验收记录、页面设计说明、截图
└─ package.json                 # npm workspaces
```

---

## 四、环境准备

### 1. 数据库

本项目使用 MySQL 8.4.9 免安装版，位于 `D:\APP\MySQL`。

```bat
D:\APP\MySQL\start-mysql.bat   :: 启动（监听 127.0.0.1:3306）
D:\APP\MySQL\stop-mysql.bat    :: 停止
```

### 2. 环境变量

复制 `server/.env.example` 为 `server/.env` 并按实际填写：

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root123456
DB_NAME=book_db
PORT=3000
```

> `.env` 已在 `.gitignore` 中排除，不会提交到仓库。

### 3. 初始化数据库

```bash
npm run db:init     # 执行 sql/01_schema.sql + sql/02_seed.sql
```

---

## 五、快速开始

```bash
npm install         # 安装依赖（npm workspaces）
npm run db:init     # 建表 + 灌入测试数据
npm run dev         # 启动开发服务器
```

浏览器访问 <http://localhost:3000> 进入图书借阅系统后台管理首页。

---

## 六、接口一览

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/api/books` | 图书列表（`bookName` 模糊查询、`page` / `pageSize` 分页） |
| GET | `/api/books/:id` | 查看图书详情 |
| POST | `/api/books` | 新增图书 |
| PUT | `/api/books/:id` | 修改图书 |
| DELETE | `/api/books/:id` | 删除图书 |
| GET | `/api/book-types` | 图书类型列表（下拉框数据源） |

统一响应格式：

```json
{ "code": 0, "message": "操作成功", "data": {} }
```

失败时 `code` 非 0，`message` 为失败原因。

---

## 七、测试

```bash
npm test            # 接口回归测试（Vitest + Supertest），113 条
npm run test:web    # 前端静态资源检查，28 项
npm run test:e2e    # 页面端到端验收（需本机 Chrome + 服务已启动），58 条
```

接口回归测试覆盖增删改查、分页、模糊查询、校验分支、
只读字段防篡改与事务回滚。测试跑在**独立库 `book_db_test`** 上，
每次运行由 `globalSetup` 直接执行 `sql/*.sql` 重建，
因此结果可重复，且**不会污染开发库** `book_db`。

`npm test` 与 `npm run test:web` 在 CI 中执行；
`npm run test:e2e` 需要真实浏览器，故只在本地运行。

实际运行结果见 [`docs/验收记录.md`](docs/验收记录.md)。

---

## 八、开发说明

- 本仓库的 Issue / PR / Actions 流程见 `.github/`。
- 分支策略：`main` 为基线，功能分支 `feat/*` 开发，PR 合并后删除分支。
- 已按 `quiz07.md` 初始化前后端两个 Issue，并各自通过 PR 合并落地。

### 分层与事务

按试卷第 5 ~ 9 条划分 DAO / Service / Controller 三层，依赖由工厂函数注入：

```
routes → controller → service → dao → mysql2 连接池
```

试卷第 9 条要求「为业务对象添加声明式事务支持，以代码方式实现事务不得分」。
Spring 的 `@Transactional` 依赖 AOP 容器，Express 无对应机制，
因此以 `withTransaction(fn)`（`server/src/config/db.js`）提供等价能力：
**事务边界统一收口在该包装器内，业务代码中不出现 `begin` / `commit` / `rollback`**。
回归测试 `test/transaction.test.js` 会在源码层面守住这条约束。