/**
 * PNGinfo Viewer Chrome Extension - Background Service Worker
 * アクションボタンがクリックされた時にedit.htmlを新しいタブで開く
 */

/**
 * アクションボタンクリック時のイベントハンドラ
 * @param {chrome.action.UserDetails} details - クリック時の詳細情報
 */
chrome.action.onClicked.addListener(async () => {
  try {
    // edit.htmlを新しいタブで開く
    const extensionUrl = chrome.runtime.getURL('edit.html');
    await chrome.tabs.create({
      url: extensionUrl,
      active: true
    });
  } catch (error) {
    console.error('Failed to open PNGinfo Viewer:', error);
  }
});

/**
 * 拡張機能インストール時の初期化処理
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('PNGinfo Viewer extension installed successfully');
});