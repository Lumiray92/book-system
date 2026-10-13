/**
 * 后端接口封装
 *
 * 统一把响应处理成 { code, message, data } 结构后交给页面：
 * 无论 HTTP 状态是 200 还是 4xx，页面都只需判断 code 是否为 0，
 * 失败时直接使用 message 作为提示语（对应图-5 / 图-7 / 图-9 的弹窗）。
 */
(function (window, $) {
    'use strict';

    var BASE_URL = '/api';

    /**
     * 发起请求，并把「业务失败」也归一到 resolve，简化页面判断
     * @param {string} method HTTP 方法
     * @param {string} url    相对 BASE_URL 的路径
     * @param {object} [data] 请求数据或查询参数
     * @returns {object} jQuery Promise，resolve 值为统一响应体
     */
    function request(method, url, data) {
        var deferred = $.Deferred();

        var options = {
            url: BASE_URL + url,
            type: method,
            dataType: 'json'
        };

        if (method === 'GET') {
            // GET 用查询串传递
            options.data = data;
        } else {
            options.contentType = 'application/json; charset=UTF-8';
            options.data = data ? JSON.stringify(data) : JSON.stringify({});
            options.processData = false;
        }

        $.ajax(options)
            .done(function (response) {
                deferred.resolve(response);
            })
            .fail(function (jqXHR) {
                var payload = parseErrorPayload(jqXHR);

                if (payload) {
                    // 服务端返回了标准响应体（如校验失败、记录不存在）
                    deferred.resolve(payload);
                } else {
                    deferred.resolve({
                        code: -1,
                        message: '无法连接服务器，请确认服务已启动',
                        data: null
                    });
                }
            });

        return deferred.promise();
    }

    /**
     * 从失败的 jqXHR 中取出服务端返回的响应体
     *
     * 注意：jQuery 1.8.3 尚未提供 jqXHR.responseJSON（该属性自 1.9 起才有），
     * 因此必须回退到手工解析 responseText，否则所有业务失败
     * （如「图书编号已存在」）都会被误判为网络异常。
     *
     * @param {object} jqXHR jQuery 的 XMLHttpRequest 包装对象
     * @returns {object|null} 解析出的响应体，无法解析时返回 null
     */
    function parseErrorPayload(jqXHR) {
        if (jqXHR.responseJSON) {
            return jqXHR.responseJSON;
        }

        if (jqXHR.responseText) {
            try {
                return JSON.parse(jqXHR.responseText);
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    window.api = {
        /**
         * 图书列表（支持图书名称模糊查询与分页）
         * @param {{bookName?: string, page?: number, pageSize?: number}} params
         */
        listBooks: function (params) {
            return request('GET', '/books', params);
        },

        /** 图书详情（图-3） */
        getBook: function (bookId) {
            return request('GET', '/books/' + encodeURIComponent(bookId));
        },

        /** 图书编辑回填数据（图-6） */
        getBookForEdit: function (bookId) {
            return request('GET', '/books/' + encodeURIComponent(bookId) + '/edit');
        },

        /** 新增图书（图-4） */
        createBook: function (data) {
            return request('POST', '/books', data);
        },

        /** 修改图书（图-6） */
        updateBook: function (bookId, data) {
            return request('PUT', '/books/' + encodeURIComponent(bookId), data);
        },

        /** 删除图书（图-8） */
        deleteBook: function (bookId) {
            return request('DELETE', '/books/' + encodeURIComponent(bookId));
        },

        /** 图书类型下拉数据（必须来自 book_type 表） */
        listBookTypes: function () {
            return request('GET', '/book-types');
        }
    };
})(window, jQuery);