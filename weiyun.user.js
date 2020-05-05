// ==UserScript==
// @name         WeiyunHelper
// @namespace    https://pigfly.im/
// @version      0.0.2
// @description  微云下载时文件支持导出到 aria2 下载
// @author       Luke
// @match        https://www.weiyun.com/*
// @grant        none
// @updateURL    https://cdn.jsdelivr.net/gh/loo2k/WeiyunHelper@master/weiyun.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/loo2k/WeiyunHelper@master/weiyun.user.js
// @supportURL   https://github.com/loo2k/WeiyunHelper/issues
// ==/UserScript==

(function () {
  'use strict';

  Date.prototype.Format = function (fmt) {
    var o = {
      'M+': this.getMonth() + 1,
      'd+': this.getDate(),
      'h+': this.getHours(),
      'm+': this.getMinutes(),
      's+': this.getSeconds(),
      'q+': Math.floor((this.getMonth() + 3) / 3),
      S: this.getMilliseconds(),
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    for (var k in o)
      if (new RegExp('(' + k + ')').test(fmt))
        fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
    return fmt;
  };

  const addGlobalStyle = (css) => {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) {
      return;
    }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
  };

  const wyNotify = (options) => {
    options = {
      timeout: 5000,
      ...options,
    };

    // 判断是否已经创建 wrapper
    let wyNotifyWrapper = document.getElementById('wyNotify');
    if (!wyNotifyWrapper) {
      wyNotifyWrapper = document.createElement('div');
      wyNotifyWrapper.setAttribute('id', 'wyNotify');
      wyNotifyWrapper.setAttribute('class', 'wy-notify__wrap');
      document.body.appendChild(wyNotifyWrapper);
    }

    let wyNotifyEl = document.createElement('div');
    let wyNotifyContent = `
    <div class="wy-notify__content">
    <div class="wy-notify__title">${options.title}</div>
    <div class="wy-notify__desc">${options.description}</div>
    </div>`;

    wyNotifyEl.setAttribute('class', 'wy-notify');
    wyNotifyEl.innerHTML = wyNotifyContent;
    wyNotifyWrapper.appendChild(wyNotifyEl);

    setTimeout(() => {
      wyNotifyEl.setAttribute('class', 'wy-notify wy-notify--show');
    }, 0);

    // 绑定事件
    if (typeof options.onclick === 'function') {
      wyNotifyEl.addEventListener('click', options.onclick);
    }

    setTimeout(() => {
      wyNotifyEl.addEventListener(
        'transitionend',
        () => {
          wyNotifyWrapper.removeChild(wyNotifyEl);
        },
        { once: true }
      );
      wyNotifyEl.setAttribute('class', 'wy-notify');
    }, options.timeout);
  };

  addGlobalStyle(`
  .wy-notify__wrap {
    position: fixed;
    top: 30px;
    right: 30px;
    z-index: 999999;
  }

  .wy-notify {
    padding: 12px 15px;
    border-radius: 3px;
    font-size: 14px;
    background-color: rgba(0, 0, 0, .8);
    color: #ffffff;
    line-height: 1.4;
    transition: all .4s cubic-bezier(0, 0, 0.2, 1);
    cursor: pointer;
    opacity: 0;
    transform: translate(0, 50px);
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }

  .wy-notify::before {
    content: '💁‍♀️';
    margin-right: 10px;
    font-size: 1.8em;
    width: 25px;
  }

  .wy-notify__content {
    max-width: 260px;
  }

  .wy-notify__title {
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    margin-bottom: 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wy-notify__desc {
    font-size: 12px;
    color: #dddddd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wy-notify.wy-notify--show {
    transform: translate(0, 0);
    opacity: 1;
  }
  `);

  const chunkId = Math.random().toString(36).substring(7);
  webpackJsonp([7890], {
    [chunkId]: function (m, e, r) {
      let modules = Object.values(r.c)
        .filter((x) => !!x.exports.Axios)
        .map((x) => x.exports);
      
      // 如果没有检查到 axios 对象则退出
      if (modules.length === 0) {
        console.error('没有检测到 axios 模块，已退出 WeiyunHelper');
        return false;
      }

      let axios = modules[0];
      axios.interceptors.response.use(
        (response) => {
          let { data, config } = response;
          let isDownload = false;
          let isSuccess = data.data.rsp_header.retcode === 0;
          let isDiskFileBatchDownload =
            config.url.indexOf('/webapp/json/weiyunQdiskClient/DiskFileBatchDownload') > -1;
          let isDiskFilePackageDownload = config.url.indexOf('/webapp/json/weiyunQdisk/DiskFilePackageDownload') > -1;
          let downloadUrl = '';
          let cookieName = '';
          let cookieValue = '';
          let URI = {};
          let fileName = '';

          // 单个文件下载
          if (
            isSuccess &&
            isDiskFileBatchDownload &&
            data.data &&
            data.data.rsp_body &&
            data.data.rsp_body.RspMsg_body &&
            data.data.rsp_body.RspMsg_body.file_list &&
            data.data.rsp_body.RspMsg_body.file_list.length > 0
          ) {
            let fileList = data.data.rsp_body.RspMsg_body.file_list;
            isDownload = true;
            downloadUrl = fileList[0].https_download_url;
            cookieName = fileList[0].cookie_name;
            cookieValue = fileList[0].cookie_value;
            URI = new URL(downloadUrl);
            fileName = decodeURI(URI.pathname.substr(URI.pathname.lastIndexOf('/') + 1));
          }

          // 批量下载文件
          if (
            isSuccess &&
            isDiskFilePackageDownload &&
            data.data &&
            data.data.rsp_body &&
            data.data.rsp_body.RspMsg_body
          ) {
            let file = data.data.rsp_body.RspMsg_body;
            isDownload = true;
            downloadUrl = file.https_download_url;
            cookieName = file.cookie_name;
            cookieValue = file.cookie_value;
            fileName = `微云合并下载文件_${new Date().Format('yyyy-MM-dd hh:mm:ss')}.zip`;
          }

          if (isDownload) {
            let ariaNgUrl = `http://aria2.me/aria-ng/#!/new/task?url=${btoa(
              downloadUrl
            )}&header=Cookie:${cookieName}=${cookieValue}&out=${encodeURI(fileName)}`;

            console.log('文件名称:', fileName);
            console.log('下载地址:', downloadUrl);
            console.log('请求参数:', `Cookie:${cookieName}=${cookieValue}`);
            console.log('AriaNg URL:', ariaNgUrl);

            // 发送消息通知提醒使用 ariaNg 下载
            wyNotify({
              title: `开始下载: ${fileName}`,
              description: '点击此处使用 AriaNg 下载',
              onclick: function () {
                window.open(ariaNgUrl);
              },
            });
          }

          return response;
        },
        (error) => {
          console.log('发生错误', error);
          return Promise.reject(error);
        }
      );
    },
  }, [chunkId]);
})();
