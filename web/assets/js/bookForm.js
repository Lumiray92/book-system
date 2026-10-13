/**
 * 图书表单共用逻辑（图-4 新增 / 图-6 修改）
 *
 * 两个页面字段与校验规则完全一致，差别只在：
 *   · 新增：入库人、入库时间可编辑，默认「系统管理员」与当前日期
 *   · 修改：入库人、入库时间只读；提交后刷新最新更新时间
 * 因此把共用部分收在这里，由 add.js / edit.js 传入 mode 区分。
 */
(function ($, Util, api) {
    'use strict';

    /**
     * 用 book_type 表的数据渲染图书类型下拉框
     * 试卷明确要求类型数据必须来源于图书类型表，不得在页面写死
     * @param {number|null} selectedId 需要选中的类型 ID
     */
    function loadBookTypes(selectedId) {
        var $select = $('#bookType');

        api.listBookTypes().done(function (res) {
            if (res.code !== 0) {
                Util.alertMessage('图书类型加载失败：' + res.message);
                return;
            }

            // 保留「——请选择——」占位项
            $select.find('option:not(:first)').remove();

            $.each(res.data, function (index, item) {
                $select.append(
                    $('<option>')
                        .attr('value', item.value)
                        .text(item.label)
                );
            });

            if (selectedId !== null && selectedId !== undefined && selectedId !== '') {
                $select.val(String(selectedId));
            }
        });
    }

    /**
     * 读取表单值
     * @returns {object} 提交给后端的字段
     */
    function collectForm() {
        return {
            bookCode: $.trim($('#bookCode').val() || ''),
            bookName: $.trim($('#bookName').val() || ''),
            bookType: $.trim($('#bookType').val() || ''),
            bookAuthor: $.trim($('#bookAuthor').val() || ''),
            publishPress: $.trim($('#publishPress').val() || ''),
            borrowed: $.trim($('#borrowed').val() || ''),
            createdBy: $.trim($('#createdBy').val() || ''),
            creationTime: $.trim($('#creationTime').val() || '')
        };
    }

    /**
     * 必填项校验
     *
     * 必填范围与试卷正文、图-4 的星号标记一致：
     * 图书编号、图书名称、图书类型、是否借阅、入库人、入库时间。
     * 作者、出版社在原型图中无星号，故不作必填要求。
     *
     * @param {object}  values       表单值
     * @param {boolean} checkBorrowedTime 是否校验入库人/入库时间（新增页才校验）
     * @returns {string[]} 错误信息列表
     */
    function validate(values, checkBorrowedTime) {
        var errors = [];

        if (!values.bookCode) {
            errors.push('图书编号不能为空');
        } else if (values.bookCode.length > 50) {
            errors.push('图书编号长度不能超过 50 个字符');
        }

        if (!values.bookName) {
            errors.push('图书名称不能为空');
        } else if (values.bookName.length > 100) {
            errors.push('图书名称长度不能超过 100 个字符');
        }

        if (!values.bookType) {
            errors.push('图书类型不能为空');
        }

        // borrowed 允许取 0，必须按空串判断，不能用真值判断
        if (values.borrowed === '') {
            errors.push('是否借阅不能为空');
        }

        if (checkBorrowedTime) {
            if (!values.createdBy) {
                errors.push('入库人不能为空');
            }
            if (!values.creationTime) {
                errors.push('入库时间不能为空');
            }
        }

        return errors;
    }

    /** 当前页面查询上下文，用于返回列表时还原 */
    var context = { bookName: '', page: '' };

    /** 页面模式：add | edit */
    var mode = 'add';

    /** 修改模式下当前图书 ID */
    var bookId = '';

    /**
     * 跳转回列表页
     */
    function backToList() {
        Util.goToList({
            bookName: context.bookName,
            page: parseInt(context.page, 10) || 1
        });
    }

    /**
     * 提交表单
     * @param {object} values 表单值
     */
    function submit(values) {
        // 校验失败：给出提示并停在当前页，不提交
        var errors = validate(values, mode === 'add');
        if (errors.length > 0) {
            Util.alertMessage(errors[0]);
            return;
        }

        var isAdd = mode === 'add';
        var successText = isAdd ? '新增成功！' : '修改成功！';
        var failText = isAdd ? '新增失败！' : '修改失败！';

        var request = isAdd
            ? api.createBook(values)
            : api.updateBook(bookId, values);

        request.done(function (res) {
            if (res.code === 0) {
                // 图-5 / 图-7：成功提示后跳转回图书信息列表页面
                Util.alertMessage(res.message || successText);
                backToList();
            } else {
                // 失败时把具体原因一并展示，便于定位
                Util.alertMessage(failText + '\n' + (res.message || ''));
            }
        });
    }

    window.BookForm = {
        /**
         * 初始化页面
         * @param {{mode: string}} options 页面配置
         */
        init: function (options) {
            mode = options.mode;
            context = Util.currentListContext();

            if (mode === 'edit') {
                bookId = Util.getQueryParam('id');
                if (!bookId) {
                    Util.alertMessage('缺少图书 ID 参数，无法修改');
                    backToList();
                    return;
                }
            }

            // 绑定事件
            $('#submitBtn').on('click', function () {
                submit(collectForm());
            });

            $('#backBtn').on('click', backToList);

            // 文本框回车等同点击保存/修改
            $('#bookForm input[type="text"]').on('keydown', function (event) {
                if (event.keyCode === 13) {
                    submit(collectForm());
                    return false;
                }
                return true;
            });

            if (mode === 'add') {
                // 图-4 默认值：入库人「系统管理员」、入库时间当前日期、是否借阅「未借阅」
                $('#createdBy').val('系统管理员');
                $('#creationTime').val(todayString());
                $('#borrowed').val('0');

                // 类型下拉框数据来自 book_type 表
                loadBookTypes(null);
                return;
            }

            // 修改模式：先取回原数据回填，再装载类型下拉框
            api.getBookForEdit(bookId).done(function (res) {
                if (res.code !== 0) {
                    Util.alertMessage('加载图书信息失败：' + res.message);
                    backToList();
                    return;
                }

                var data = res.data;
                $('#bookCode').val(data.bookCode);
                $('#bookName').val(data.bookName);
                $('#bookAuthor').val(data.bookAuthor);
                $('#publishPress').val(data.publishPress);
                $('#borrowed').val(String(data.borrowed));
                $('#createdBy').val(data.createdBy);
                $('#creationTime').val(data.creationTime);

                loadBookTypes(data.bookType);
            });
        }
    };

    /**
     * 取当天日期，格式 yyyy-MM-dd，用于日期控件默认值
     * @returns {string}
     */
    function todayString() {
        var now = new Date();
        var month = now.getMonth() + 1;
        var day = now.getDate();

        return now.getFullYear() +
            '-' + (month < 10 ? '0' : '') + month +
            '-' + (day < 10 ? '0' : '') + day;
    }
})(jQuery, window.AppUtil, window.api);