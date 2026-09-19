'use strict';
const test = require('node:test');
const assert = require('node:assert');
const DATA = require('../js/data.js');

test('数据完整性：题目 26 条信息全部录入且编号连续', () => {
  assert.strictEqual(DATA.RAW_ITEMS.length, 26, '应恰好 26 条');
  const ids = DATA.RAW_ITEMS.map((i) => i.id);
  for (let n = 1; n <= 26; n++) {
    assert.ok(ids.includes(n), `缺少编号 ${n}`);
  }
  const seen = new Set();
  ids.forEach((id) => {
    assert.ok(!seen.has(id), `编号 ${id} 重复`);
    seen.add(id);
  });
});

test('数据完整性：每条信息字段完整', () => {
  DATA.RAW_ITEMS.forEach((it) => {
    assert.ok(it.title && it.title.length > 0, `#${it.id} 缺标题`);
    assert.ok(it.summary && it.summary.length > 0, `#${it.id} 缺摘要`);
    assert.ok(it.kind, `#${it.id} 缺 kind`);
    assert.ok(['activity', 'recruit', 'resource', 'update'].includes(it.kind), `#${it.id} kind 非法`);
    assert.ok(it.category, `#${it.id} 缺 category`);
    assert.ok(DATA.categoryById(it.category), `#${it.id} category 非法: ${it.category}`);
    assert.ok(it.source, `#${it.id} 缺 source`);
    assert.ok(DATA.sourceById(it.source), `#${it.id} source 非法: ${it.source}`);
    assert.ok(['signup', 'book', 'long', 'none', 'resource', 'unknown'].includes(it.regType), `#${it.id} regType 非法`);
    assert.ok(Array.isArray(it.extra) && it.extra.length > 0, `#${it.id} 缺要点`);
  });
});

test('数据忠实性：关键材料口径抽查', () => {
  const byId = (id) => DATA.itemById(id);
  assert.ok(byId(1).deadline === '2026-09-24T22:00:00', '#01 截止时间');
  assert.deepStrictEqual(byId(1).updates, [9], '#01 应被 #09 补充');
  assert.strictEqual(byId(9).updateOf, 1, '#09 应指向 #01');
  assert.deepStrictEqual(byId(3).updates, [20], '#03 应被 #20 补充');
  assert.strictEqual(byId(20).updateOf, 3, '#20 应指向 #03');
  assert.strictEqual(byId(5).deadline, '2026-09-20T12:00:00', '#05 截止');
  assert.strictEqual(byId(14).regType, 'book', '#14 审核制报名');
  assert.strictEqual(byId(19).waitlist, true, '#19 可候补');
  assert.strictEqual(byId(8).regType, 'long', '#08 长期招募');
  assert.strictEqual(byId(16).regType, 'long', '#16 长期招募');
  assert.strictEqual(byId(17).kind, 'resource', '#17 资料');
  assert.strictEqual(byId(21).source, 'college', '#21 学院来源');
  assert.strictEqual(byId(26).source, 'college', '#26 学院来源');
  for (const id of [22, 23, 24, 25]) {
    assert.strictEqual(byId(id).source, 'student', `#${id} 学生来源`);
  }
  assert.ok(byId(24).flags.includes('疑似非正规兼职'), '#24 风险标注');
  assert.ok(byId(25).flags.includes('疑似商业推广'), '#25 风险标注');
});

test('数据忠实性：不编造题目未提供的事实', () => {
  // 12 号费用未提供、16 号截止未注明、06 号报名时间未注明 —— 均应如实保留“未注明”口径
  assert.ok(DATA.itemById(12).feeNote, '#12 应注明费用未提供');
  assert.ok(DATA.itemById(16).deadlineNote, '#16 应注明截止未注明');
  assert.ok(DATA.itemById(6).deadlineNote, '#06 应注明报名时间未注明');
  // 未提供地点的不应写死地点
  assert.strictEqual(DATA.itemById(11).place, null, '#11 地点未提供');
  assert.strictEqual(DATA.itemById(18).place, null, '#18 地点未提供');
});

test('来源分层：学校 20 条、学院 2 条、学生 4 条', () => {
  const count = { school: 0, college: 0, student: 0 };
  DATA.RAW_ITEMS.forEach((it) => { count[it.source]++; });
  assert.deepStrictEqual(count, { school: 20, college: 2, student: 4 });
});
