/**
 * 公共工具
 *
 * 核心是试卷的一条硬性要求：
 *   「点击返回按钮时，返回到图书信息列表页面，注意：列表页需保留查询条件和查询结果。」
 * 实现方式：把查询条件与页码放进 URL 查询串，在各页面之间透传。
 *
 * 这样处理还有一个好处——刷新列表页时条件不会丢，
 * 输入框展示的始终是「当前生效的查询条件」，即试卷所说的「记忆查询的条件」；
 * 而直接打开首页（不带任何参数）则一定是「显示全部图书」。
 */
(function (window, $) {
    'use strict';

    window.AppUtil = {
        /**
         * 读取当前页面的查询参数
         * @param {string} name 参数名
         * @returns {string} 参数值，不存在时返回空串
         */
        getQueryParam: function (name) {
            var matched = window.location.search.match(
                new RegExp('[?&]' + name + '=([^&#]*)')
            );
            return matched ? decodeURIComponent(matched[1].replace(/\+/g, ' ')) : '';
        },

        /**
         * 构造列表页 URL，携带查询条件与页码
         * @param {{bookName?: string, page?: number, message?: string}} [params]
         * @returns {string} 形如 index.html?bookName=天龙&page=2
         */
        buildListUrl: function (params) {
            params = params || {};

            var pairs = [];
            if (params.bookName) {
                pairs.push('bookName=' + encodeURIComponent(params.bookName));
            }
            if (params.page && Number(params.page) > 1) {
                pairs.push('page=' + encodeURIComponent(params.page));
            }
            if (params.message) {
                pairs.push('message=' + encodeURIComponent(params.message));
            }

            return 'index.html' + (pairs.length > 0 ? '?' + pairs.join('&') : '');
        },

        /**
         * 从当前页面 URL 中取出列表页需要保留的条件
         * @returns {{bookName: string, page: string}}
         */
        currentListContext: function () {
            return {
                bookName: this.getQueryParam('bookName'),
                page: this.getQueryParam('page')
            };
        },

        /**
         * 提示信息（对应图-5 / 图-7 / 图-8 / 图-9 的弹窗）
         * @param {string} message 提示内容
         */
        alertMessage: function (message) {
            window.alert(message);
        },

        /**
         * 转义 HTML，避免图书名称等用户输入破坏页面结构
         * @param {*} value 原始值
         * @returns {string} 转义后的文本
         */
        escapeHtml: function (value) {
            if (value === null || value === undefined) {
                return '';
            }
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        /**
         * 跳转回列表页
         * @param {{bookName?: string, page?: number, message?: string}} [params]
         */
        goToList: function (params) {
            window.location.href = this.buildListUrl(params);
        }
    };
})(window, jQuery);