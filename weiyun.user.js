// ==UserScript==
// @name         WeiyunHelper - 微云 Aria2 下载辅助脚本
// @namespace    https://github.com/loo2k/WeiyunHelper/
// @version      0.0.7
// @description  微云下载时文件支持导出到 aria2 下载，支持分享页面及个人云盘管理页
// @author       Luke
// @match        *://*.weiyun.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://github.com/loo2k/WeiyunHelper/raw/master/weiyun.user.js
// @downloadURL  https://github.com/loo2k/WeiyunHelper/raw/master/weiyun.user.js
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

  /**
   * 将微云返回的下载地址解析到 Aria2 进行下载
   *
   * @param {void}
   */
  const handleResp2Aria2 = (ret) => {
    let downloadUrl = '';
    let cookieName = '';
    let cookieValue = '';
    let URI = {};
    let fileName = '';
    if (ret.file_list) {
      downloadUrl = ret.file_list[0].https_download_url;
      cookieName = ret.file_list[0].cookie_name;
      cookieValue = ret.file_list[0].cookie_value;
      URI = new URL(downloadUrl);
      fileName = decodeURI(URI.pathname.substr(URI.pathname.lastIndexOf('/') + 1));
    } else {
      downloadUrl = ret.https_download_url;
      cookieName = ret.cookie_name;
      cookieValue = ret.cookie_value;
      fileName = `微云合并下载文件_${new Date().Format('yyyy-MM-dd hh:mm:ss')}.zip`;
    }

    const ariaNgUrl = `http://aria2.pigfly.im/ariang/#!/new/task?url=${btoa(downloadUrl)}&header=Cookie:${cookieName}=${cookieValue}&out=${encodeURI(fileName)}`;

    console.log('文件名称:', fileName);
    console.log('下载地址:', downloadUrl);
    console.log('请求参数:', `Cookie:${cookieName}=${cookieValue}`);
    console.log('AriaNg URL:', ariaNgUrl);

    // 使用 ariaNg 进行下载
    window.open(ariaNgUrl);
  }

  const injectChunkId = Math.random().toString(36).substring(7);

  // 微云文件分享页面注入脚本模块
  location.host === 'share.weiyun.com' && webpackJsonp([7892], {[injectChunkId]: function(modules, exports, require) {
    // 寻找 DownloadRequest 模块
    const [ DownloadRequest ] = Object.values(require.c)
      .filter((x) => x.exports && typeof x.exports.DownloadRequest === 'function' && typeof x.exports.DownloadType === 'object')
      .map((x) => x.exports.DownloadRequest);

    // 寻找 DownloadOperate 模块
    const [ DownloadOperate ] = Object.values(require.c)
      .filter((x) => x.exports && typeof x.exports.DownloadOperate === 'function')
      .map((x) => x.exports.DownloadOperate);

    // 获取 Vue 应用实例
    const $Vue = document.getElementById('app').__vue__;

    // 判断依赖模块是否存在
    if (!DownloadRequest || !DownloadOperate) {
      console.error('没有检测到适配模块，已退出 WeiyunHelper');
      console.error('你可以到 https://github.com/loo2k/WeiyunHelper/issues 向作者反馈问题')
      return false;
    }

    // 下载选中文件
    function downloadSelectedFiles() {
      const { shareFile } = $Vue.$store.state.sharefile;
      if (!$Vue.$store.getters["sharefile/isSelected"]) {
        if (shareFile.shareFile.childNodes.length === 1) {
          shareFile.shareFile.selectAllFiles();
        } else {
          return alert('你都还没有选择文件 :(');
        }
      }

      const downloadOptions = {
        fileOwner: shareFile.shareOwner,
        shareKey: shareFile.shareKey,
        sharePwd: shareFile.sharePwd,
        downloadType: 0
      }

      return new DownloadOperate(shareFile.shareFile, downloadOptions)
        .downloadWithType_(new DownloadRequest(), downloadOptions)
        .then(handleResp2Aria2).catch(e => { alert(e.msg) });
    }

    // 监听 body 的 DOM 变化并将下载入口植入
    const observeTarget = document.body;
    const observeConfig = { attributes: true, childList: true, subtree: true };
    const observeCallback = function (mutations, observer) {
      for (let mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            // 判断页面中增加的元素是否是针对文件的下拉菜单
            if (
              node.className &&
              node.className.indexOf('mod-bubble-context-menu') > -1 &&
              node.__vue__ &&
              node.__vue__.items.some(e => e.method === 'download')
            ) {
              const contextItems = node.querySelectorAll('.menu-item');
              const newContextItem = document.createElement('li')
              newContextItem.className = 'menu-item';
              newContextItem.innerHTML = '<span class="txt">使用 Aria 下载</span>';
              newContextItem.addEventListener('click', function() {
                downloadSelectedFiles();
                // 关闭右键菜单
                document.dispatchEvent(new Event('mousedown'));
              });
              contextItems[0].parentNode.insertBefore(newContextItem, contextItems[0].nextSibling);
            }
          })
        }
      }
    }
    const observeInstance = new MutationObserver(observeCallback);
    observeInstance.observe(observeTarget, observeConfig);

    // 直接注入工具条的下载入口
    const actionWrapCode = document.querySelector('.mod-action-wrap-code');
    const actionWrapAria = document.createElement('div');
    actionWrapAria.className = 'mod-action-wrap mod-action-wrap-menu mod-action-wrap-aria clearfix';

    const actionItem = document.createElement('div');
    actionItem.className = 'action-item';
    actionItem.innerHTML = '<div class="action-item-con"><i class="icon icon-download"></i><span class="act-txt">使用 Aria 下载</span></div>';
    actionItem.addEventListener('click', function () {
      downloadSelectedFiles();
    });
    actionWrapAria.appendChild(actionItem);
    actionWrapCode.parentNode.insertBefore(actionWrapAria, actionWrapCode);
  }}, [injectChunkId]);

  // 微云云盘管理页面注入脚本模块
  location.host === 'www.weiyun.com' && webpackJsonp([7891], {[injectChunkId]: function(modules, exports, require) {
    // 寻找云盘操作 API 模块
    const diskServices = Object.values(require.c)
      .filter((x) => x.exports && typeof x.exports.namespace === 'function' && typeof x.exports.namespace('PERSON').fetchUserInfo === 'function')
      .map((x) => x.exports.namespace);
    const diskService = diskServices && diskServices[0]('PERSON');

    if (diskServices.length === 0) {
      console.error('没有检测到适配模块，已退出 WeiyunHelper');
      console.error('你可以到 https://github.com/loo2k/WeiyunHelper/issues 向作者反馈问题')
      return false;
    }

    // 下载选中的文件
    function downloadSelectedFiles() {
      let request = null;
      const selected = document.querySelectorAll('.list-group-item.checked.act');
      const fileNodes = Array.from(selected).map(item => item.__vue__.fileNode);
      if (fileNodes.length === 1 && !fileNodes[0].isDir()) {
        request = diskService.fetchDownloadFileInfo({ fileNodes });
      } else {
        request = diskService.fetchPackDownloadDirFileInfo({ fileNodes });
      }

      request.then(handleResp2Aria2).catch(e => { alert(e.msg) });
    }

    // 监听 body 的 DOM 变化并将下载入口植入
    const observeTarget = document.body;
    const observeConfig = { attributes: true, childList: true, subtree: true };
    const observeCallback = function (mutations, observer) {
      for (let mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            // 判断页面中增加的元素是否是针对文件的下拉菜单
            if (
              node.className &&
              node.className.indexOf('mod-bubble-context-menu') > -1 &&
              node.__vue__ &&
              node.__vue__.items.some(e => e.method === 'download')
            ) {
              const contextItems = node.querySelectorAll('.menu-item');
              const newContextItem = document.createElement('li')
              newContextItem.className = 'menu-item';
              newContextItem.innerHTML = '<span class="txt">使用 Aria 下载</span>';
              newContextItem.addEventListener('click', function() {
                downloadSelectedFiles();
                // 关闭右键菜单
                document.dispatchEvent(new Event('mousedown'));
              });
              contextItems[0].parentNode.insertBefore(newContextItem, contextItems[0].nextSibling);
            }
          })
        }

        // 针对顶部下载菜单
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'style' &&
          mutation.target.className.indexOf('mod-action-wrap-menu') > -1 &&
          mutation.target.style.display !== 'none' &&
          mutation.target.querySelectorAll('#action-item-aria').length === 0
        ) {
          const actionItems = mutation.target.querySelectorAll('.action-item');
          const newActionItem = document.createElement('div');
          newActionItem.id = 'action-item-aria'
          newActionItem.className = 'action-item';
          newActionItem.innerHTML = '<div class="action-item-con"><i class="icon icon-download"></i><span class="act-txt">使用 Aria 下载</span></div>';
          newActionItem.addEventListener('click', function () {
            downloadSelectedFiles();
          });
          mutation.target.insertBefore(newActionItem, actionItems[0].nextSibling);
        }
      }
    }
    const observeInstance = new MutationObserver(observeCallback);
    observeInstance.observe(observeTarget, observeConfig);

    // 打开离线下载窗口并填写链接
    const openDownloadModal = (text = '') => {
      let wyCreateBtn = document.querySelectorAll('.mod-action-wrap-create');
      let $wyCreateBtn = wyCreateBtn[0] && wyCreateBtn[0].__vue__;
      $wyCreateBtn.offlineDownload();

      // 点击使用磁力链下载
      let modalBtNav = document.querySelectorAll('.modal-dialog-bt .modal-tab-nav .tab-nav-item');
      modalBtNav.forEach(nav => {
        if (nav.innerText.trim() === '链接下载') {
          nav.click();
        }
      });

      setTimeout(() => {
        // 填写 magent 或者 ed2k 链接
        let urlTextarea = document.querySelector('.modal-dialog-bt .tab-cont-item.online .input-block');
        if (text) {
          urlTextarea.value = text;
          urlTextarea.dispatchEvent(new Event('input'));
        }
      }, 0);
    }

    // 粘贴磁力链或者 ed2k 时自动启动下载
    document.addEventListener('paste', (event) => {
      // 针对非输入框的粘贴时间
      if (['TEXTAREA', 'INPUT'].includes(event.target.tagName)) {
        return;
      }

      // 剪切板数据对象
      let clipboardData = event.clipboardData || window.clipboardData;

      // 剪切板对象可以获取
      if (!clipboardData) { return; }

      let paste = clipboardData.getData('text');
      let isEd2k = /^ed2k:\/\//ig.test(paste);
      let isMagent = /^magnet:/ig.test(paste);
      if (isEd2k || isMagent) {
        openDownloadModal(paste);
      }
    });
  }}, [injectChunkId]);
})();
