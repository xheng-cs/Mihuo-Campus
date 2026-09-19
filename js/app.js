/**
 * 觅活 Mihuo Campus —— 界面与交互层
 * -------------------------------------------------------------
 * 视图：发现（筛选/搜索/截止雷达）· 时间轴 · 我的空间
 * 流程：详情 → 报名/收藏/举报 → 我的空间；学生三步发布 → 进入信息流
 * 所有用户操作（收藏/报名/发布/举报/资料领取）均持久化到 localStorage。
 */
(function () {
  'use strict';

  var DATA = window.MIHUO_DATA;
  var L = window.MIHUO_LOGIC;
  var store = window.MIHUO_STORE.createStore();

  var NOW = L.baseNow();

  var filters = { cat: 'all', source: 'all', status: 'all', q: '', beginner: false, sort: 'recommended' };
  var view = 'discover';
  var mineTab = 'favorites';
  var publishEditId = null;   // 非空 = 编辑自己已发布的内容
  var publishStep = 1;
  var detailId = null;        // 当前详情弹窗中的条目 id

  /* ================= 基础工具 ================= */

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function toast(msg, type) {
    var wrap = $('#toast-wrap');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 260);
    }, 2400);
  }

  /** 通用确认弹窗 */
  function openConfirm(title, text, yesLabel, onYes) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yesLabel || '确认';
    var modal = $('#modal-confirm');
    modal.hidden = false;
    var handler = function () {
      modal.hidden = true;
      $('#confirm-yes').removeEventListener('click', handler);
      onYes && onYes();
    };
    $('#confirm-yes').addEventListener('click', handler);
  }
  function closeConfirm() {
    $('#modal-confirm').hidden = true;
  }

  function fmtDateTime(iso) {
    if (!iso) return '未注明';
    var d = new Date(iso);
    return L.fmtDay(d, NOW) + ' ' + L.fmtTime(d);
  }
  function fmtDateOnly(iso) {
    if (!iso) return '未注明';
    var d = new Date(iso);
    return L.fmtDay(d, NOW) + '（' + (d.getMonth() + 1) + '/' + d.getDate() + '）';
  }

  /* ================= 数据装配 ================= */

  function decorate(it) {
    it._status = L.computeStatus(it, NOW);
    it._risk = L.assessRisk(it);
    return it;
  }
  function allItems() {
    var list = DATA.RAW_ITEMS.map(decorate);
    store.getState().posts.forEach(function (p) { list.push(decorate(p)); });
    return list;
  }
  function itemById(id) {
    var found = null;
    allItems().forEach(function (it) { if (String(it.id) === String(id)) found = it; });
    return found;
  }
  function catOf(id) { return DATA.categoryById(id); }
  function srcOf(id) { return DATA.sourceById(id); }

  function isMine(it) { return !!it.mine; }
  function reported(it) { return store.hasReported(String(it.id)); }
  function signed(it) { return store.getSignup(String(it.id)); }

  /* ================= 卡片渲染 ================= */

  function srcChipHtml(it) {
    if (isMine(it)) return '<span class="src-chip src-mine">🧑‍🎓 我发布的</span>';
    var src = srcOf(it.source);
    var icon = it.source === 'school' ? '🏛' : it.source === 'college' ? '🎓' : '🧑‍🎓';
    return '<span class="src-chip src-' + it.source + '">' + icon + ' ' + src.short + '</span>';
  }

  function statusBadgeHtml(it) {
    var st = it._status;
    var badgeCls = 'badge-' + (st.badge || 'info');
    var extra = '';
    if (st.phase === 'waitlist') extra = ' <span class="tag tag-warn">候补</span>';
    if (st.phase === 'book') extra = ' <span class="tag tag-warn">审核制</span>';
    return '<span class="badge ' + badgeCls + '">' + esc(st.badgeText) + '</span>' + extra;
  }

  function cardMetaHtml(it) {
    var st = it._status;
    var parts = [];
    if (it.start && st.phase !== 'ended') {
      parts.push('<span>🕐 ' + esc(L.fmtDay(new Date(it.start), NOW) + ' ' + L.fmtTime(new Date(it.start))) + (it.startNote ? '（时间未定）' : '') + '</span>');
    } else if (it.scheduleNote) {
      parts.push('<span>🕐 ' + esc(it.scheduleNote.split('；')[0]) + '</span>');
    } else if (it.kind === 'recruit' && !it.deadline && !it.start) {
      parts.push('<span>🕐 时间未注明</span>');
    }
    if (it.place) parts.push('<span>📍 ' + esc(it.place) + '</span>');
    else if (it.placeNote) parts.push('<span>📍 ' + esc(it.placeNote) + '</span>');
    if (it.capacity) parts.push('<span>👥 限 ' + it.capacity + ' 人</span>');
    else if (it.capacityNote) parts.push('<span>👥 ' + esc(it.capacityNote) + '</span>');
    if (it.fee) parts.push('<span>💰 ' + esc(it.fee) + '</span>');
    if (st.phase === 'closing' && st.countdown) parts.push('<span style="color:#DC2626;font-weight:700">⏰ ' + esc(st.countdown) + '</span>');
    else if (st.phase === 'open' && st.countdown) parts.push('<span>⏰ ' + esc(st.countdown) + '</span>');
    return parts.join('');
  }

  function riskRibbonHtml(it) {
    var r = it._risk;
    if (r.level === 'high') return '<div class="risk-ribbon high">🚨 风险提示：' + esc(r.reasons.join('、')) + '</div>';
    if (r.level === 'medium') return '<div class="risk-ribbon medium">⚠️ 疑似推广：' + esc(r.reasons.join('、')) + '</div>';
    if (r.level === 'low') {
      var msg = (r.missing.length ? '信息待完善：' + r.missing.join('、') : r.reasons.join('、'));
      return '<div class="risk-ribbon low">ℹ️ ' + esc(msg) + '</div>';
    }
    return '';
  }

  function tagsHtml(it) {
    var tags = [];
    if (it.beginner) tags.push('<span class="tag">🌱 零基础友好</span>');
    (it.tags || []).slice(0, 3).forEach(function (t) { tags.push('<span class="tag">' + esc(t) + '</span>'); });
    if (it.regType === 'long') tags.push('<span class="tag">长期</span>');
    if (isMine(it)) tags.push('<span class="tag tag-warn">待核验</span>');
    if (reported(it)) tags.push('<span class="tag tag-danger">已举报·复核中</span>');
    return '<div class="card-tags">' + tags.join('') + '</div>';
  }

  function cardHtml(it) {
    var st = it._status;
    var riskCls = it._risk.level === 'high' ? ' risk-high' : it._risk.level === 'medium' ? ' risk-medium' : it._risk.level === 'low' ? ' risk-low' : '';
    var upd = (it.updates && it.updates.length) ? '<span class="card-updated">📢 已更新</span>' : '';
    var favOn = store.isFavorite(String(it.id));
    var cat = catOf(it.category);
    return '' +
      '<article class="card' + riskCls + (reported(it) ? ' is-reported' : '') + (isMine(it) ? ' is-mine' : '') + '" data-id="' + esc(it.id) + '">' +
        '<div class="card-top">' + srcChipHtml(it) +
          '<span class="cat-tag">' + (cat ? cat.icon + ' ' + cat.name : '') + '</span>' + upd + statusBadgeHtml(it) +
        '</div>' +
        '<h3 class="card-title">' + esc(it.title) + '</h3>' +
        '<p class="card-summary">' + esc(it.summary) + '</p>' +
        riskRibbonHtml(it) +
        '<div class="card-meta">' + cardMetaHtml(it) + '</div>' +
        '<div class="card-foot">' + tagsHtml(it) +
          '<div class="card-actions">' +
            '<button class="fav-btn' + (favOn ? ' is-on' : '') + '" data-fav="' + esc(it.id) + '" aria-label="收藏">' + (favOn ? '♥' : '♡') + '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* ================= 发现页 ================= */

  function currentFiltered() {
    var list = allItems().map(function (it) { return it; });
    list = L.filterItems(list, {
      cat: filters.cat, source: filters.source, status: filters.status,
      beginner: filters.beginner, q: filters.q,
    });
    return L.sortItems(list, filters.sort, NOW);
  }

  function renderCats() {
    var cats = [{ id: 'all', name: '全部', icon: '🗂' }].concat(DATA.CATEGORIES);
    var counts = {};
    allItems().forEach(function (it) {
      counts[it.category] = (counts[it.category] || 0) + 1;
    });
    counts.all = allItems().length;
    $('#filter-cats').innerHTML = cats.map(function (c) {
      var n = counts[c.id] || 0;
      return '<button class="cat-chip' + (filters.cat === c.id ? ' is-active' : '') + '" data-cat="' + c.id + '">' +
        c.icon + ' ' + c.name + ' <em style="opacity:.65">' + n + '</em></button>';
    }).join('');
  }

  function renderRadar() {
    var entries = L.radarItems(allItems(), NOW);
    var strip = $('#radar-strip');
    if (!entries.length) { strip.hidden = true; return; }
    strip.hidden = false;
    $('#radar-list').innerHTML = entries.map(function (e) {
      var cls = e.kind === 'ongoing' ? ' ongoing' : '';
      var cnt = e.kind === 'ongoing' ? '正在进行' : (e.item._status.countdown || '即将截止');
      return '<div class="radar-card' + cls + '" data-open="' + esc(e.item.id) + '">' +
        '<div class="radar-card-top"><span>' + (e.kind === 'ongoing' ? '🟢' : '🔴') + '</span><span>' + esc(e.item.title) + '</span></div>' +
        '<div class="radar-card-title">' + esc(e.item.summary || '') + '</div>' +
        '<div class="radar-count">' + esc(cnt) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderDiscover() {
    var list = currentFiltered();
    $('#card-grid').innerHTML = list.map(cardHtml).join('');
    $('#empty-state').hidden = list.length > 0;
    var desc = [];
    if (filters.q) desc.push('关键词「' + esc(filters.q) + '」');
    if (filters.cat !== 'all') { var c = catOf(filters.cat); desc.push(c ? c.name : ''); }
    if (filters.source !== 'all') desc.push(srcOf(filters.source).name);
    if (filters.status !== 'all') desc.push($('#filter-status').selectedOptions[0].textContent);
    if (filters.beginner) desc.push('🌱 新生模式');
    $('#result-meta').innerHTML = '共 <strong>' + list.length + '</strong> 条信息' +
      (desc.length ? ' · ' + desc.join(' · ') : '') +
      ' · 时间基准 2026-09-19（可加 <code>?now=</code> 参数模拟其他日期）';
  }

  function renderStats() {
    var all = allItems();
    var urgent = 0, beginner = 0, long = 0, joinable = 0;
    all.forEach(function (it) {
      if (it._status.urgent) urgent++;
      if (it.beginner) beginner++;
      if (it.regType === 'long') long++;
      if (it._status.signup) joinable++;
    });
    $('#stat-urgent').textContent = urgent;
    $('#stat-beginner').textContent = beginner;
    $('#stat-long').textContent = long;
    $('#stat-joinable').textContent = joinable;
  }

  /* ================= 时间轴 ================= */

  function timelineHtml() {
    var tl = L.buildTimeline(allItems(), NOW);
    var evType = { start: 'is-start', deadline: 'is-deadline', resource: 'is-resource', update: 'is-update', replay: 'is-replay', final: 'is-final' };
    var evLabel = { start: '▶ 开始', deadline: '⏰ 报名截止', resource: '📁 提取失效', update: '📢 补充通知', replay: '📺 回放上线', final: '🏁 作品提交截止' };
    var inner = tl.days.map(function (day) {
      var events = day.events.map(function (e) {
        var cls = evType[e.type] || 'is-start';
        return '<div class="day-event ' + cls + '" data-open="' + esc(e.item.id) + '">' +
          '<div class="day-event-top"><span class="ev-time">' + esc(e.timeText) + '</span><span>' + evLabel[e.type] + '</span></div>' +
          '<div class="day-event-title">' + esc(e.item.title) + '</div>' +
        '</div>';
      }).join('');
      if (!events) events = '<div class="day-empty">—— 暂无安排 ——</div>';
      return '<div class="day-col' + (day.label === '今天' ? ' is-today' : '') + '">' +
        '<div class="day-head"><strong>' + day.label + '</strong><small>' + day.sub + '</small></div>' + events +
      '</div>';
    }).join('');

    var beyondHtml = '';
    if (tl.beyond.length) {
      beyondHtml = tl.beyond.map(function (e) {
        var d = new Date(e.startTime);
        var cls = evType[e.type] || 'is-start';
        return '<div class="beyond-item" data-open="' + esc(e.item.id) + '">' +
          '<span class="beyond-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>' +
          '<span class="beyond-title">' + evLabel[e.type] + ' · ' + esc(e.item.title) + '</span>' +
        '</div>';
      }).join('');
    }
    $('#timeline').innerHTML = inner;
    $('#timeline-beyond').hidden = !beyondHtml;
    $('#beyond-list').innerHTML = beyondHtml;
  }

  /* ================= 我的空间 ================= */

  function mineStatsHtml() {
    var st = store.getState();
    var stat = function (icon, bg, num, label) {
      return '<div class="mine-stat"><div class="mine-stat-icon" style="background:' + bg + '">' + icon + '</div>' +
        '<div><b>' + num + '</b><span>' + label + '</span></div></div>';
    };
    $('#mine-stats').innerHTML =
      stat('⭐', '#FEF4E2', st.favorites.length, '收藏的信息') +
      stat('📝', '#E7F8F1', Object.keys(st.signups).length, '已报名的机会') +
      stat('📤', '#EEF0FF', st.posts.length, '我发布的内容');
  }

  function mineListHtml() {
    var st = store.getState();
    var html = '';
    if (mineTab === 'favorites') {
      var favs = st.favorites.map(function (id) { return itemById(id); }).filter(Boolean);
      if (!favs.length) {
        html = '<div class="mine-empty"><div class="empty-icon">🔖</div><p class="empty-title">还没有收藏</p>' +
          '<p class="empty-sub">在信息卡片上点 ♡，把想参加的机会收藏到这里</p></div>';
      } else {
        html = favs.map(function (it) {
          return '<div class="mine-row" data-open="' + esc(it.id) + '">' +
            '<div class="mine-row-main"><div class="mine-row-title">' + esc(it.title) + '</div>' +
            '<div class="mine-row-sub">' + statusBadgeHtml(it) + '<span>' + esc(it._status.label) + '</span></div></div>' +
            '<div class="mine-row-actions"><button class="btn-mini" data-unfav="' + esc(it.id) + '">取消收藏</button></div>' +
          '</div>';
        }).join('');
      }
    } else if (mineTab === 'signups') {
      var ids = Object.keys(st.signups);
      if (!ids.length) {
        html = '<div class="mine-empty"><div class="empty-icon">📝</div><p class="empty-title">还没有报名记录</p>' +
          '<p class="empty-sub">去发现页找到感兴趣的机会，点击「立即报名」完成报名流程</p></div>';
      } else {
        html = ids.map(function (id) {
          var it = itemById(id);
          if (!it) return '';
          var rec = st.signups[id];
          var statusText = rec.status === 'pendingAudit' ? '<span class="badge badge-book">待审核</span>'
            : rec.status === 'waitlist' ? '<span class="badge badge-waitlist">候补中</span>'
            : '<span class="badge badge-open">已报名</span>';
          return '<div class="mine-row" data-open="' + esc(id) + '">' +
            '<div class="mine-row-main"><div class="mine-row-title">' + esc(it.title) + '</div>' +
            '<div class="mine-row-sub">' + statusText + '<span>报名人：' + esc(rec.name || '—') + '</span>' +
            '<span>提交于 ' + esc(String(rec.time || '').slice(0, 16).replace('T', ' ')) + '</span></div></div>' +
            '<div class="mine-row-actions"><button class="btn-mini danger" data-cancel="' + esc(id) + '">取消报名</button></div>' +
          '</div>';
        }).join('');
      }
    } else { // posts
      if (!st.posts.length) {
        html = '<div class="mine-empty"><div class="empty-icon">📤</div><p class="empty-title">还没有发布过内容</p>' +
          '<p class="empty-sub">约球、组队、兴趣交流……发起你的第一条校园信息</p>' +
          '<button class="btn btn-primary" id="btn-mine-publish">＋ 立即发布</button></div>';
      } else {
        html = st.posts.map(function (p) {
          return '<div class="mine-row" data-open="' + esc(p.id) + '">' +
            '<div class="mine-row-main"><div class="mine-row-title">' + esc(p.title) + '</div>' +
            '<div class="mine-row-sub"><span class="badge badge-pending">待核验</span>' +
            '<span>' + esc(p._status ? p._status.label : '') + '</span></div></div>' +
            '<div class="mine-row-actions">' +
            '<button class="btn-mini" data-edit="' + esc(p.id) + '">编辑</button>' +
            '<button class="btn-mini danger" data-del="' + esc(p.id) + '">删除</button>' +
            '</div></div>';
        }).join('');
      }
    }
    $('#mine-list').innerHTML = html;
    $('#count-fav').textContent = st.favorites.length;
    $('#count-signup').textContent = Object.keys(st.signups).length;
    $('#count-post').textContent = st.posts.length;
  }

  function renderMine() {
    // 同步页签高亮（避免切换视图后高亮与内容不一致）
    $$('.mine-tab').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.tab === mineTab);
    });
    mineStatsHtml();
    mineListHtml();
  }

  /* ================= 详情弹窗 ================= */

  function openDetail(id) {
    var it = itemById(id);
    if (!it) return;
    detailId = String(id);
    $('#detail-body').innerHTML = detailHtml(it);
    $('#modal-detail').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    $('#modal-detail').hidden = true;
    document.body.style.overflow = '';
    detailId = null;
  }

  function detailHtml(it) {
    var st = it._status;
    var cat = catOf(it.category);
    var src = srcOf(it.source);
    var rec = store.getSignup(String(it.id));

    // 头部
    var head = '<div class="detail-head">' +
      '<div class="detail-cat-icon" style="background:' + (cat ? cat.color + '22' : '#EEF0FF') + '">' + (cat ? cat.icon : '📌') + '</div>' +
      '<div><h2 class="detail-title">' + esc(it.title) + '</h2>' +
      '<div class="detail-src-row">' + srcChipHtml(it) +
      '<span style="font-size:12px;color:var(--muted)">' + (it.publisherLabel || (src ? src.name : '')) + '</span>' +
      '<span class="cat-tag">' + (cat ? cat.icon + ' ' + cat.name : '') + '</span></div></div></div>';

    // 徽章
    var badges = '<div class="detail-badges">' + statusBadgeHtml(it);
    if (it.beginner) badges += '<span class="badge badge-open">🌱 零基础友好</span>';
    if (it.updates && it.updates.length) badges += '<span class="badge badge-update">📢 已有补充通知</span>';
    if (it.updateOf) badges += '<span class="badge badge-update">📌 补充通知</span>';
    if (isMine(it)) badges += '<span class="badge badge-pending">待核验</span>';
    if (reported(it)) badges += '<span class="badge badge-risky">已举报 · 复核中</span>';
    if (rec) {
      badges += rec.status === 'pendingAudit' ? '<span class="badge badge-book">已提交 · 待审核</span>'
        : rec.status === 'waitlist' ? '<span class="badge badge-waitlist">已加入候补</span>'
        : '<span class="badge badge-open">✓ 已报名</span>';
    }
    badges += '</div>';

    // 风险提示
    var riskHtml = '';
    var r = it._risk;
    if (r.level === 'high') {
      riskHtml = '<div class="notice notice-red"><strong>🚨 高风险提示</strong>' +
        '该信息存在「' + esc(r.reasons.join('、')) + '」等特征，且缺少主办方、地点等关键信息，' +
        '疑似非正规兼职或诱导性内容。请勿轻信“零门槛、日结”话术，不要随意添加陌生微信、转账或泄露个人信息。' +
        '平台已将其降低推荐排序，并开放举报通道。</div>';
    } else if (r.level === 'medium') {
      riskHtml = '<div class="notice notice-amber"><strong>⚠️ 疑似商业推广</strong>' +
        esc(r.reasons.join('、')) + '。该内容与校园活动关联较弱，请理性甄别后再决定是否参与。</div>';
    } else if (r.level === 'low') {
      riskHtml = '<div class="notice notice-blue"><strong>ℹ️ 信息提示</strong>' +
        esc((r.missing.length ? r.missing.join('、') + '。' : '') + (r.reasons.length ? '检测到：' + r.reasons.join('、') : '') +
        (r.missing.length || r.reasons.length ? '' : '暂无异常。')) + '</div>';
    }

    // 倒计时 / 状态条
    var countdownHtml = '';
    if (st.phase === 'closing' || (st.phase === 'open' && st.countdown)) {
      countdownHtml = '<div class="detail-countdown"><span class="num">' + esc(st.countdown) + '</span>' +
        '<span class="txt">' + (st.phase === 'closing' ? '抓住最后机会，马上报名' : '按自己节奏安排时间') + '</span></div>';
    } else if (st.phase === 'resource' && st.validUntilText) {
      countdownHtml = '<div class="detail-countdown"><span class="num">' + esc(st.validUntilText.split('（')[0]) + '</span>' +
        '<span class="txt">' + esc(st.validUntilText.split('（')[1] ? st.validUntilText.split('（')[1].replace('）', '') : '') + '</span></div>';
    } else if (st.phase === 'waitlist') {
      countdownHtml = '<div class="detail-countdown"><span class="num">候补入场</span><span class="txt">原报名已于 9/18 22:00 截止，如现场有余位可候补</span></div>';
    } else if (st.phase === 'ended' && st.replayText) {
      countdownHtml = '<div class="detail-countdown"><span class="num">' + esc(st.replayText) + '</span><span class="txt">直播已结束，回放上线后请留意</span></div>';
    }

    // 补充通知联动
    var updateHtml = '';
    if (it.updates && it.updates.length) {
      var upItems = L.getUpdatesOf(it, allItems());
      updateHtml = '<div class="update-callout"><strong>📢 重要更新（已合并展示）</strong>' +
        upItems.map(function (u) {
          return '<p>' + esc(u.summary) + '</p><span class="update-link" data-open="' + esc(u.id) + '">查看补充通知原文 →</span>';
        }).join('') + '</div>';
    } else if (it.updateOf) {
      var orig = itemById(it.updateOf);
      if (orig) {
        updateHtml = '<div class="update-callout"><strong>📌 这是补充通知</strong>' +
          '<p>对应原信息：' + esc(orig.title) + '</p><span class="update-link" data-open="' + esc(orig.id) + '">查看原信息 →</span></div>';
      }
    }

    // 信息网格
    var cells = '';
    var timeText = it.start ? fmtDateTime(it.start) + (it.end ? ' — ' + L.fmtTime(new Date(it.end)) : '') : '未注明';
    if (it.scheduleNote) timeText = esc(it.scheduleNote);
    if (it.kind === 'recruit' && !it.start && !it.deadline) timeText = '长期招募';
    if (it.kind === 'resource') timeText = '长期开放';
    cells += '<div class="detail-cell"><b>🕐 时间</b><span>' + timeText + '</span></div>';
    cells += '<div class="detail-cell"><b>📍 地点</b><span>' + esc(it.place || it.placeNote || '未注明') + '</span></div>';
    cells += '<div class="detail-cell"><b>👥 面向对象</b><span>' + esc(it.audience || '未注明') + '</span></div>';
    if (it.capacity || it.capacityNote) {
      cells += '<div class="detail-cell"><b>🧮 人数</b><span>' + esc(it.capacity ? '限 ' + it.capacity + ' 人' : it.capacityNote) + '</span></div>';
    }
    if (it.fee || it.feeNote) {
      cells += '<div class="detail-cell"><b>💰 费用</b><span>' + esc(it.fee || it.feeNote) + '</span></div>';
    }
    if (it.deadline || it.deadlineNote || (st.phase === 'signup')) {
      cells += '<div class="detail-cell"><b>⏰ 报名截止</b><span>' +
        esc(it.deadline ? fmtDateTime(it.deadline) : (it.deadlineNote || '未注明')) + '</span></div>';
    }
    if (it.finalDeadline) {
      cells += '<div class="detail-cell"><b>🏁 ' + esc(it.finalDeadlineNote || '最终提交') + '</b><span>' + esc(it.finalDeadline) + '</span></div>';
    }
    if (it.regType === 'book') {
      cells += '<div class="detail-cell"><b>🎟 录取方式</b><span>提交报名表后以审核通知为准</span></div>';
    }
    if (it.requiresIntro) {
      cells += '<div class="detail-cell"><b>📄 报名材料</b><span>需提交简短自我介绍</span></div>';
    }
    var grid = '<div class="detail-section"><h3>信息详情</h3><div class="detail-grid">' + cells + '</div></div>';

    // 要点列表
    var listHtml = '';
    if (it.extra && it.extra.length) {
      listHtml = '<div class="detail-section"><h3>要点</h3><ul class="detail-list">' +
        it.extra.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    }
    // 产品处理说明
    var notesHtml = '';
    if (it.notes && it.notes.length) {
      notesHtml = '<div class="detail-section"><h3>产品提示</h3><ul class="detail-list">' +
        it.notes.map(function (e) { return '<li class="muted">' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    }
    if (it.startNote) {
      notesHtml = (notesHtml || '<div class="detail-section"><h3>产品提示</h3><ul class="detail-list"></ul></div>');
      notesHtml = notesHtml.replace('</ul>', '<li class="muted">时间说明：' + esc(it.startNote) + '</li></ul>');
    }

    // 操作按钮
    var actions = '';
    var meta = L.signupMeta(it, st);
    if (rec) {
      actions += '<button class="btn btn-ghost" data-unsign="' + esc(it.id) + '">✕ 取消报名</button>';
    } else if (st.phase === 'resource') {
      if (store.hasGotResource(String(it.id))) {
        actions += '<span class="badge badge-open">✓ 已标记领取</span>';
      } else {
        actions += '<button class="btn btn-primary" data-getres="' + esc(it.id) + '">📁 查看获取方式</button>';
      }
    } else if (meta && meta.btn) {
      actions += '<button class="btn btn-primary" data-sign="' + esc(it.id) + '">📝 ' + esc(meta.btn) + '</button>';
    } else if (st.phase === 'noReg') {
      actions += '<span class="badge badge-noReg">无需报名 · 按时到场即可</span>';
    } else if (st.phase === 'closed' || st.phase === 'ended' || st.phase === 'unknown') {
      actions += '<button class="btn btn-ghost" disabled>🚫 当前不可报名</button>';
    }
    actions += '<button class="btn btn-ghost" data-fav="' + esc(it.id) + '">' +
      (store.isFavorite(String(it.id)) ? '♥ 已收藏' : '♡ 收藏') + '</button>';
    if (!reported(it)) actions += '<button class="btn btn-ghost" data-report="' + esc(it.id) + '">🚩 举报</button>';
    actions += '<button class="btn btn-ghost" data-copy="' + esc(it.id) + '">📋 复制摘要</button>';
    if (isMine(it)) {
      actions += '<button class="btn btn-ghost" data-edit="' + esc(it.id) + '">✏️ 编辑</button>' +
        '<button class="btn btn-ghost" data-del="' + esc(it.id) + '" style="color:#DC2626">🗑 删除</button>';
    }
    var cta = '<div class="detail-cta">' + actions + '</div>';

    return head + badges + riskHtml + countdownHtml + updateHtml + grid + listHtml + notesHtml + cta +
      '<p style="font-size:11px;color:var(--muted);margin-top:14px">编号 #' + esc(it.id) +
      (isMine(it) ? ' · 你发布的内容，发布即进入信息流，标记为「待核验」' : '') + '</p>';
  }

  /* ================= 报名流程 ================= */

  function openSignup(id) {
    var it = itemById(id);
    if (!it) return;
    var meta = L.signupMeta(it, it._status);
    if (!meta) return;
    $('#signup-target').textContent = it.title + ' · ' + meta.btn;
    $('#signup-intro-field').hidden = !it.requiresIntro;
    $('#signup-audit-hint').hidden = it.regType !== 'book';
    if (it.regType === 'book') {
      $('#signup-audit-hint').innerHTML = '<strong>🎟 审核制报名</strong>提交报名表不代表最终录取，将以审核通知为准（限 40 人）。';
    }
    var hint = '';
    var allowed = null;
    if (it.audience === '大一、大二学生') { hint = '面向大一、大二学生'; allowed = ['大一', '大二']; }
    else if (it.audience === '大二及以上学生') { hint = '仅限大二及以上学生'; allowed = ['大二', '大三', '大四', '研究生']; }
    else if (it.audience === '主要面向大一新生') { hint = '主要面向大一新生'; allowed = ['大一']; }
    else if (it.audience === '本科生') { hint = '面向本科生'; allowed = ['大一', '大二', '大三', '大四']; }
    $('#signup-audience-hint').hidden = !hint;
    $('#signup-audience-hint').innerHTML = '<strong>👥 参与条件</strong>' + hint + '，请确认自己符合要求再提交。';
    var form = $('#signup-form');
    form.reset();
    form.dataset.id = id;
    form.dataset.allowed = JSON.stringify(allowed || []);
    $('#modal-signup').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSignup() {
    $('#modal-signup').hidden = true;
    if (!$('#modal-detail').hidden) return;
    document.body.style.overflow = '';
  }

  function submitSignup(e) {
    e.preventDefault();
    var form = $('#signup-form');
    var id = form.dataset.id;
    var it = itemById(id);
    if (!it) return;
    var name = form.name.value.trim();
    var grade = form.grade.value;
    var intro = form.intro.value.trim();
    if (!name) { toast('请填写姓名', 'warn'); form.name.focus(); return; }
    if (it.requiresIntro && !intro) { toast('该招募要求提交简短自我介绍', 'warn'); form.intro.focus(); return; }
    var allowed = JSON.parse(form.dataset.allowed || '[]');
    if (allowed.length && grade && allowed.indexOf(grade) === -1) {
      toast('你选择的年级可能不符合参与条件，请确认后再提交（已按模拟流程继续）', 'warn');
    }
    var meta = L.signupMeta(it, it._status);
    store.addSignup(id, {
      name: name, grade: grade, contact: form.contact.value.trim(), intro: intro,
      status: meta.result, time: new Date().toISOString(),
    });
    closeSignup();
    toast(meta.resultText, 'ok');
    renderAll();
    if (!detailId) openDetail(id); else { $('#detail-body').innerHTML = detailHtml(it); }
  }

  /* ================= 举报流程 ================= */

  function openReport(id) {
    var it = itemById(id);
    if (!it) return;
    if (store.hasReported(String(id))) { toast('你已经举报过这条信息，平台正在复核', 'warn'); return; }
    $('#report-target').textContent = it.title;
    $('#report-form').reset();
    $('#report-form').dataset.id = id;
    $('#modal-report').hidden = false;
  }

  function submitReport(e) {
    e.preventDefault();
    var form = $('#report-form');
    var id = form.dataset.id;
    var reason = (form.querySelector('input[name=reason]:checked') || {}).value;
    if (!reason) { toast('请选择一个举报原因', 'warn'); return; }
    store.addReport(id, reason, form.note.value.trim());
    $('#modal-report').hidden = true;
    toast('举报已提交，平台将尽快复核，感谢你的反馈 🙏', 'ok');
    renderAll();
    var it = itemById(id);
    if (it && !$('#modal-detail').hidden) $('#detail-body').innerHTML = detailHtml(it);
  }

  /* ================= 发布流程（三步） ================= */

  function populatePublishCategory() {
    $('#publish-category').innerHTML = DATA.CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '">' + c.icon + ' ' + c.name + '</option>';
    }).join('');
  }

  function openPublish(editId) {
    publishEditId = editId || null;
    var form = $('#publish-form');
    form.reset();
    $('#publish-agree').checked = false;
    $('#publish-risk-hint').hidden = true;
    $('#publish-contact-hint').hidden = true;
    if (editId) {
      var p = store.getState().posts.filter(function (x) { return x.id === editId; })[0];
      if (!p) { toast('未找到该发布内容', 'err'); return; }
      $('#publish-title').textContent = '✏️ 编辑我的发布';
      form.kind.value = p.kind;
      form.category.value = p.category;
      form.title.value = p.title || '';
      form.summary.value = p.summary || '';
      form.start.value = p.start ? toLocalInput(p.start) : '';
      form.deadline.value = p.deadline ? toLocalInput(p.deadline) : '';
      form.place.value = p.place || '';
      form.capacity.value = p.capacity || '';
      form.audience.value = p.audience || '不限';
      form.fee.value = p.fee || '';
      form.contact.value = p.contactNote || '';
    } else {
      $('#publish-title').textContent = '✍️ 发布校园信息';
      form.kind.value = 'activity';
      form.category.value = 'social';
      form.audience.value = '不限';
      form.fee.value = '';
    }
    $('#summary-counter').textContent = (form.summary.value || '').length + ' / 200';
    goPublishStep(1);
    $('#modal-publish').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function toLocalInput(iso) {
    var d = new Date(iso);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fromLocalInput(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function closePublish() {
    $('#modal-publish').hidden = true;
    document.body.style.overflow = '';
    publishEditId = null;
  }

  function goPublishStep(n) {
    publishStep = n;
    $$('#publish-steps .step').forEach(function (el) {
      var s = Number(el.dataset.step);
      el.classList.toggle('is-active', s === n);
      el.classList.toggle('is-done', s < n);
    });
    $$('#publish-form .step-pane').forEach(function (el) {
      el.hidden = Number(el.dataset.pane) !== n;
    });
    $('#publish-prev').hidden = n === 1;
    $('#publish-next').hidden = n === 3;
    $('#publish-submit').hidden = n !== 3;
  }

  function publishFormData() {
    var form = $('#publish-form');
    var kind = form.kind.value;
    var data = {
      kind: kind,
      category: form.category.value,
      title: form.title.value.trim(),
      summary: form.summary.value.trim(),
      start: fromLocalInput(form.start.value),
      deadline: fromLocalInput(form.deadline.value),
      place: form.place.value.trim(),
      capacity: form.capacity.value ? Number(form.capacity.value) : null,
      audience: form.audience.value,
      fee: form.fee.value || null,
      contact: form.contact.value.trim(),
    };
    if (data.place === '待定' || data.place === '待确认' || data.place === '') {
      data.place = null;
      data.placeNote = '地点待定';
    }
    data.regType = data.deadline ? 'signup' : (kind === 'recruit' ? 'long' : (kind === 'resource' ? 'resource' : 'unknown'));
    return data;
  }

  function publishRiskCheck() {
    var form = $('#publish-form');
    var text = [form.title.value, form.summary.value, form.contact.value].join(' ');
    var det = L.detectRiskFromText(text);
    var hint = $('#publish-risk-hint');
    if (det.reasons.length) {
      hint.hidden = false;
      hint.innerHTML = '<strong>⚠️ 发布风险自检</strong>检测到：' + det.reasons.map(esc).join('、') +
        '。该内容发布后将被标记风险提示、降低推荐排序，并接受同学举报。请确认内容真实合规。';
    } else {
      hint.hidden = true;
    }
    var contactHint = $('#publish-contact-hint');
    var cd = L.detectRiskFromText(form.contact.value || '');
    if (cd.reasons.length) {
      contactHint.hidden = false;
      contactHint.innerHTML = '<strong>⚠️ 联系方式风险</strong>检测到「' + cd.reasons.map(esc).join('、') + '」，发布后将被标记提示。请勿诱导他人私下转账。';
    } else {
      contactHint.hidden = true;
    }
  }

  function publishReviewHtml() {
    var d = publishFormData();
    var cat = catOf(d.category);
    var rows = [
      ['类型', d.kind === 'activity' ? '活动' : d.kind === 'recruit' ? '招募 / 组队' : '资源分享'],
      ['分类', cat ? cat.icon + ' ' + cat.name : ''],
      ['标题', d.title || '（未填写）'],
      ['简介', d.summary || '（未填写）'],
      ['开始时间', d.start ? fmtDateTime(d.start) : '未定'],
      ['报名截止', d.deadline ? fmtDateTime(d.deadline) : '未设（长期）'],
      ['地点', d.place || d.placeNote || '未注明'],
      ['人数', d.capacity ? '限 ' + d.capacity + ' 人' : '不限'],
      ['面向对象', d.audience],
      ['费用', d.fee || '未注明'],
      ['联系方式', d.contact || '未提供'],
    ];
    var html = rows.map(function (r) {
      return '<div style="display:flex;gap:10px"><b style="flex:none;width:72px;color:var(--primary-deep)">' + r[0] + '</b><span>' + esc(r[1]) + '</span></div>';
    }).join('');
    html += '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted)">' +
      '发布后将作为「学生发布 · 待核验」进入发现页信息流，可被检索、筛选、收藏、报名与举报。</div>';
    return html;
  }

  function submitPublish(e) {
    e.preventDefault();
    if (!$('#publish-agree').checked) { toast('请先勾选发布须知', 'warn'); return; }
    var d = publishFormData();
    if (!d.title || !d.summary) { toast('标题和简介不能为空', 'warn'); goPublishStep(1); return; }
    var post = {
      id: publishEditId || ('u' + Date.now()),
      kind: d.kind, category: d.category, source: 'student',
      publisherLabel: '学生发布（我）',
      title: d.title, summary: d.summary,
      audience: d.audience === '不限' ? '未注明' : d.audience,
      beginner: false,
      regType: d.regType,
      deadline: d.deadline || null,
      deadlineNote: d.deadline ? null : (d.kind === 'recruit' ? '长期招募' : '截止时间未注明'),
      start: d.start || null,
      startNote: null,
      end: null,
      place: d.place || null,
      placeNote: d.place ? null : (d.placeNote || null),
      capacity: d.capacity || null,
      capacityNote: d.capacity ? '限 ' + d.capacity + ' 人' : null,
      fee: d.fee || null,
      contactNote: d.contact || null,
      extra: [
        d.start ? '时间：' + fmtDateTime(d.start) : '时间待定',
        d.place ? '地点：' + d.place : '地点：待定',
        d.capacity ? '限 ' + d.capacity + ' 人' : '',
        d.fee ? '费用：' + d.fee : '',
        d.contact ? '联系方式：' + d.contact : '',
      ].filter(Boolean),
      tags: [],
      mine: true, pendingVerification: true,
      createdAt: publishEditId ? (store.getState().posts.filter(function (x) { return x.id === publishEditId; })[0] || {}).createdAt : new Date().toISOString(),
    };
    if (publishEditId) store.updatePost(publishEditId, post);
    else store.addPost(post);
    closePublish();
    toast(publishEditId ? '修改已保存，内容已更新到信息流' : '发布成功！已进入发现页信息流（标记为待核验）', 'ok');
    // 重置筛选，让新内容立刻可见
    filters = { cat: 'all', source: 'all', status: 'all', q: '', beginner: false, sort: 'recommended' };
    $('#search-input').value = '';
    syncFilterControls();
    switchView('discover');
    renderAll();
    setTimeout(function () {
      var card = $('.card[data-id="' + post.id + '"]');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  /* ================= 视图切换与全局渲染 ================= */

  function switchView(v) {
    view = v;
    $$('.nav-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.nav === v); });
    ['discover', 'timeline', 'mine'].forEach(function (name) {
      $('#view-' + name).hidden = name !== v;
    });
    if (v === 'timeline') timelineHtml();
    if (v === 'mine') renderMine();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncFilterControls() {
    $('#filter-source').value = filters.source;
    $('#filter-status').value = filters.status;
    $('#filter-sort').value = filters.sort;
    $('#freshman-toggle').checked = filters.beginner;
  }

  function renderAll() {
    renderStats();
    renderRadar();
    renderCats();
    if (view === 'discover') renderDiscover();
    else if (view === 'timeline') timelineHtml();
    else renderMine();
  }

  /* ================= 事件绑定 ================= */

  function bindEvents() {
    // 导航
    $$('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { switchView(b.dataset.nav); });
    });
    $('.brand').addEventListener('click', function (e) { e.preventDefault(); switchView('discover'); });

    // 筛选
    $('#filter-cats').addEventListener('click', function (e) {
      var chip = e.target.closest('.cat-chip');
      if (!chip) return;
      filters.cat = chip.dataset.cat;
      renderAll();
    });
    $('#filter-source').addEventListener('change', function () { filters.source = this.value; renderAll(); });
    $('#filter-status').addEventListener('change', function () { filters.status = this.value; renderAll(); });
    $('#filter-sort').addEventListener('change', function () { filters.sort = this.value; renderAll(); });
    $('#freshman-toggle').addEventListener('change', function () {
      filters.beginner = this.checked;
      renderAll();
      toast(this.checked ? '🌱 新生模式已开启：只显示零基础 / 新生友好内容' : '已退出新生模式', 'ok');
    });

    // 搜索（防抖）
    var searchTimer = null;
    $('#search-input').addEventListener('input', function () {
      clearTimeout(searchTimer);
      var v = this.value;
      searchTimer = setTimeout(function () {
        filters.q = v.trim();
        renderDiscover();
        renderCats();
      }, 200);
    });

    // Hero 快捷入口
    $$('.hero-chips .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var q = chip.dataset.quick;
        if (q === 'urgent') { filters = Object.assign({}, filters, { status: 'urgent', cat: 'all', source: 'all', beginner: false }); }
        if (q === 'beginner') { filters = Object.assign({}, filters, { status: 'all', cat: 'all', source: 'all', beginner: true }); }
        if (q === 'long') { filters = Object.assign({}, filters, { status: 'long', cat: 'all', source: 'all', beginner: false }); }
        if (q === 'joinable') { filters = Object.assign({}, filters, { status: 'joinable', cat: 'all', source: 'all', beginner: false }); }
        filters.q = '';
        $('#search-input').value = '';
        syncFilterControls();
        renderAll();
        $('.filterbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // 卡片网格（事件委托：打开详情 / 收藏）
    $('#card-grid').addEventListener('click', function (e) {
      var fav = e.target.closest('[data-fav]');
      if (fav) {
        e.stopPropagation();
        var id = fav.dataset.fav;
        var on = store.toggleFavorite(id);
        fav.classList.toggle('is-on', on);
        fav.textContent = on ? '♥' : '♡';
        toast(on ? '已收藏，可在「我的」中查看' : '已取消收藏', 'ok');
        return;
      }
      var card = e.target.closest('.card');
      if (card) openDetail(card.dataset.id);
    });

    // 雷达 / 时间轴 / 更远列表 / 我的列表（统一委托）
    ['#radar-list', '#timeline', '#beyond-list'].forEach(function (sel) {
      $(sel).addEventListener('click', function (e) {
        var t = e.target.closest('[data-open]');
        if (t) openDetail(t.dataset.open);
      });
    });
    // 我的空间页签切换：收藏 / 我的报名 / 我的发布
    $('#mine-tabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.mine-tab');
      if (!tab) return;
      mineTab = tab.dataset.tab || 'favorites';
      $$('.mine-tab').forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.tab === mineTab);
      });
      mineListHtml();
    });
    $('#mine-list').addEventListener('click', function (e) {
      var unfav = e.target.closest('[data-unfav]');
      if (unfav) { store.toggleFavorite(unfav.dataset.unfav); renderMine(); renderAll(); toast('已取消收藏', 'ok'); return; }
      var cancel = e.target.closest('[data-cancel]');
      if (cancel) {
        var id = cancel.dataset.cancel;
        openConfirm('取消报名', '确定要取消这次报名吗？', '取消报名', function () {
          store.removeSignup(id);
          renderAll();
          toast('已取消报名', 'ok');
        });
        return;
      }
      var edit = e.target.closest('[data-edit]');
      if (edit) { openPublish(edit.dataset.edit); return; }
      var del = e.target.closest('[data-del]');
      if (del) {
        var pid = del.dataset.del;
        openConfirm('删除发布', '删除后将从信息流中移除，且无法恢复。确定删除吗？', '删除', function () {
          store.removePost(pid);
          renderAll();
          toast('已删除', 'ok');
        });
        return;
      }
      var row = e.target.closest('[data-open]');
      if (row) openDetail(row.dataset.open);
    });
    $('#mine-list').addEventListener('click', function (e) {
      if (e.target.closest('#btn-mine-publish')) { openPublish(null); }
    });

    // 详情弹窗（事件委托）
    $('#detail-body').addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      if (open) { openDetail(open.dataset.open); return; }
      var getres = e.target.closest('[data-getres]');
      if (getres) {
        var rid = getres.dataset.getres;
        store.markGotResource(rid);
        var rit = itemById(rid);
        if (rit) {
          $('#detail-body').innerHTML = detailHtml(rit);
          var gtxt = rit._status.validUntilText || '资料长期开放，请及时保存';
          toast('📁 ' + gtxt, 'ok');
        }
        renderAll();
        return;
      }
      var sign = e.target.closest('[data-sign]');
      if (sign) { openSignup(sign.dataset.sign); return; }
      var unsign = e.target.closest('[data-unsign]');
      if (unsign) {
        var id = unsign.dataset.unsign;
        openConfirm('取消报名', '确定要取消这次报名吗？', '取消报名', function () {
          store.removeSignup(id);
          var it = itemById(id);
          if (it) $('#detail-body').innerHTML = detailHtml(it);
          renderAll();
          toast('已取消报名', 'ok');
        });
        return;
      }
      var fav = e.target.closest('[data-fav]');
      if (fav) {
        var fid = fav.dataset.fav;
        var on = store.toggleFavorite(fid);
        fav.textContent = on ? '♥ 已收藏' : '♡ 收藏';
        toast(on ? '已收藏' : '已取消收藏', 'ok');
        renderAll();
        return;
      }
      var report = e.target.closest('[data-report]');
      if (report) { openReport(report.dataset.report); return; }
      var copy = e.target.closest('[data-copy]');
      if (copy) {
        var it2 = itemById(copy.dataset.copy);
        if (it2) copySummary(it2);
        return;
      }
      var edit = e.target.closest('[data-edit]');
      if (edit) { closeDetail(); openPublish(edit.dataset.edit); return; }
      var del = e.target.closest('[data-del]');
      if (del) {
        var pid = del.dataset.del;
        openConfirm('删除发布', '删除后将从信息流中移除，且无法恢复。确定删除吗？', '删除', function () {
          store.removePost(pid);
          closeDetail();
          renderAll();
          toast('已删除', 'ok');
        });
        return;
      }
    });

    // 弹窗关闭
    $$('.modal [data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.dataset.close;
        if (name === 'detail') closeDetail();
        if (name === 'signup') closeSignup();
        if (name === 'report') $('#modal-report').hidden = true;
      });
    });
    $('#publish-close').addEventListener('click', closePublish);
    $('#publish-cancel').addEventListener('click', closePublish);
    $('#confirm-close').addEventListener('click', closeConfirm);
    $('#confirm-no').addEventListener('click', closeConfirm);
    $('#modal-confirm').querySelector('.modal-backdrop').addEventListener('click', closeConfirm);

    // 发布按钮
    $('#btn-publish-top').addEventListener('click', function () { openPublish(null); });
    $('#btn-publish-fab').addEventListener('click', function () { openPublish(null); });
    $('#btn-empty-publish').addEventListener('click', function () { openPublish(null); });

    // 报名表单
    $('#signup-form').addEventListener('submit', submitSignup);
    // 发布表单
    $('#publish-form').addEventListener('submit', submitPublish);
    $('#publish-next').addEventListener('click', function () {
      if (publishStep === 1) {
        var f = $('#publish-form');
        if (!f.title.value.trim() || !f.summary.value.trim()) { toast('请先填写标题和简介', 'warn'); return; }
      }
      goPublishStep(publishStep + 1);
      if (publishStep === 3) {
        $('#publish-review').innerHTML = publishReviewHtml();
        publishRiskCheck();
      }
    });
    $('#publish-prev').addEventListener('click', function () { goPublishStep(publishStep - 1); });
    ['title', 'summary', 'contact'].forEach(function (n) {
      var el = $('#publish-form')[n];
      el.addEventListener('input', function () {
        if (n === 'summary') $('#summary-counter').textContent = this.value.length + ' / 200';
        publishRiskCheck();
      });
    });

    // 举报表单
    $('#report-form').addEventListener('submit', submitReport);

    // ESC 关闭最上层弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modals = ['#modal-confirm', '#modal-report', '#modal-publish', '#modal-signup', '#modal-detail'];
      for (var i = 0; i < modals.length; i++) {
        var m = $(modals[i]);
        if (m && !m.hidden) {
          if (modals[i] === '#modal-detail') closeDetail();
          else if (modals[i] === '#modal-signup') closeSignup();
          else if (modals[i] === '#modal-publish') closePublish();
          else m.hidden = true;
          break;
        }
      }
    });
  }

  function copySummary(it) {
    var lines = [
      '【觅活】' + it.title,
      it.summary,
      it.start ? '时间：' + fmtDateTime(it.start) : '',
      it.deadline ? '报名截止：' + fmtDateTime(it.deadline) : '',
      it.place ? '地点：' + it.place : '',
      it.audience && it.audience !== '未注明' ? '面向：' + it.audience : '',
    ].filter(Boolean);
    var text = lines.join('\n');
    function done() { toast('摘要已复制，去分享给同学吧 📋', 'ok'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  }

  /* ================= 初始化 ================= */

  function init() {
    var d = NOW;
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    $('#base-now-text').textContent = L.dateOnly(d) + '（周' + week + '）';
    populatePublishCategory();
    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
