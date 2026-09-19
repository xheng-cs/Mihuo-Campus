/**
 * 觅活 Mihuo Campus —— 核心逻辑层（纯函数，与 DOM 完全解耦，可单元测试）
 * -------------------------------------------------------------
 *  - 状态机：以基准日（默认 2026-09-19）动态计算每条信息的参与状态
 *  - 倒计时：报名截止 / 活动开始 / 资料提取失效 的自然语言倒计时
 *  - 风险检测：规则化识别“私加微信 / 日结兼职 / 带货推广 / 信息缺失”
 *  - 筛选 / 排序：推荐排序对“即将截止”加权、对“风险信息”降权
 *  - 时间轴：未来 7 天按天聚合活动与截止事件
 */
(function (global) {
  'use strict';

  var DATA = global.MIHUO_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;

  /** 基准日：URL ?now=YYYY-MM-DDTHH:mm 可覆盖（用于验证时间敏感逻辑） */
  function baseNow() {
    var base = (DATA && DATA.BASE_NOW) || '2026-09-19T12:00:00';
    if (typeof location !== 'undefined' && location.search) {
      var m = /[?&]now=([^&]+)/.exec(location.search);
      if (m && !isNaN(new Date(decodeURIComponent(m[1])).getTime())) {
        base = decodeURIComponent(m[1]);
      }
    }
    return new Date(base);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function dateOnly(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  var WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

  /** 自然语言日期：今天 / 明天 / 周X / 9/27 */
  function fmtDay(date, now) {
    var d0 = dateOnly(now);
    var d1 = dateOnly(date);
    if (d0 === d1) return '今天';
    var tomorrow = new Date(now.getTime() + DAY);
    if (dateOnly(tomorrow) === d1) return '明天';
    var diffDays = Math.round((new Date(d1 + 'T12:00:00') - new Date(d0 + 'T12:00:00')) / DAY);
    if (diffDays > 0 && diffDays <= 6) return '周' + WEEK_CN[date.getDay()];
    return (date.getMonth() + 1) + '/' + date.getDate();
  }

  function fmtTime(date) { return pad2(date.getHours()) + ':' + pad2(date.getMinutes()); }

  /** 距某时刻的自然语言倒计时：X天X小时 / X小时 / X分钟 / 已过 */
  function fmtCountdown(target, now) {
    var ms = target.getTime() - now.getTime();
    if (ms <= 0) return '已截止';
    if (ms >= DAY) {
      var days = Math.floor(ms / DAY);
      var hours = Math.floor((ms % DAY) / HOUR);
      return hours > 0 ? '距截止 ' + days + ' 天 ' + hours + ' 小时' : '距截止 ' + days + ' 天';
    }
    if (ms >= HOUR) return '距截止 ' + Math.floor(ms / HOUR) + ' 小时';
    return '距截止 ' + Math.max(1, Math.floor(ms / 60000)) + ' 分钟';
  }

  function fmtCountdownUntil(target, now) {
    var ms = target.getTime() - now.getTime();
    if (ms <= 0) return '已开始';
    if (ms >= DAY) {
      var days = Math.floor(ms / DAY);
      var hours = Math.floor((ms % DAY) / HOUR);
      return hours > 0 ? days + ' 天 ' + hours + ' 小时后开始' : days + ' 天后开始';
    }
    if (ms >= HOUR) return Math.floor(ms / HOUR) + ' 小时后开始';
    return Math.max(1, Math.floor(ms / 60000)) + ' 分钟后开始';
  }

  /** 距某时刻的剩余时长（用于资料提取有效期等非“开始”场景） */
  function fmtRemaining(target, now) {
    var ms = target.getTime() - now.getTime();
    if (ms <= 0) return '已失效';
    if (ms >= DAY) {
      var days = Math.floor(ms / DAY);
      var hours = Math.floor((ms % DAY) / HOUR);
      return hours > 0 ? '距失效 ' + days + ' 天 ' + hours + ' 小时' : '距失效 ' + days + ' 天';
    }
    if (ms >= HOUR) return '距失效 ' + Math.floor(ms / HOUR) + ' 小时';
    return '距失效 ' + Math.max(1, Math.floor(ms / 60000)) + ' 分钟';
  }

  /**
   * 状态机。phase 取值：
   *   closing   —— 报名中且 72 小时内截止（最紧急）
   *   open      —— 报名中
   *   long      —— 长期招募 / 长期开放
   *   book      —— 需预约（提交后等待审核）
   *   noReg     —— 无需报名
   *   unknown   —— 报名方式未注明
   *   waitlist  —— 报名已截止，但可候补
   *   closed    —— 报名已截止
   *   ongoing   —— 活动进行中
   *   ended     —— 活动已结束（可能含回放待上线）
   *   resource  —— 资料类（含提取有效期）
   *   update    —— 补充通知类
   *   risky     —— 风险信息（与上述状态叠加展示，不单独占位）
   */
  function computeStatus(item, now) {
    now = now || baseNow();
    var start = item.start ? new Date(item.start) : null;
    var end = item.end ? new Date(item.end) : null;
    var st = { phase: 'unknown', label: '状态未知', badge: 'info', badgeText: '待确认', signup: false, urgent: false };
    if (item.kind === 'update') {
      st.phase = 'update';
      st.label = '补充通知';
      st.badge = 'update';
      st.badgeText = '📌 补充通知';
      return st;
    }
    if (item.kind === 'resource') {
      st.phase = 'resource';
      st.label = '资料长期开放';
      st.badge = 'resource';
      st.badgeText = '📁 资料开放';
      st.get = true;
      if (item.resourceValidUntil) {
        var until = new Date(item.resourceValidUntil + 'T23:59:59');
        st.validUntil = until;
        st.validUntilText = until > now
          ? '网盘提取信息 ' + fmtDay(until, now) + ' 前有效（' + fmtRemaining(until, now) + '）'
          : '当前提取信息已失效，等待活动方统一更新';
        st.validExpiring = until > now && (until - now) <= 3 * DAY;
      }
      return st;
    }

    // 活动已结束（含直播回放场景）
    if (end && now > end) {
      st.phase = 'ended';
      st.label = '活动已结束';
      st.badge = 'muted';
      st.badgeText = '已结束';
      st.ended = true;
      if (item.replayUntil) {
        var replay = new Date(item.replayUntil + 'T23:59:59');
        st.replayPending = now < replay;
        st.replayText = st.replayPending
          ? '回放预计 ' + fmtDay(replay, now) + ' 上线'
          : '回放已上线，可观看';
      }
      return st;
    }

    // 直播已过但未标 end 的（04 号：直播时间 9/18）
    if (start && !end && now - start > 6 * HOUR && !item.scheduleNote) {
      st.phase = 'ended';
      st.label = '直播已结束';
      st.badge = 'muted';
      st.badgeText = '已结束';
      st.ended = true;
      if (item.replayUntil) {
        var replay2 = new Date(item.replayUntil + 'T23:59:59');
        st.replayPending = now < replay2;
        st.replayText = st.replayPending
          ? '回放预计 ' + fmtDay(replay2, now) + ' 上线'
          : '回放已上线，可观看';
      }
      return st;
    }

    // 进行中
    if (start && end && now >= start && now <= end) {
      st.phase = 'ongoing';
      st.label = '进行中';
      st.badge = 'ongoing';
      st.badgeText = '● 进行中';
      return st;
    }

    var deadline = item.deadline ? new Date(item.deadline) : null;
    var closedByDeadline = deadline && now >= deadline;
    var waitlist = closedByDeadline && item.waitlist;

    if (closedByDeadline && !waitlist) {
      st.phase = 'closed';
      st.label = '报名已截止';
      st.badge = 'muted';
      st.badgeText = '已截止';
      return st;
    }
    if (waitlist) {
      st.phase = 'waitlist';
      st.label = '报名已截止，可候补';
      st.badge = 'waitlist';
      st.badgeText = '候补可入场';
      st.signup = true;
      return st;
    }

    // 有明确截止且尚未过期：报名中 / 即将截止（72 小时窗口）
    if (deadline && now <= deadline) {
      var urgent = (deadline - now) <= 3 * DAY;
      st.phase = urgent ? 'closing' : 'open';
      st.label = urgent ? '报名中，即将截止' : '报名中';
      st.badge = urgent ? 'closing' : 'open';
      st.badgeText = urgent ? '⏰ 即将截止' : '报名中';
      st.signup = true;
      st.urgent = urgent;
      st.deadline = deadline;
      st.countdown = fmtCountdown(deadline, now);
      return st;
    }

    switch (item.regType) {
      case 'long':
        st.phase = 'long';
        st.label = '长期招募，满员即止';
        st.badge = 'long';
        st.badgeText = '长期招募';
        st.signup = true;
        return st;
      case 'book':
        st.phase = 'book';
        st.label = '需提前预约，以审核通知为准';
        st.badge = 'book';
        st.badgeText = '需预约';
        st.signup = true;
        return st;
      case 'none':
        st.phase = 'noReg';
        st.label = '无需报名';
        st.badge = 'noReg';
        st.badgeText = '无需报名';
        return st;
      case 'unknown':
        st.phase = 'unknown';
        st.label = '报名方式未注明';
        st.badge = 'info';
        st.badgeText = '报名方式未注明';
        return st;
      case 'resource':
        st.phase = 'resource';
        st.badge = 'resource';
        st.badgeText = '📁 资料开放';
        return st;
      case 'signup': // 需报名但截止时间未注明
        st.phase = 'open';
        st.label = '报名中';
        st.badge = 'open';
        st.badgeText = '报名中';
        st.signup = true;
        return st;
    }

    // 无截止、有未来活动时间且未注明报名方式 → 展示即将开始
    st.phase = start && start > now ? 'upcoming' : 'info';
    st.label = start ? '活动未开始' : '待确认';
    st.badge = 'upcoming';
    st.badgeText = '未开始';
    return st;
  }

  /** 风险检测：规则化 + 可解释。返回 { level, reasons, flags } */
  function detectRiskFromText(text) {
    var reasons = [];
    var flags = [];
    var rules = [
      { key: 'privateContact', label: '引导添加私人微信/私下联系', re: /私人微信|添加微信|加微信|私聊|扫码添加|加我/ },
      { key: 'dayPay', label: '“零门槛、日结”类兼职话术', re: /零门槛|日结|高薪|轻松赚钱|刷单|代购|押金|先交费/ },
      { key: 'promo', label: '商家优惠/购买链接等推广内容', re: /购买链接|优惠|商家|下单|折扣|返利|推广|带货/ },
      { key: 'transfer', label: '涉及转账/汇款要求', re: /转账|汇款|收款码/ },
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].re.test(text)) {
        reasons.push(rules[i].label);
        flags.push(rules[i].key);
      }
    }
    return { reasons: reasons, flags: flags };
  }

  /** 信息完整度检查：主办方/时间/地点缺失 */
  function checkCompleteness(item) {
    var missing = [];
    if (item.kind !== 'update' && item.kind !== 'resource') {
      if (!item.start && !item.scheduleNote && !item.deadline) missing.push('未注明时间');
      if (!item.place) missing.push(item.placeNote ? '地点待确认' : '未注明地点');
    }
    return missing;
  }

  /**
   * 综合风险评估。
   *  level: high（强烈警示）| medium（疑似推广）| low（信息待完善）
   * 内置材料的 24/25 号带人工标注 flags，规则检测作为补充。
   */
  function assessRisk(item) {
    var textParts = [item.title || '', item.summary || '', (item.extra || []).join(' '), item.contactNote || ''];
    var det = detectRiskFromText(textParts.join(' '));
    var flags = (item.flags || []).concat(det.flags);
    var reasons = det.reasons.slice();
    var missing = checkCompleteness(item);
    if ((item.flags || []).length > 0) {
      for (var i = 0; i < item.flags.length; i++) {
        if (reasons.indexOf(item.flags[i]) === -1) reasons.push(item.flags[i]);
      }
    }
    var level = 'none';
    if (item.flags && (item.flags.indexOf('疑似非正规兼职') !== -1 || det.flags.indexOf('privateContact') !== -1 && det.flags.indexOf('dayPay') !== -1)) {
      level = 'high';
    } else if (det.flags.indexOf('promo') !== -1 || (item.flags && item.flags.indexOf('疑似商业推广') !== -1)) {
      level = 'medium';
    } else if (missing.length > 0 || det.reasons.length > 0) {
      level = 'low';
    }
    return { level: level, reasons: reasons, flags: flags, missing: missing };
  }

  /** 关键词匹配（搜索用） */
  function matchesQuery(item, q) {
    if (!q) return true;
    var hay = [
      item.title, item.summary, item.audience || '', item.place || '', item.placeNote || '',
      (item.extra || []).join(' '), (item.tags || []).join(' '),
      item.publisherLabel || '', item.scheduleNote || '', item.deadlineNote || '',
    ].join(' ').toLowerCase();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    for (var i = 0; i < terms.length; i++) {
      if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /** 状态桶优先级（推荐排序用，越小越靠前） */
  var PHASE_ORDER = {
    closing: 0, open: 1, book: 2, long: 3, noReg: 4, resource: 5,
    unknown: 6, waitlist: 7, upcoming: 8, ongoing: 9, update: 10, closed: 11, ended: 12,
  };

  /** 推荐排序：状态桶 + 风险降权 + 补充通知排在原信息之后 */
  function sortRecommended(list) {
    return list.slice().sort(function (a, b) {
      var pa = PHASE_ORDER[a._status.phase] !== undefined ? PHASE_ORDER[a._status.phase] : 9;
      var pb = PHASE_ORDER[b._status.phase] !== undefined ? PHASE_ORDER[b._status.phase] : 9;
      if (pa !== pb) return pa - pb;
      var ra = a._risk.level === 'high' ? 3 : a._risk.level === 'medium' ? 2 : a._risk.level === 'low' ? 1 : 0;
      var rb = b._risk.level === 'high' ? 3 : b._risk.level === 'medium' ? 2 : b._risk.level === 'low' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      // 截止更近的优先
      var da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      var db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (da !== db) return da - db;
      var sa = a.start ? new Date(a.start).getTime() : Infinity;
      var sb = b.start ? new Date(b.start).getTime() : Infinity;
      if (sa !== sb) return sa - sb;
      return a.id - b.id;
    });
  }

  function sortByDeadline(list) {
    return list.slice().sort(function (a, b) {
      var da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      var db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
  }

  function sortByStart(list) {
    return list.slice().sort(function (a, b) {
      var sa = a.start ? new Date(a.start).getTime() : Infinity;
      var sb = b.start ? new Date(b.start).getTime() : Infinity;
      return sa - sb;
    });
  }

  function sortByNewest(list, now) {
    now = now || baseNow();
    return list.slice().sort(function (a, b) {
      var ta = a.createdAt ? new Date(a.createdAt).getTime() : now.getTime() - a.id * 1000;
      var tb = b.createdAt ? new Date(b.createdAt).getTime() : now.getTime() - b.id * 1000;
      return tb - ta;
    });
  }

  /** 筛选器。opts: { cat, source, status, beginner, q } */
  function filterItems(list, opts) {
    opts = opts || {};
    return list.filter(function (it) {
      if (opts.cat && opts.cat !== 'all' && it.category !== opts.cat) return false;
      if (opts.source && opts.source !== 'all' && it.source !== opts.source) return false;
      if (opts.beginner && !it.beginner) return false;
      if (!matchesQuery(it, opts.q)) return false;
      if (opts.status && opts.status !== 'all') {
        var st = it._status;
        if (opts.status === 'joinable') {
          if (st.signup !== true) return false;
        } else if (opts.status === 'urgent') {
          if (st.urgent !== true) return false;
        } else if (st.phase !== opts.status) {
          return false;
        }
      }
      return true;
    });
  }

  /** 排序入口 */
  function sortItems(list, mode, now) {
    now = now || baseNow();
    if (mode === 'deadline') return sortByDeadline(list);
    if (mode === 'start') return sortByStart(list);
    if (mode === 'newest') return sortByNewest(list, now);
    return sortRecommended(list);
  }

  /** 补充通知关联：返回更新当前条目的补充通知列表 */
  function getUpdatesOf(item, all) {
    if (!item.updates || !item.updates.length) return [];
    return all.filter(function (it) { return item.updates.indexOf(it.id) !== -1; });
  }

  /**
   * 时间轴：从基准日起 7 天，按天聚合「活动开始」与「报名截止」事件。
   * 返回 [{ date, label, events: [{ item, type:'start'|'deadline'|'resource'|'update', timeText }] }]
   */
  function buildTimeline(all, now) {
    now = now || baseNow();
    var days = [];
    var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (var i = 0; i < 7; i++) {
      var d = new Date(startOfDay.getTime() + i * DAY);
      days.push({
        date: d,
        dateKey: dateOnly(d),
        label: i === 0 ? '今天' : i === 1 ? '明天' : '周' + WEEK_CN[d.getDay()],
        sub: (d.getMonth() + 1) + '/' + d.getDate(),
        events: [],
      });
    }
    var beyond = [];
    var seenDates = {};
    for (var k = 0; k < 7; k++) seenDates[days[k].dateKey] = true;

    function dayIndexOf(d) {
      for (var i2 = 0; i2 < 7; i2++) {
        if (days[i2].dateKey === d) return i2;
      }
      return -1;
    }

    for (var j = 0; j < all.length; j++) {
      var it = all[j];
      var st = it._status || computeStatus(it, now);

      // 活动开始事件（被补充通知覆盖的事件由补充通知本身呈现，避免重复）
      if (it.start && st.phase !== 'ended' && !(it.updates && it.updates.length)) {
        var sd = new Date(it.start);
        var key = dateOnly(sd);
        var idx = dayIndexOf(key);
        var ev = {
          item: it,
          type: it.kind === 'update' ? 'update' : 'start',
          timeText: it.startNote ? '时间未定' : fmtTime(sd),
          startTime: sd.getTime(),
        };
        if (idx !== -1) days[idx].events.push(ev);
        else if (sd.getTime() >= startOfDay.getTime()) beyond.push(ev);
      }

      // 直播回放上线事件
      if (st.phase === 'ended' && it.replayUntil) {
        var rp = new Date(it.replayUntil + 'T23:59:59');
        var rkey = dateOnly(rp);
        var rix2 = dayIndexOf(rkey);
        if (rix2 !== -1) {
          days[rix2].events.push({ item: it, type: 'replay', timeText: '全天', startTime: rp.getTime() });
        } else if (rp.getTime() >= startOfDay.getTime()) {
          beyond.push({ item: it, type: 'replay', timeText: '全天', startTime: rp.getTime() });
        }
      }

      // 报名截止事件（未来 7 天内的截止点）
      if (it.deadline && (st.phase === 'open' || st.phase === 'closing' || st.phase === 'book' || st.phase === 'long' || (st.phase === 'update'))) {
        var dd = new Date(it.deadline);
        var dkey = dateOnly(dd);
        var dix = dayIndexOf(dkey);
        if (dix !== -1) {
          days[dix].events.push({
            item: it, type: 'deadline',
            timeText: fmtTime(dd),
            startTime: dd.getTime(),
          });
        } else if (dd.getTime() >= startOfDay.getTime()) {
          beyond.push({ item: it, type: 'deadline', timeText: fmtTime(dd), startTime: dd.getTime() });
        }
      }

      // 二级截止（作品提交等）
      if (it.finalDeadline && /^\d{4}-\d{2}-\d{2}/.test(it.finalDeadline)) {
        var fd = new Date(it.finalDeadline + 'T23:59:59');
        var fkey = dateOnly(fd);
        var fix2 = dayIndexOf(fkey);
        if (fix2 !== -1) {
          days[fix2].events.push({ item: it, type: 'final', timeText: '23:59', startTime: fd.getTime() });
        } else if (fd.getTime() >= startOfDay.getTime()) {
          beyond.push({ item: it, type: 'final', timeText: '全天', startTime: fd.getTime() });
        }
      }

      // 资源提取失效事件
      if (it.resourceValidUntil) {
        var rd = new Date(it.resourceValidUntil + 'T23:59:59');
        var rkey = dateOnly(rd);
        var rix = dayIndexOf(rkey);
        if (rix !== -1) {
          days[rix].events.push({ item: it, type: 'resource', timeText: '23:59', startTime: rd.getTime() });
        } else if (rd.getTime() >= startOfDay.getTime()) {
          beyond.push({ item: it, type: 'resource', timeText: '全天', startTime: rd.getTime() });
        }
      }
    }

    for (var d3 = 0; d3 < days.length; d3++) {
      days[d3].events.sort(function (a, b) { return a.startTime - b.startTime; });
    }
    beyond.sort(function (a, b) { return a.startTime - b.startTime; });

    return { days: days, beyond: beyond };
  }

  /** 首页“截止雷达”：72 小时内截止 + 已开始未结束的进行中活动 */
  function radarItems(all, now) {
    now = now || baseNow();
    var res = [];
    for (var i = 0; i < all.length; i++) {
      var st = all[i]._status;
      if (!st) continue;
      if (st.phase === 'closing' && st.deadline) {
        res.push({ item: all[i], kind: 'deadline', at: st.deadline, text: st.countdown });
      } else if (st.phase === 'ongoing') {
        res.push({ item: all[i], kind: 'ongoing', at: now, text: '正在进行' });
      }
    }
    res.sort(function (a, b) { return a.at - b.at; });
    return res;
  }

  /** 报名动作的默认文案与结果类型 */
  function signupMeta(item, st) {
    if (!st) st = computeStatus(item);
    switch (st.phase) {
      case 'closing':
      case 'open':
        return { btn: '立即报名', result: 'confirmed', resultText: '报名成功，已加入「我的报名」' };
      case 'long':
        return { btn: '提交报名意向', result: 'confirmed', resultText: '意向已提交，长期招募、满员即止，请留意招募方联系' };
      case 'book':
        return { btn: '预约报名', result: 'pendingAudit', resultText: '申请已提交，等待审核通知（提交报名表不代表最终录取）' };
      case 'waitlist':
        return { btn: '候补报名', result: 'waitlist', resultText: '已加入候补队列，是否入场以现场余位为准' };
      case 'resource':
        return { btn: '查看获取方式', result: 'got', resultText: '已为你标记获取状态，请及时保存资料' };
      default:
        return null;
    }
  }

  var API = {
    HOUR: HOUR, DAY: DAY,
    baseNow: baseNow,
    dateOnly: dateOnly,
    fmtDay: fmtDay,
    fmtTime: fmtTime,
    fmtCountdown: fmtCountdown,
    fmtCountdownUntil: fmtCountdownUntil,
    fmtRemaining: fmtRemaining,
    computeStatus: computeStatus,
    detectRiskFromText: detectRiskFromText,
    checkCompleteness: checkCompleteness,
    assessRisk: assessRisk,
    matchesQuery: matchesQuery,
    filterItems: filterItems,
    sortItems: sortItems,
    sortRecommended: sortRecommended,
    getUpdatesOf: getUpdatesOf,
    buildTimeline: buildTimeline,
    radarItems: radarItems,
    signupMeta: signupMeta,
  };

  global.MIHUO_LOGIC = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
