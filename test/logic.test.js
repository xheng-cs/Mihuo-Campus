'use strict';
const test = require('node:test');
const assert = require('node:assert');

// 构造独立的 data/logic 实例，避免污染全局
const DATA = require('../js/data.js');
global.window = global;
global.MIHUO_DATA = DATA;
require('../js/logic.js');
const L = global.MIHUO_LOGIC;

/** 装饰条目（模拟 app.js 的 decorate） */
function deco(it, now) {
  it._status = L.computeStatus(it, now);
  it._risk = L.assessRisk(it);
  return it;
}
function all(now) {
  return DATA.RAW_ITEMS.map((i) => deco(Object.assign({}, i), now));
}

const NOW = new Date('2026-09-19T12:00:00');

test('状态机：报名中 / 即将截止（72h）', () => {
  const list = all(NOW);
  const byId = (id) => list.find((i) => i.id === id);
  assert.strictEqual(byId(5)._status.phase, 'closing', '#05 9/20 12:00 截止 → 即将截止');
  assert.strictEqual(byId(7)._status.phase, 'closing', '#07 9/21 18:00 → 即将截止');
  assert.strictEqual(byId(13)._status.phase, 'closing', '#13 9/21 → 即将截止');
  assert.strictEqual(byId(3)._status.phase, 'open', '#03 9/22 18:00 → 78h 超出 72h 窗口 → 报名中');
  assert.strictEqual(byId(1)._status.phase, 'open', '#01 9/24 22:00 → 报名中');
  assert.strictEqual(byId(12)._status.phase, 'open', '#12 10/5 → 报名中');
  assert.ok(byId(5)._status.signup, '#05 可报名');
});

test('状态机：截止/候补/长期/无需报名/审核制', () => {
  const list = all(NOW);
  const byId = (id) => list.find((i) => i.id === id);
  assert.strictEqual(byId(19)._status.phase, 'waitlist', '#19 候补');
  assert.ok(byId(19)._status.signup, '#19 候补可操作');
  assert.strictEqual(byId(8)._status.phase, 'long', '#08 长期');
  assert.strictEqual(byId(16)._status.phase, 'long', '#16 长期');
  assert.strictEqual(byId(14)._status.phase, 'book', '#14 审核制');
  assert.strictEqual(byId(2)._status.phase, 'noReg', '#02 无需报名');
  assert.strictEqual(byId(10)._status.phase, 'noReg', '#10 无需报名');
  assert.strictEqual(byId(21)._status.phase, 'noReg', '#21 无需报名');
  assert.strictEqual(byId(26)._status.phase, 'noReg', '#26 无需报名');
  assert.strictEqual(byId(11)._status.phase, 'unknown', '#11 报名方式未注明');
  assert.strictEqual(byId(6)._status.phase, 'open', '#06 报名中（截止未注明）');
});

test('状态机：已结束（直播回放）/ 补充通知 / 资料', () => {
  const list = all(NOW);
  const byId = (id) => list.find((i) => i.id === id);
  assert.strictEqual(byId(4)._status.phase, 'ended', '#04 直播已结束');
  assert.ok(byId(4)._status.replayPending, '#04 回放待上线（9/20）');
  assert.strictEqual(byId(9)._status.phase, 'update', '#09 补充通知');
  assert.strictEqual(byId(20)._status.phase, 'update', '#20 补充通知');
  assert.strictEqual(byId(17)._status.phase, 'resource', '#17 资料');
  assert.ok(byId(17)._status.validUntilText.includes('距失效'), '#17 显示提取剩余有效期');
  assert.ok(byId(17)._status.validUntilText.includes('周二'), '#17 9/22 前有效');
});

test('状态机：基准日变化后状态切换（回放上线 / 报名截止）', () => {
  const day20 = new Date('2026-09-20T12:00:00');
  const l20 = all(day20);
  const byId = (id) => l20.find((i) => i.id === id);
  assert.strictEqual(byId(4)._status.replayPending, true, '9/20 当天回放仍预计上线');
  const day21 = new Date('2026-09-21T12:00:00');
  const l21 = all(day21);
  assert.strictEqual(l21.find((i) => i.id === 4)._status.replayPending, false, '9/21 后回放已上线');
  assert.strictEqual(byId(5)._status.phase, 'closed', '9/20 12:00 后 #05 截止');
  assert.strictEqual(byId(19)._status.phase, 'waitlist', '#19 9/20 12:00 未开场，仍可候补');
  assert.strictEqual(byId(21)._status.phase, 'noReg', '#21 今晚开场，无需报名');
  const day22 = new Date('2026-09-22T12:00:00');
  const l22 = all(day22);
  const d22 = (id) => l22.find((i) => i.id === id);
  assert.strictEqual(d22(3)._status.phase, 'closing', '9/22 12:00 #03 距 18:00 截止仅剩数小时');
  const day22e = new Date('2026-09-22T19:00:00');
  const l22e = all(day22e);
  assert.strictEqual(l22e.find((i) => i.id === 3)._status.phase, 'closed', '9/22 18:00 后 #03 已截止');
  assert.strictEqual(l22e.find((i) => i.id === 20)._status.phase, 'update', '#20 补充通知不受影响');
  assert.strictEqual(d22(17)._status.phase, 'resource', '#17 仍为资料');
  assert.ok(d22(17)._status.validUntilText.includes('已失效') === false || d22(17)._status.validUntilText.includes('前有效'), '#17 9/22 当天仍有效');
  const day23 = new Date('2026-09-23T00:00:00');
  const l23 = all(day23);
  const d23 = (id) => l23.find((i) => i.id === id);
  assert.ok(d23(17)._status.validUntilText.includes('已失效'), '9/23 提取信息已失效');
});

