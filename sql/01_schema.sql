-- =====================================================================
--  图书借阅系统（后台管理）— 表结构脚本
--  数据库：MySQL 8.x
--  字段名称严格对应试卷「三、数据库设计」中的 book_info / book_type
--  执行顺序：先执行本脚本，再执行 02_seed.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS book_db
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;

USE book_db;

-- 先删子表再删父表，保证脚本可重复执行
DROP TABLE IF EXISTS book_info;
DROP TABLE IF EXISTS book_type;

-- ---------------------------------------------------------------------
-- 表 1：book_type  图书类型表
--   类型数据为下拉框的唯一来源（试卷要求「具体类型数据必须来源于图书类型表」）
-- ---------------------------------------------------------------------
CREATE TABLE book_type (
    id       INT          NOT NULL AUTO_INCREMENT COMMENT 'id（主键，自动增长）',
    typeName VARCHAR(50)  NOT NULL                COMMENT '图书类型名称',
    PRIMARY KEY (id),
    UNIQUE KEY uk_book_type_name (typeName)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci
  COMMENT = '图书类型表';

-- ---------------------------------------------------------------------
-- 表 2：book_info  图书信息表
--   1) 主键 bookId 自动增长
--   2) 试卷中 bookAuthor 标注为「整数」，但示例数据为「金庸 / Martin Fowler」
--      等作者姓名，故按字符串存储
--   3) bookType 存储 book_type.id，列表/详情展示时关联出类型名称
-- ---------------------------------------------------------------------
CREATE TABLE book_info (
    bookId         INT          NOT NULL AUTO_INCREMENT COMMENT '图书 ID（主键，自动增长）',
    bookCode       VARCHAR(50)  NOT NULL                COMMENT '图书编号',
    bookName       VARCHAR(100) NOT NULL                COMMENT '图书名称',
    bookType       INT          NOT NULL                COMMENT '图书类型（外键 → book_type.id）',
    bookAuthor     VARCHAR(50)  NOT NULL                COMMENT '图书作者',
    publishPress   VARCHAR(100) NOT NULL                COMMENT '出版社',
    publishDate    DATE         NOT NULL                COMMENT '出版日期',
    borrowed       TINYINT      NOT NULL DEFAULT 0      COMMENT '是否借阅（1、已借阅 0、未借阅）',
    createdBy      VARCHAR(50)  NOT NULL                COMMENT '入库人',
    creationTime   DATETIME     NOT NULL                COMMENT '入库时间',
    lastUpdatetime DATETIME     NULL DEFAULT NULL       COMMENT '最新更新时间',
    PRIMARY KEY (bookId),
    UNIQUE KEY uk_book_info_code (bookCode),
    KEY idx_book_info_creation_time (creationTime),
    KEY idx_book_info_name (bookName),
    CONSTRAINT fk_book_info_type
        FOREIGN KEY (bookType) REFERENCES book_type (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci
  COMMENT = '图书信息表';