/**
 * 列表页逻辑（图-1 / 图-2）
 *
 * 负责：默认展示全部入库图书并按入库时间降序、按图书名称模糊查询、
 *       分页显示（每页 5 条）、跳转到查看/修改/新增页、删除图书。
 *
 * 查询条件与页码存放在 URL 查询串中，保证从查看/新增/修改页返回时
 * 「保留查询条件和查询结果」。
 */
(function ($, Util, api) {
    'use strict';

    /** 每页显示条数（试卷要求 5 条） */
    var PAGE_SIZE = 5;

    /** 分页条上最多显示的页码个数（对齐图-1 的 1..9） */
    var PAGE_WINDOW = 9;

    /** 当前查询条件 */
    var state = {
        bookName: '',
        page: 1
    };

    /**
     * 渲染图书列表
     * @param {Array} list 列表数据
     */
    function renderTable(list) {
        var $tbody = $('#bookTableBody').empty();

        if (!list || list.length === 0) {
            $tbody.append(
                $('<tr class="empty-row">').append(
                    $('<td colspan="8">').text('未查询到符合条件的图书信息')
                )
            );
            return;
        }

        $.each(list, function (index, book) {
            // 查看 / 修改 链接一并携带当前查询条件，便于返回时还原列表
            var context =
                '?id=' + encodeURIComponent(book.bookId) +
                '&bookName=' + encodeURIComponent(state.bookName) +
                '&page=' + encodeURIComponent(state.page);

            var $row = $('<tr>');

            $row.append($('<td>').text(book.bookCode));
            $row.append($('<td>').text(book.typeName));
            $row.append($('<td>').text(book.bookName));
            $row.append($('<td>').text(book.bookAuthor));
            $row.append($('<td>').text(book.publishPress));
            // 入库时间已由服务端格式化为「年-月-日」
            $row.append($('<td>').text(book.creationTime));
            $row.append($('<td>').text(book.borrowedText));

            var $ops = $('<td class="ops">');
            $ops.append($('<a>').attr('href', 'detail.html' + context).text('查看'));
            $ops.append($('<a>').attr('href', 'edit.html' + context).text('修改'));
            $ops.append(
                $('<a href="javascript:void(0);">')
                    .attr('data-id', book.bookId)
                    .attr('data-name', book.bookName)
                    .addClass('delete-link')
                    .text('删除')
            );
            $row.append($ops);

            $tbody.append($row);
        });
    }

    /**
     * 渲染分页条（图-1）
     * 结构：上一页 ◀ 1 2 3 ... ▶ 下一页 共N页 到第 [ ] 页 [确定]
     *
     * @param {number} page       当前页
     * @param {number} totalPages 总页数
     * @param {number} total      总记录数
     */
    function renderPagination(page, totalPages, total) {
        var $pager = $('#pagination').empty();

        if (totalPages <= 0) {
            return;
        }

        /** 生成指向指定页码的链接 */
        function pageLink(text, targetPage, extraClass) {
            return $('<a>')
                .attr('href', Util.buildListUrl({ bookName: state.bookName, page: targetPage }))
                .addClass(extraClass || '')
                .text(text);
        }

        // 上一页
        if (page > 1) {
            $pager.append(pageLink('上一页', page - 1));
        } else {
            $pager.append($('<span class="disabled">').text('上一页'));
        }

        // 左箭头
        if (page > 1) {
            $pager.append(pageLink('◀', page - 1, 'arrow'));
        } else {
            $pager.append($('<span class="disabled arrow">').text('◀'));
        }

        // 页码窗口：最多 9 个，尽量让当前页居中
        var start = Math.max(1, page - Math.floor(PAGE_WINDOW / 2));
        var end = Math.min(totalPages, start + PAGE_WINDOW - 1);
        start = Math.max(1, end - PAGE_WINDOW + 1);

        for (var i = start; i <= end; i++) {
            if (i === page) {
                $pager.append($('<span class="page-no current">').text(i));
            } else {
                $pager.append(pageLink(String(i), i, 'page-no'));
            }
        }

        // 右箭头
        if (page < totalPages) {
            $pager.append(pageLink('▶', page + 1, 'arrow'));
        } else {
            $pager.append($('<span class="disabled arrow">').text('▶'));
        }

        // 下一页
        if (page < totalPages) {
            $pager.append(pageLink('下一页', page + 1));
        } else {
            $pager.append($('<span class="disabled">').text('下一页'));
        }

        // 共 N 页 / 到第 N 页
        $pager.append($('<span>').text('共' + totalPages + '页'));

        var $jump = $('<span class="page-jump">').text('到第');
        $jump.append(
            $('<input type="text">')
                .attr('id', 'pageJumpInput')
                .attr('maxlength', '6')
        );
        $jump.append(document.createTextNode('页'));
        $jump.append($('<button type="button" class="btn" id="pageJumpBtn">').text('确定'));
        $pager.append($jump);

        // 总记录数一并展示，便于确认分页是否正确
        $pager.append($('<span class="page-jump">').text('（共 ' + total + ' 条记录）'));
    }

    /**
     * 按当前查询条件加载列表
     */
    function loadBooks() {
        $('#bookTableBody').html(
            $('<tr class="empty-row">').append($('<td colspan="8">').text('正在加载 ...'))
        );

        api.listBooks({
            bookName: state.bookName,
            page: state.page,
            pageSize: PAGE_SIZE
        }).done(function (res) {
            if (res.code !== 0) {
                $('#bookTableBody').html(
                    $('<tr class="empty-row">').append(
                        $('<td colspan="8">').text(res.message || '加载失败')
                    )
                );
                $('#pagination').empty();
                return;
            }

            var data = res.data;
            // 页码越界时服务端会回落到最后一页，这里同步回来
            state.page = data.page;

            renderTable(data.list);
            renderPagination(data.page, data.totalPages, data.total);
        });
    }

    /**
     * 执行查询：更新地址栏（保留条件）后重新加载
     * @param {number} [page] 目标页码，缺省回到第 1 页
     */
    function doSearch(page) {
        var keyword = $.trim($('#bookNameInput').val() || '');

        // 条件写进地址栏，刷新或返回时输入框与结果都能原样还原
        window.location.href = Util.buildListUrl({ bookName: keyword, page: page || 1 });
    }

    // ---------- 事件绑定 ----------

    function bindEvents() {
        // 查询（图-2）
        $('#searchBtn').on('click', function () {
            doSearch(1);
        });

        // 输入框内回车等同点击查询
        $('#bookNameInput').on('keydown', function (event) {
            if (event.keyCode === 13) {
                doSearch(1);
                return false;
            }
            return true;
        });

        // 新增（图-4）
        $('#addBtn').on('click', function () {
            window.location.href =
                'add.html?bookName=' + encodeURIComponent(state.bookName) +
                '&page=' + encodeURIComponent(state.page);
        });

        // 删除（图-8 / 图-9）
        $(document).on('click', '.delete-link', function () {
            var bookId = $(this).attr('data-id');
            var bookName = $(this).attr('data-name');

            // 图-8：删除前弹出确认提示
            if (!window.confirm('确定删除该图书信息？')) {
                return;
            }

            api.deleteBook(bookId).done(function (res) {
                var message = res.code === 0 ? '删除成功！' : ('删除失败！\n' + res.message);

                // 图-9：返回列表页并提示删除结果
                window.location.href = Util.buildListUrl({
                    bookName: state.bookName,
                    page: state.page,
                    message: message
                });
            });
        });

        // 到第 N 页
        $(document).on('click', '#pageJumpBtn', function () {
            jumpToTypedPage();
        });

        $(document).on('keydown', '#pageJumpInput', function (event) {
            if (event.keyCode === 13) {
                jumpToTypedPage();
                return false;
            }
            return true;
        });
    }

    /**
     * 读取「到第 N 页」输入框并跳转
     */
    function jumpToTypedPage() {
        var raw = $.trim($('#pageJumpInput').val() || '');
        var target = parseInt(raw, 10);

        if (isNaN(target) || target < 1) {
            window.alert('请输入正确的页码');
            return;
        }

        window.location.href = Util.buildListUrl({ bookName: state.bookName, page: target });
    }

    // ---------- 页面初始化 ----------

    $(function () {
        // 查询条件与页码完全以地址栏为准：
        //   · 直接打开首页（无参数）→ 显示全部图书（试卷第 1 条要求）
        //   · 带参数（查询、翻页、从其它页返回）→ 还原查询条件与结果
        state.bookName = Util.getQueryParam('bookName');
        state.page = parseInt(Util.getQueryParam('page'), 10) || 1;

        $('#bookNameInput').val(state.bookName);

        bindEvents();
        loadBooks();

        // 图-9：删除操作后带回来的提示语
        var message = Util.getQueryParam('message');
        if (message) {
            Util.alertMessage(message);
        }
    });
})(jQuery, window.AppUtil, window.api);