test('倒计时文案', () => {
  assert.strictEqual(L.fmtCountdown(new Date('2026-09-20T12:00:00'), NOW), '距截止 1 天');
  assert.strictEqual(L.fmtCountdown(new Date('2026-09-22T18:00:00'), NOW), '距截止 3 天 6 小时');
  assert.strictEqual(L.fmtCountdown(new Date('2026-09-19T14:00:00'), NOW), '距截止 2 小时');
  assert.strictEqual(L.fmtCountdown(new Date('2026-09-19T12:30:00'), NOW), '距截止 30 分钟');
  assert.strictEqual(L.fmtCountdown(new Date('2026-09-18T12:00:00'), NOW), '已截止');
  assert.strictEqual(L.fmtRemaining(new Date('2026-09-22T23:59:59'), NOW), '距失效 3 天 11 小时');
  assert.strictEqual(L.fmtDay(new Date('2026-09-19T19:00:00'), NOW), '今天');
  assert.strictEqual(L.fmtDay(new Date('2026-09-20T19:00:00'), NOW), '明天');
  assert.strictEqual(L.fmtDay(new Date('2026-09-21T19:00:00'), NOW), '周一');
  assert.strictEqual(L.fmtDay(new Date('2026-09-27T08:30:00'), NOW), '9/27');
});

test('风险检测：24/25 号被识别为高风险 / 疑似推广', () => {
  const list = all(NOW);
  const r24 = list.find((i) => i.id === 24)._risk;
  const r25 = list.find((i) => i.id === 25)._risk;
  assert.strictEqual(r24.level, 'high', '#24 高风险');
  assert.ok(r24.reasons.some((r) => r.includes('微信')), '#24 私加微信特征');
  assert.ok(r24.reasons.some((r) => r.includes('日结')), '#24 日结特征');
  assert.strictEqual(r25.level, 'medium', '#25 疑似推广');
  assert.ok(r25.reasons.some((r) => r.includes('推广') || r.includes('购买链接')), '#25 推广特征');
});

test('风险检测：信息待完善提示', () => {
  const list = all(NOW);
  const r22 = list.find((i) => i.id === 22)._risk;
  const r11 = list.find((i) => i.id === 11)._risk;
  assert.strictEqual(r22.level, 'low', '#22 场地待确认 → 低风险提示');
  assert.strictEqual(r11.level, 'low', '#11 地点/报名方式未注明 → 低风险提示');
  const safe = list.find((i) => i.id === 2)._risk;
  assert.strictEqual(safe.level, 'none', '#02 无风险');
});

test('风险检测：规则对用户输入生效（防新发布内容带风险）', () => {
  const det = L.detectRiskFromText('零门槛日结兼职，加微信 xxx 了解');
  assert.ok(det.reasons.length >= 2, '兼职+日结+微信 应触发多条规则');
  assert.ok(det.flags.includes('privateContact'), '触发私加微信规则');
  assert.ok(det.flags.includes('dayPay'), '触发日结规则');
  const clean = L.detectRiskFromText('周六下午羽毛球场约球，AA，欢迎来玩');
  assert.strictEqual(clean.reasons.length, 0, '正常内容不应误报');
});

test('筛选：分类 / 来源 / 新生模式 / 状态', () => {
  const list = all(NOW);
  assert.strictEqual(L.filterItems(list, { cat: 'competition' }).length, 3, '比赛竞赛 3 条');
  assert.strictEqual(L.filterItems(list, { source: 'student' }).length, 4, '学生发布 4 条');
  assert.strictEqual(L.filterItems(list, { source: 'college' }).length, 2, '学院发布 2 条');
  const beginner = L.filterItems(list, { beginner: true });
  assert.ok(beginner.length >= 6, '零基础友好条目数');
  assert.ok(beginner.every((i) => i.beginner), '全部满足 beginner');
  assert.strictEqual(L.filterItems(list, { status: 'joinable' }).every((i) => i._status.signup), true, 'joinable 全部可报名');
  assert.ok(L.filterItems(list, { q: 'AI' }).length >= 5, '关键词 AI 命中多条');
});

