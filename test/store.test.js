'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createStore } = require('../js/store.js');

/** 内存版 localStorage */
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

test('收藏：toggle / 状态查询 / 持久化', () => {
  const s = memStorage();
  const a = createStore(s);
  assert.strictEqual(a.toggleFavorite(5), true, '第一次收藏返回 true');
  assert.ok(a.isFavorite(5));
  assert.strictEqual(a.toggleFavorite(5), false, '再点取消返回 false');
  assert.ok(!a.isFavorite(5));

  // 重新收藏后，用新的 store 实例（模拟刷新页面）读取
  a.toggleFavorite(5);
  const b = createStore(s);
  assert.ok(b.isFavorite(5), '刷新后收藏保留');
});

test('报名：写入 / 覆盖 / 取消 / 持久化', () => {
  const s = memStorage();
  const store = createStore(s);
  store.addSignup(14, { name: '张三', grade: '大一', status: 'pendingAudit' });
  assert.strictEqual(store.getSignup(14).status, 'pendingAudit');
  store.addSignup(14, { name: '张三', grade: '大一', status: 'confirmed' });
  assert.strictEqual(store.getSignup(14).status, 'confirmed', '重复报名覆盖状态');
  const again = createStore(s);
  assert.strictEqual(again.getSignup(14).name, '张三', '刷新后报名保留');
  again.removeSignup(14);
  assert.strictEqual(again.getSignup(14), null);
});

test('发布：新增 / 编辑 / 删除 / 持久化', () => {
  const s = memStorage();
  const store = createStore(s);
  store.addPost({ id: 'u_1', title: '约球', kind: 'activity' });
  assert.strictEqual(store.getState().posts.length, 1);
  assert.strictEqual(store.updatePost('u_1', { title: '约羽毛球' }), true);
  assert.strictEqual(store.getState().posts[0].title, '约羽毛球');
  assert.strictEqual(store.updatePost('u_404', { title: 'x' }), false, '不存在的发布返回 false');
  const again = createStore(s);
  assert.strictEqual(again.getState().posts[0].title, '约羽毛球', '刷新后发布保留');
  assert.strictEqual(again.removePost('u_1'), true);
  assert.strictEqual(again.getState().posts.length, 0);
  assert.strictEqual(again.removePost('u_1'), false);
});

test('举报：记录原因与次数、防重复提交', () => {
  const s = memStorage();
  const store = createStore(s);
  store.addReport(24, '疑似诈骗 / 非正规兼职', '要求加微信');
  assert.ok(store.hasReported(24));
  store.addReport(24, '广告 / 商业推广', '');
  assert.strictEqual(store.getState().reports[24].count, 2, '多次举报计数');
  assert.strictEqual(store.getState().reports[24].reason, '广告 / 商业推广', '保留最新原因');
});

test('损坏数据容错：非法 JSON 回退默认状态', () => {
  const s = memStorage();
  s.setItem('mihuo.campus.v1', '{oops');
  const store = createStore(s);
  assert.deepStrictEqual(store.getState().favorites, []);
  assert.doesNotThrow(() => store.toggleFavorite(1));
});

test('无 storage 环境不崩溃', () => {
  const store = createStore(null);
  assert.doesNotThrow(() => store.toggleFavorite(1));
  assert.strictEqual(store.isFavorite(1), true, '内存态仍可用');
});
