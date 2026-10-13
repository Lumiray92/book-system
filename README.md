# 图书借阅系统（后台管理）

基于 **Express + MySQL** 的图书借阅系统后台管理模块。

- **功能规格**：来自《2016年10月学士后Java毕业考试机试试卷-2.pdf》（含图-1 ~ 图-9 页面原型、book_info / book_type 表结构）
- **技术栈**：按 `quiz07.md` 要求，由原卷的 Java 栈改为 **Node.js / Express + MySQL** 实现

> 原卷要求 Java（Struts2 / SpringMVC + Spring + Hibernate / MyBatis、Tomcat），
> `quiz07.md` 明确指定「前后端：Express、数据库：MySQL」。
> 本项目保留原卷**全部业务规则、表结构、页面原型与分层架构要求**，用 Express 重新实现。

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
│  ├─ workflows/ci.yml          # Actions 回归测试
│  └─ ISSUE_TEMPLATE/           # 前端 / 后端 Issue 模板
├─ sql/
│  ├─ 01_schema.sql             # 建表 + 主键自增
│  └─ 02_seed.sql               # 测试数据（每表 ≥ 5 条）
├─ server/                      # 后端：Express 应用
│  ├─ src/
│  │  ├─ app.js                 # 应用装配
│  │  ├─ server.js              # 启动入口
│  │  ├─ config/                # 数据库连接池、环境变量
│  │  ├─ models/                # 实体（BookInfo / BookType）
│  │  ├─ dao/                   # 数据访问层
│  │  ├─ services/              # 业务层（事务边界）
│  │  ├─ controllers/           # 控制器
│  │  ├─ routes/                # 路由
│  │  └─ middleware/            # 参数校验、统一异常处理
│  └─ test/                     # 回归测试
├─ web/                         # 前端：页面
│  ├─ index.html                # 列表页（图-1 / 图-2）
│  ├─ detail.html               # 查看页（图-3）
│  ├─ add.html                  # 新增页（图-4）
│  ├─ edit.html                 # 修改页（图-6）
│  └─ assets/{css,js,img}
├─ docs/design/                 # 页面设计说明
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
npm test            # 运行接口回归测试
```

---

## 八、开发说明

- 本仓库的 Issue / PR / Actions 流程见 `.github/`。
- 分支策略：`main` 为基线，功能分支 `feat/*` 开发，PR 合并后删除分支。