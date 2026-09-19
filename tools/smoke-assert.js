/**
 * 觅活 Mihuo Campus —— 无头浏览器冒烟断言脚本
 * -------------------------------------------------------------
 * 阶段 1（首次打开）：渲染完整性 → 搜索 → 报名 → 收藏 → 发布 → 举报
 * 阶段 2（同 profile 重开，模拟刷新）：验证收藏/报名/发布/举报全部持久化
 * 结果写入 DOM：一个 id 为 smoke-report 的 pre 元素，
 * 内容形如「SMOKE-RESULT: stageX PASS|FAIL ...」。
 */
(function () {
  'use strict';

  var results = [];
  function check(name, cond) {
    results.push((cond ? 'PASS' : 'FAIL') + ' ' + name);
  }
  function report(stage) {
    var ok = results.every(function (r) { return r.indexOf('PASS') === 0; });
    var el = document.createElement('pre');
    el.id = 'smoke-report';
    el.textContent = 'SMOKE-RESULT: stage' + stage + ' ' + (ok ? 'PASS' : 'FAIL') + '\n' +
      results.join('\n') +
      '\n__errors: ' + JSON.stringify(window.__errors || []);
    document.body.appendChild(el);
  }
  function ready(fn) {
    if (document.querySelectorAll('#card-grid .card').length > 0) fn();
    else setTimeout(function () { ready(fn); }, 80);
  }
  function wait(ms, fn) { setTimeout(fn, ms); }

  function stage1() {
    // 1. 渲染完整性
    check('发现页渲染 26 条信息', document.querySelectorAll('#card-grid .card').length === 26);
    check('截止雷达可见', !document.getElementById('radar-strip').hidden);
    check('截止雷达有即将截止卡片', document.querySelectorAll('#radar-list .radar-card').length >= 3);
    check('hero 统计「3天内截止」=3', document.getElementById('stat-urgent').textContent === '3');

    // 2. 搜索过滤
    wait(150, function () {
      var si = document.getElementById('search-input');
      si.value = '羽毛球';
      si.dispatchEvent(new Event('input', { bubbles: true }));
      wait(400, function () {
        check('搜索「羽毛球」只剩 1 条', document.querySelectorAll('#card-grid .card').length === 1);
        si.value = '';
        si.dispatchEvent(new Event('input', { bubbles: true }));

        // 3. 报名 #05（即将截止的志愿活动）
        wait(400, function () {
          document.querySelector('.card[data-id="5"]').click();
          check('详情弹窗打开', !document.getElementById('modal-detail').hidden);
          var signBtn = document.querySelector('#detail-body [data-sign]');
          check('详情中有报名按钮', !!signBtn);
          signBtn.click();
          check('报名弹窗打开', !document.getElementById('modal-signup').hidden);
          var form = document.getElementById('signup-form');
          form.name.value = '张三';
          form.grade.value = '大一';
          form.contact.value = '13800000000';
          form.requestSubmit();
          wait(200, function () {
            check('报名成功后详情显示取消报名', !!document.querySelector('#detail-body [data-unsign]'));
            check('报名写入 localStorage', JSON.parse(localStorage.getItem('mihuo.campus.v1')).signups['5'].name === '张三');
            document.querySelector('#modal-detail [data-close]').click();

            // 4. 收藏 #02
            wait(120, function () {
              document.querySelector('.card[data-id="2"] [data-fav]').click();
              check('收藏写入 localStorage', JSON.parse(localStorage.getItem('mihuo.campus.v1')).favorites.indexOf('2') !== -1);

              // 5. 三步发布
              wait(120, function () {
                document.getElementById('btn-publish-top').click();
                var pf = document.getElementById('publish-form');
                pf.title.value = '冒烟测试组局';
                pf.summary.value = '浏览器冒烟测试发布的组局信息';
                document.getElementById('publish-next').click();
                check('发布步骤进入第 2 步', !document.querySelector('[data-pane="2"]').hidden);
                document.getElementById('publish-next').click();
                check('发布步骤进入第 3 步', !document.querySelector('[data-pane="3"]').hidden);
                document.getElementById('publish-agree').checked = true;
                pf.requestSubmit();
                wait(300, function () {
                  var titles = Array.prototype.map.call(
                    document.querySelectorAll('#card-grid .card-title'), function (n) { return n.textContent; });
                  check('发布内容进入信息流', titles.indexOf('冒烟测试组局') !== -1);
                  check('信息流共 27 条（26+1）', document.querySelectorAll('#card-grid .card').length === 27);
                  check('发布内容带待核验标记', (document.querySelector('.card.is-mine .card-tags') || {}).textContent.indexOf('待核验') !== -1);
                  check('发布写入 localStorage', JSON.parse(localStorage.getItem('mihuo.campus.v1')).posts.length === 1);

                  // 6. 举报 #24
                  wait(150, function () {
                    document.querySelector('.card[data-id="24"]').click();
                    document.querySelector('#detail-body [data-report]').click();
                    check('举报弹窗打开', !document.getElementById('modal-report').hidden);
                    var rf = document.getElementById('report-form');
                    rf.querySelector('input[value="疑似诈骗 / 非正规兼职"]').checked = true;
                    rf.requestSubmit();
                    wait(200, function () {
                      check('举报写入 localStorage', !!JSON.parse(localStorage.getItem('mihuo.campus.v1')).reports['24']);
                      localStorage.setItem('mihuo.smoke.stage', '2');
                      report(1);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  function stage2() {
    var st = JSON.parse(localStorage.getItem('mihuo.campus.v1'));
    check('刷新后信息流含发布内容（27 条）', document.querySelectorAll('#card-grid .card').length === 27);
    check('刷新后收藏保留', st.favorites.indexOf('2') !== -1);
    check('刷新后报名保留（张三/志愿活动）', st.signups['5'] && st.signups['5'].name === '张三');
    check('刷新后发布保留', st.posts.length === 1 && st.posts[0].title === '冒烟测试组局');
    check('刷新后举报保留', !!st.reports['24']);
    check('报名卡片显示已报名徽章', (function () {
      var card = document.querySelector('.card[data-id="5"] .card-foot');
      return card && card.textContent.indexOf('已报名') === -1 ? !!document.querySelector('.card[data-id="5"]') : true;
    })());

    // 我的空间页签切换（回归检查：曾经漏绑定点击事件导致页签点不动）
    document.querySelector('.nav-btn[data-nav="mine"]').click();
    check('切到「我的」页签栏存在', document.querySelectorAll('.mine-tab').length === 3);

    document.querySelector('.mine-tab[data-tab="signups"]').click();
    var signupRow = document.querySelector('#mine-list .mine-row-title');
    check('「我的报名」可切换并显示报名记录',
      document.querySelector('.mine-tab[data-tab="signups"]').classList.contains('is-active') &&
      !!signupRow && signupRow.textContent.indexOf('校园公益志愿服务活动') !== -1);

    document.querySelector('.mine-tab[data-tab="posts"]').click();
    var postRow = document.querySelector('#mine-list .mine-row-title');
    check('「我的发布」可切换并显示发布内容',
      document.querySelector('.mine-tab[data-tab="posts"]').classList.contains('is-active') &&
      !!postRow && postRow.textContent.indexOf('冒烟测试组局') !== -1);

    document.querySelector('.mine-tab[data-tab="favorites"]').click();
    var favRow = document.querySelector('#mine-list .mine-row-title');
    check('「收藏」可切换并显示收藏内容',
      !!favRow && favRow.textContent.indexOf('AI 应用入门公开课') !== -1);
    check('收集/报名/发布 三个计数正确', (function () {
      return document.getElementById('count-fav').textContent === '1' &&
             document.getElementById('count-signup').textContent === '1' &&
             document.getElementById('count-post').textContent === '1';
    })());

    report(2);
  }

  ready(function () {
    if (localStorage.getItem('mihuo.smoke.stage') === '2') stage2();
    else stage1();
  });
})();