test('推荐排序：即将截止靠前、高风险降权、补充通知靠近原信息', () => {
  const list = all(NOW);
  const sorted = L.sortRecommended(list);
  const first = sorted[0]._status.phase;
  assert.strictEqual(first, 'closing', '最优先展示即将截止');
  const idx24 = sorted.findIndex((i) => i.id === 24);
  const idx2 = sorted.findIndex((i) => i.id === 2);
  assert.ok(idx24 > idx2, '高风险 #24 应排在正常信息之后');
  const idx1 = sorted.findIndex((i) => i.id === 1);
  const idx9 = sorted.findIndex((i) => i.id === 9);
  assert.ok(idx1 < idx9, '补充通知 #09 排在原信息 #01 之后');
});

test('时间轴：7 天聚合 + 截止事件 + 回放事件 + 更远分组', () => {
  const list = all(NOW);
  const tl = L.buildTimeline(list, NOW);
  assert.strictEqual(tl.days.length, 7, '7 天');
  const d0 = tl.days[0]; // 9/19 今天（按时间排序）
  const titles = d0.events.map((e) => e.item.id);
  assert.deepStrictEqual(titles, [10, 2, 18], '今天：15:00 交流会 / 19:00 公开课 / 19:30 网安小组');
  const d1 = tl.days[1]; // 9/20
  const kinds = d1.events.map((e) => e.type);
  assert.ok(kinds.includes('deadline'), '9/20 有报名截止事件');
  assert.ok(kinds.includes('replay'), '9/20 有回放上线事件');
  assert.ok(d1.events.some((e) => e.item.id === 19), '9/20 路演');
  // 01 的开始事件应被补充通知替代（不重复出现）
  const allEvents = tl.days.flatMap((d) => d.events);
  const allStartEvents = allEvents.filter((e) => e.type === 'start');
  assert.ok(!allStartEvents.some((e) => e.item.id === 1), '#01 开始事件不重复');
  assert.ok(allEvents.some((e) => e.item.id === 9 && e.type === 'update'), '#09 更新事件在时间轴');
  // 更远：9/27 志愿活动、10/5 挑战赛截止
  assert.ok(tl.beyond.some((e) => e.item.id === 5), '更远分组包含 #05');
  assert.ok(tl.beyond.some((e) => e.item.id === 12), '更远分组包含 #12 截止');
});

test('截止雷达：72h 内截止条目正确', () => {
  const list = all(NOW);
  const radar = L.radarItems(list, NOW);
  const ids = radar.map((r) => r.item.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [5, 7, 13], '雷达 = 72h 内截止的 #05 #07 #13');
  assert.ok(!ids.includes(1), '雷达不含 72h 外的 #01');
  assert.ok(!ids.includes(3), '雷达不含 78h 的 #03');
  radar.forEach((r) => assert.strictEqual(r.kind, 'deadline'));
});

test('报名动作文案：各状态对应正确结果', () => {
  const list = all(NOW);
  const byId = (id) => list.find((i) => i.id === id);
  assert.strictEqual(L.signupMeta(byId(5)).result, 'confirmed');
  assert.strictEqual(L.signupMeta(byId(14)).result, 'pendingAudit');
  assert.strictEqual(L.signupMeta(byId(19)).result, 'waitlist');
  assert.strictEqual(L.signupMeta(byId(8)).result, 'confirmed');
  assert.strictEqual(L.signupMeta(byId(2)), null, '无需报名的无报名按钮');
  assert.strictEqual(L.signupMeta(byId(4)), null, '已结束的不可报名');
  assert.strictEqual(L.signupMeta(byId(17)).result, 'got');
});

test('补充通知关联查询', () => {
  const list = all(NOW);
  const up1 = L.getUpdatesOf(list.find((i) => i.id === 1), list);
  assert.deepStrictEqual(up1.map((u) => u.id), [9]);
  const up3 = L.getUpdatesOf(list.find((i) => i.id === 3), list);
  assert.deepStrictEqual(up3.map((u) => u.id), [20]);
});

test('用户发布内容也能进入状态机与时间轴', () => {
  const post = {
    id: 'u_1', title: '测试组局', summary: '周六下午篮球', kind: 'activity',
    category: 'social', source: 'student', regType: 'unknown',
    deadline: null, start: '2026-09-22T16:00:00', place: null, mine: true,
  };
  deco(post, NOW);
  assert.strictEqual(post._status.phase, 'unknown', '无截止未开始 → 报名方式未注明');
  const list = all(NOW).concat([post]);
  const tl = L.buildTimeline(list, NOW);
  const found = tl.days.flatMap((d) => d.events).some((e) => e.item.id === 'u_1');
  assert.ok(found, '用户发布进入时间轴');
});
