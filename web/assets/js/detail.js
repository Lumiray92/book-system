/**
 * 查看图书信息页逻辑（图-3）
 *
 * 页面所有字段只读，仅提供「返回」按钮。
 * 返回时把查询条件与页码一并带回列表页，满足试卷
 * 「列表页需保留查询条件和查询结果」的要求。
 */
(function ($, Util, api) {
    'use strict';

    /** 列表页上下文，用于返回时还原查询状态 */
    var context = { bookName: '', page: '' };

    /**
     * 把详情数据填充到只读表单
     * @param {object} data 详情数据
     */
    function fillForm(data) {
        $('#bookCode').val(data.bookCode);
        $('#bookName').val(data.bookName);
        // 图书类型展示类型名称，而非类型 ID
        $('#typeName').val(data.typeName);
        $('#bookAuthor').val(data.bookAuthor);
        $('#publishPress').val(data.publishPress);
        $('#borrowed').val(String(data.borrowed));
        $('#createdBy').val(data.createdBy);
        // 日期控件需要 yyyy-MM-dd 格式
        $('#creationTime').val(data.creationTime);
    }

    /**
     * 展示错误信息
     * @param {string} message 错误内容
     */
    function showError(message) {
        $('#errorTip').html($('<div class="error-tip">').text(message));
    }

    $(function () {
        context = Util.currentListContext();

        var bookId = Util.getQueryParam('id');
        if (!bookId) {
            showError('缺少图书 ID 参数，无法查看详情');
            return;
        }

        api.getBook(bookId).done(function (res) {
            if (res.code !== 0) {
                showError(res.message || '查询失败');
                return;
            }
            fillForm(res.data);
        }).fail(function () {
            showError('查询失败，请稍后重试');
        });

        // 返回列表页，保留查询条件与页码
        $('#backBtn').on('click', function () {
            Util.goToList({
                bookName: context.bookName,
                page: parseInt(context.page, 10) || 1
            });
        });
    });
})(jQuery, window.AppUtil, window.api);