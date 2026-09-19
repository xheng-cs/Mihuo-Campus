/**
 * 觅活 Mihuo Campus —— 本地持久化层
 * -------------------------------------------------------------
 * localStorage 封装：收藏 / 报名 / 发布 / 举报。
 * 刷新、关闭重开浏览器后数据均保留（题目基础要求 6）。
 * storage 可注入（单元测试传内存实现）。
 */
(function (global) {
  'use strict';

  var KEY = 'mihuo.campus.v1';

  function defaultState() {
    return {
      favorites: [],          // [id]
      signups: {},            // { [id]: { name, grade, contact, intro, status, time } }
      posts: [],              // 学生发布的内容（完整条目）
      reports: {},            // { [id]: { reason, note, time, count } }
      gotResources: [],       // 已领取的资料 id
      seenRiskNotice: false,  // 风险提示弹窗是否已读
    };
  }

  function createStore(storage) {
    storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

    function load() {
      if (!storage) return defaultState();
      try {
        var raw = storage.getItem(KEY);
        if (!raw) return defaultState();
        var parsed = JSON.parse(raw);
        var base = defaultState();
        for (var k in base) {
          if (Object.prototype.hasOwnProperty.call(base, k)) {
            base[k] = parsed[k] !== undefined ? parsed[k] : base[k];
          }
        }
        return base;
      } catch (e) {
        return defaultState();
      }
    }

    var state = load();

    function save() {
      if (!storage) return;
      try {
        storage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        /* 存储满等异常时静默，不影响主流程 */
      }
    }

    return {
      getState: function () { return state; },
      reset: function () {
        state = defaultState();
        save();
      },
      toggleFavorite: function (id) {
        var idx = state.favorites.indexOf(id);
        if (idx === -1) state.favorites.push(id);
        else state.favorites.splice(idx, 1);
        save();
        return idx === -1;
      },
      isFavorite: function (id) { return state.favorites.indexOf(id) !== -1; },

      addSignup: function (id, info) {
        state.signups[id] = {
          name: info.name || '',
          grade: info.grade || '',
          contact: info.contact || '',
          intro: info.intro || '',
          status: info.status || 'confirmed',
          time: info.time || new Date().toISOString(),
        };
        save();
      },
      removeSignup: function (id) {
        delete state.signups[id];
        save();
      },
      getSignup: function (id) { return state.signups[id] || null; },

      addPost: function (post) {
        state.posts.push(post);
        save();
      },
      updatePost: function (id, patch) {
        for (var i = 0; i < state.posts.length; i++) {
          if (state.posts[i].id === id) {
            for (var k in patch) {
              if (Object.prototype.hasOwnProperty.call(patch, k)) state.posts[i][k] = patch[k];
            }
            save();
            return true;
          }
        }
        return false;
      },
      removePost: function (id) {
        var before = state.posts.length;
        state.posts = state.posts.filter(function (p) { return p.id !== id; });
        if (state.posts.length !== before) {
          save();
          return true;
        }
        return false;
      },

      addReport: function (id, reason, note) {
        var prev = state.reports[id] || { count: 0 };
        state.reports[id] = {
          reason: reason,
          note: note || '',
          time: new Date().toISOString(),
          count: prev.count + 1,
        };
        save();
      },
      hasReported: function (id) { return !!state.reports[id]; },

      markGotResource: function (id) {
        if (state.gotResources.indexOf(id) === -1) state.gotResources.push(id);
        save();
      },
      hasGotResource: function (id) { return state.gotResources.indexOf(id) !== -1; },

      setSeenRiskNotice: function (v) {
        state.seenRiskNotice = !!v;
        save();
      },
    };
  }

  var exported = { createStore: createStore, KEY: KEY, defaultState: defaultState };
  global.MIHUO_STORE = exported;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
