/**
 * 觅活 Mihuo Campus —— 校园信息数据层
 * -------------------------------------------------------------
 * 全部 26 条信息来自考核题目「四、校园活动与机会信息」，
 * 仅做结构化整理与分类，未增补题目未提供的事实。
 * 时间基准日（产品视角的“今天”）默认 2026-09-19 12:00（考核当日）。
 */
(function (global) {
  'use strict';

  /** 产品时间基准：考核当日中午。可用 URL ?now= 覆盖（见 logic.js）。 */
  var BASE_NOW = '2026-09-19T12:00:00';

  /** 分类定义：id / 名称 / 图标 / 主题色 */
  var CATEGORIES = [
    { id: 'competition', name: '比赛竞赛', icon: '🏆', color: '#F59E0B' },
    { id: 'lecture',     name: '讲座分享', icon: '🎤', color: '#6366F1' },
    { id: 'learning',    name: '学习成长', icon: '📚', color: '#10B981' },
    { id: 'recruit',     name: '招募机会', icon: '🤝', color: '#8B5CF6' },
    { id: 'volunteer',   name: '志愿公益', icon: '❤️', color: '#F43F5E' },
    { id: 'social',      name: '兴趣社交', icon: '🎉', color: '#0EA5E9' },
  ];

  /** 来源分级：可信度 学校 > 学院 > 学生 */
  var SOURCES = [
    { id: 'school',  name: '校级发布', short: '校级',   trust: 3, color: '#2563EB' },
    { id: 'college', name: '学院发布', short: '学院',   trust: 2, color: '#0D9488' },
    { id: 'student', name: '学生发布', short: '学生',   trust: 1, color: '#D97706' },
  ];

  /**
   * 字段约定：
   *  - kind:        activity 活动 | recruit 招募 | resource 资料 | update 补充通知
   *  - category:    见 CATEGORIES
   *  - source:      school | college | student
   *  - regType:     signup 报名 | book 预约(审核) | long 长期招募 | none 无需报名
   *                 | resource 资料 | unknown 报名方式未注明
   *  - deadline:    报名/登记截止（ISO 或 null；null 时看 deadlineNote）
   *  - finalDeadline / finalDeadlineNote: 二级截止（如作品提交）
   *  - start / end: 活动时间（ISO 或 null）
   *  - scheduleNote: 周期性安排说明（如“每周三 19:30，共 6 周”）
   *  - place: 地点；placeNote: 地点待定等说明
   *  - capacity / capacityNote: 人数限制
   *  - fee: 费用（如 'AA'）；feeNote: 费用未提供等说明
   *  - updates: [补充通知 id]（被哪条补充）
   *  - updateOf: 补充通知指向的原信息 id
   *  - waitlist: 截止后是否接受候补（如 19 号路演）
   *  - requiresIntro: 报名是否需要简短自我介绍
   *  - audience: 面向对象（题目原文口径）
   *  - beginner: 是否零基础/新生友好
   *  - extra: 题目原文要点（产品直接展示的条目）
   *  - notes: 产品对缺失/冲突信息的处理说明（对用户负责的呈现）
   *  - tags: 检索标签
   */
  var RAW_ITEMS = [
    {
      id: 1,
      title: '“蓝桥杯”程序设计校内训练营',
      kind: 'activity', category: 'learning', source: 'school',
      summary: '面向全校学生的程序设计训练营，零基础也可参加，为“蓝桥杯”备赛提供系统训练。',
      audience: '全校学生', beginner: true,
      regType: 'signup', deadline: '2026-09-24T22:00:00',
      start: '2026-09-21T19:30:00',
      scheduleNote: '原计划 9/20 起每周六 19:00；按补充通知，首次训练调整为 9/21 19:30，此后场次安排请留意后续通知。',
      place: '实验楼 A402（首次训练）',
      updates: [9],
      extra: [
        '报名截止：9/24 22:00',
        '面向全校学生，零基础可参加',
        '原计划 9/20 起每周六 19:00 训练',
        '补充通知：首次训练改为 9/21 19:30，地点改至实验楼 A402',
        '已报名同学无需重复提交，报名截止时间不变',
      ],
      notes: [
        '原通知（9/20 起每周六）与补充通知（首次 9/21 19:30）的时间口径不一致，已合并展示，具体安排请以最新补充通知为准。',
      ],
      tags: ['训练营', '蓝桥杯', '零基础', '备赛'],
    },
    {
      id: 2,
      title: 'AI 应用入门公开课',
      kind: 'activity', category: 'lecture', source: 'school',
      summary: '面向全校学生的 AI 应用入门课，无需报名，今晚开讲，预计 90 分钟。',
      audience: '全校学生', beginner: true,
      regType: 'none',
      start: '2026-09-19T19:00:00', end: '2026-09-19T20:30:00',
      place: '计算机学院教学楼',
      extra: [
        '时间：9/19 19:00，预计 90 分钟',
        '地点：计算机学院教学楼',
        '面向全校学生，无需报名',
      ],
      tags: ['AI', '入门', '公开课'],
    },
    {
      id: 3,
      title: '大学生创新创业项目团队招募',
      kind: 'recruit', category: 'recruit', source: 'school',
      summary: '创新创业项目团队招募开发、设计、材料方向成员，每周需稳定投入 4 小时以上，需提交简短自我介绍。',
      audience: '未注明',
      regType: 'signup', deadline: '2026-09-22T18:00:00',
      requiresIntro: true,
      updates: [20],
      extra: [
        '招募开发、设计、材料方向成员',
        '每周需稳定投入 4 小时以上',
        '报名截止：9/22 18:00',
        '需提交简短自我介绍',
        '补充说明：开发方向名额已满，现主要补充设计与材料成员',
        '此前已投递者无需重复提交',
      ],
      tags: ['创新创业', '组队', '招募'],
    },
    {
      id: 4,
      title: '数学建模竞赛经验分享会',
      kind: 'activity', category: 'lecture', source: 'school',
      summary: '数学建模经验分享直播已于 9/18 晚结束，回放预计 9/20 上传，不限专业。',
      audience: '全校学生（不限专业）',
      regType: 'unknown',
      start: '2026-09-18T19:30:00',
      replayUntil: '2026-09-20',
      extra: [
        '直播时间：9/18 19:30，已结束',
        '不限专业',
        '活动方预计 9/20 上传回放',
      ],
      notes: [
        '直播已结束，回放预计 9/20 上线，可先收藏，回放开放后再次查看。',
      ],
      tags: ['数学建模', '分享会', '回放'],
    },
    {
      id: 5,
      title: '校园公益志愿服务活动',
      kind: 'activity', category: 'volunteer', source: 'school',
      summary: '公益志愿服务活动，9/27 全天约 8 小时，需提前到场签到，报名 9/20 中午截止。',
      audience: '未注明',
      regType: 'signup', deadline: '2026-09-20T12:00:00',
      start: '2026-09-27T08:30:00', end: '2026-09-27T17:00:00',
      extra: [
        '活动时间：9/27 8:30—17:00',
        '预计服务 8 小时',
        '报名截止：9/20 12:00',
        '需提前到场签到',
      ],
      tags: ['志愿', '公益', '服务'],
    },
    {
      id: 6,
      title: 'Web 开发零基础学习小组',
      kind: 'activity', category: 'learning', source: 'school',
      summary: '面向零基础学生的 Web 开发学习小组，共 6 周，限 30 人，满员即止。',
      audience: '零基础学生', beginner: true,
      regType: 'signup', deadline: null,
      deadlineNote: '报名时间未注明，满员即止',
      start: '2026-09-23T19:30:00',
      scheduleNote: '9/23 起每周三 19:30，共 6 周',
      place: null,
      capacity: 30, capacityNote: '限 30 人',
      extra: [
        '9/23 起每周三 19:30 开展，共 6 周',
        '面向零基础学生',
        '限 30 人',
        '报名时间未注明，满员即止',
      ],
      tags: ['Web', '零基础', '学习小组'],
    },
    {
      id: 7,
      title: 'AI 创新应用挑战赛',
      kind: 'activity', category: 'competition', source: 'school',
      summary: '2—4 人组队的 AI 创新应用比赛：先意向登记，10/20 提交作品。',
      audience: '未注明',
      regType: 'signup', deadline: '2026-09-21T18:00:00',
      deadlineNote: '校内意向登记截止',
      finalDeadline: '2026-10-20', finalDeadlineNote: '作品提交截止（具体时刻未注明）',
      extra: [
        '2—4 人组队参赛',
        '9/21 18:00 前完成校内意向登记',
        '10/20 提交作品',
        '意向登记不等同于最终作品提交',
      ],
      tags: ['AI', '挑战赛', '组队'],
    },
    {
      id: 8,
      title: '校园软件项目组招募',
      kind: 'recruit', category: 'recruit', source: 'school',
      summary: '开发校园实用工具的软件项目组，面向大一、大二学生，长期招募、满员即止。',
      audience: '大一、大二学生',
      regType: 'long', deadline: null,
      extra: [
        '开发校园实用工具',
        '面向大一、大二学生',
        '希望成员了解 Git 基本操作',
        '每周预计投入 5 小时',
        '长期招募，满员即止',
      ],
      tags: ['软件开发', '项目组', '长期招募', 'Git'],
    },
    {
      id: 9,
      title: '程序设计训练营补充通知',
      kind: 'update', category: 'learning', source: 'school',
      summary: '训练营场地调整：首次训练改为 9/21 19:30，地点改至实验楼 A402。',
      audience: '已报名训练营的同学',
      regType: 'none',
      updateOf: 1,
      start: '2026-09-21T19:30:00',
      place: '实验楼 A402',
      extra: [
        '因场地调整，首次训练改为 9/21 19:30',
        '地点改至实验楼 A402',
        '已报名同学无需重复提交',
        '报名截止时间不变（9/24 22:00）',
      ],
      tags: ['训练营', '补充通知', '场地调整'],
    },
    {
      id: 10,
      title: '前端开发经验交流会',
      kind: 'activity', category: 'lecture', source: 'school',
      summary: '前端开发经验交流，今天下午线下 A201，同步线上直播，无需报名。',
      audience: '未注明',
      regType: 'none',
      start: '2026-09-19T15:00:00', end: '2026-09-19T16:30:00',
      place: '线下 A201，同步线上直播',
      extra: [
        '时间：9/19 15:00—16:30',
        '线下 A201，同步线上直播',
        '无需报名',
      ],
      tags: ['前端', '交流', '直播'],
    },
    {
      id: 11,
      title: '大学生科研入门分享会',
      kind: 'activity', category: 'lecture', source: 'school',
      summary: '介绍论文检索、学生科研项目和导师联系方法的分享会，面向全校学生。',
      audience: '全校学生',
      regType: 'unknown',
      start: '2026-09-21T19:00:00', end: '2026-09-21T20:30:00',
      place: null,
      extra: [
        '时间：9/21 19:00—20:30',
        '介绍论文检索、学生科研项目和导师联系方法',
        '面向全校学生',
      ],
      tags: ['科研', '分享会', '论文'],
    },
    {
      id: 12,
      title: '全国高校计算机能力挑战赛',
      kind: 'activity', category: 'competition', source: 'school',
      summary: '面向本科生的个人计算机能力竞赛，10/5 报名截止，费用信息未提供。',
      audience: '本科生',
      regType: 'signup', deadline: '2026-10-05T23:59:00',
      feeNote: '具体费用信息未提供',
      extra: [
        '面向本科生，个人参赛',
        '报名截止：10/5 23:59',
        '具体费用信息未提供',
      ],
      tags: ['计算机', '竞赛', '个人赛'],
    },
    {
      id: 13,
      title: '科研助理招募',
      kind: 'recruit', category: 'recruit', source: 'school',
      summary: '协助数据整理和实验工作的科研助理岗位，仅限大二及以上学生，9/21 截止。',
      audience: '大二及以上学生',
      regType: 'signup', deadline: '2026-09-21T23:59:00',
      deadlineNote: '截止当日，具体时刻未注明',
      extra: [
        '协助数据整理和实验工作',
        '仅限大二及以上学生',
        '每周预计投入 6 小时',
        '9/21 截止报名',
      ],
      tags: ['科研助理', '招募', '实验室'],
    },
    {
      id: 14,
      title: 'Git 与 GitHub 零基础工作坊',
      kind: 'activity', category: 'lecture', source: 'school',
      summary: '主要面向大一新生的 Git 与 GitHub 工作坊，限 40 人，需提前预约、以审核通知为准。',
      audience: '主要面向大一新生', beginner: true,
      regType: 'book', deadline: null,
      deadlineNote: '需提前预约，具体截止时间未注明',
      start: '2026-09-21T19:00:00', end: '2026-09-21T20:30:00',
      place: null,
      capacity: 40, capacityNote: '限 40 人',
      extra: [
        '时间：9/21 19:00—20:30',
        '主要面向大一新生',
        '限 40 人，需提前预约',
        '提交报名表不代表最终录取，以审核通知为准',
      ],
      tags: ['Git', 'GitHub', '零基础', '工作坊'],
    },
    {
      id: 15,
      title: 'AI 应用创意挑战',
      kind: 'activity', category: 'competition', source: 'school',
      summary: '先交创意方案再交作品的 AI 挑战，个人或团队均可，展示环节后可再组队。',
      audience: '未注明',
      regType: 'signup', deadline: '2026-09-23T23:59:00',
      deadlineNote: '创意方案提交截止',
      finalDeadline: '2026-09-30', finalDeadlineNote: '最终作品提交（具体时刻未注明）',
      extra: [
        '9/23 23:59 前提交创意方案',
        '9/30 前提交最终作品',
        '允许个人或团队参加',
        '进入展示环节后可再组队',
      ],
      tags: ['AI', '创意', '挑战'],
    },
    {
      id: 16,
      title: '校园摄影志愿者招募',
      kind: 'recruit', category: 'volunteer', source: 'school',
      summary: '长期招募校园大型活动摄影志愿者，有摄影设备者优先但不作硬性要求。',
      audience: '未注明',
      regType: 'long', deadline: null,
      deadlineNote: '报名截止时间未注明',
      extra: [
        '长期招募',
        '参与校内大型活动摄影',
        '有摄影设备者优先，但不作硬性要求',
      ],
      tags: ['摄影', '志愿者', '长期招募'],
    },
    {
      id: 17,
      title: 'Python 程序设计学习资料合集',
      kind: 'resource', category: 'learning', source: 'school',
      summary: '含课程、练习和项目案例的 Python 资料，长期开放；当前网盘提取信息有效至 9/22。',
      audience: '全校学生', beginner: true,
      regType: 'resource', deadline: null,
      resourceValidUntil: '2026-09-22',
      extra: [
        '包含课程、练习和项目案例',
        '资料长期开放',
        '当前网盘提取信息有效至 9/22，后续将统一更新',
      ],
      tags: ['Python', '资料', '网盘'],
    },
    {
      id: 18,
      title: '网络安全兴趣交流小组',
      kind: 'activity', category: 'learning', source: 'school',
      summary: '面向 CTF、Web 安全等方向的兴趣交流小组，今晚首次交流，之后每两周一次，不限基础。',
      audience: '对 CTF、Web 安全等方向感兴趣的学生', beginner: true,
      regType: 'unknown',
      start: '2026-09-19T19:30:00',
      scheduleNote: '首次交流 9/19 19:30，之后每两周开展一次',
      place: null,
      extra: [
        '首次交流时间：9/19 19:30',
        '之后每两周开展一次',
        '面向 CTF、Web 安全等方向感兴趣的学生',
        '不限基础',
      ],
      tags: ['网络安全', 'CTF', 'Web安全', '兴趣小组'],
    },
    {
      id: 19,
      title: '学生创新项目路演观摩',
      kind: 'activity', category: 'lecture', source: 'school',
      summary: '学生创新项目路演观摩，原报名已截止，如现场仍有余位可候补入场。',
      audience: '未注明',
      regType: 'signup', deadline: '2026-09-18T22:00:00',
      waitlist: true,
      start: '2026-09-20T14:30:00',
      place: null,
      extra: [
        '活动时间：9/20 14:30',
        '原报名截止时间：9/18 22:00（已截止）',
        '活动方说明：如现场仍有余位，可接受候补入场',
      ],
      notes: [
        '报名已截止，但可提交候补申请；候补是否入场以现场余位为准。',
      ],
      tags: ['路演', '观摩', '候补'],
    },
    {
      id: 20,
      title: '创新创业项目团队补充说明',
      kind: 'update', category: 'recruit', source: 'school',
      summary: '开发方向名额已满，现主要补充设计与材料成员，9/22 18:00 截止。',
      audience: '未注明',
      regType: 'signup', deadline: '2026-09-22T18:00:00',
      updateOf: 3,
      requiresIntro: true,
      extra: [
        '开发方向名额已满，现主要补充设计与材料成员',
        '9/22 18:00 截止',
        '此前已投递者无需重复提交',
      ],
      tags: ['创新创业', '补充说明', '招募'],
    },
    {
      id: 21,
      title: '计算机学院 AI 产品设计分享会',
      kind: 'activity', category: 'lecture', source: 'college',
      publisherLabel: '计算机学院',
      summary: '计算机学院举办的 AI 产品设计分享会，面向全校学生，无需报名、座位有限。',
      audience: '全校学生',
      regType: 'none',
      start: '2026-09-20T19:00:00',
      place: '明德楼 B203',
      capacityNote: '座位有限，无需报名',
      extra: [
        '时间：9/20 19:00',
        '地点：明德楼 B203',
        '面向全校学生',
        '无需报名，座位有限',
      ],
      tags: ['AI', '产品设计', '分享会'],
    },
    {
      id: 22,
      title: '学生发起｜周末羽毛球约球',
      kind: 'activity', category: 'social', source: 'student',
      publisherLabel: '学生个人发布',
      summary: '学生个人发起的羽毛球约球：9/20 下午，6—8 人，费用 AA，场地待最终确认。',
      audience: '未注明',
      regType: 'unknown',
      start: '2026-09-20T16:00:00',
      place: null, placeNote: '场地待最终确认',
      fee: 'AA',
      capacity: 8, capacityNote: '计划 6—8 人',
      extra: [
        '时间：9/20 16:00',
        '计划 6—8 人',
        '费用 AA',
        '场地待最终确认',
      ],
      tags: ['羽毛球', '约球', 'AA'],
    },
    {
      id: 23,
      title: '学生发起｜AI 工具交流搭子招募',
      kind: 'recruit', category: 'social', source: 'student',
      publisherLabel: '学生个人发布',
      summary: '学生个人发起的 AI 工具交流搭子招募，欢迎零基础，报名后拉群，地点未确定。',
      audience: '未注明（欢迎零基础）', beginner: true,
      regType: 'signup', deadline: null,
      deadlineNote: '截止时间未注明',
      start: '2026-09-21T19:00:00',
      startNote: '拟于 9/21 晚开展，具体时刻未确定',
      place: null, placeNote: '具体地点未确定',
      extra: [
        '拟于 9/21 晚开展',
        '欢迎零基础',
        '报名后拉群',
        '具体地点未确定',
      ],
      tags: ['AI', '搭子', '交流'],
    },
    {
      id: 24,
      title: '学生发起｜“校园兼职福利分享”',
      kind: 'activity', category: 'social', source: 'student',
      publisherLabel: '学生个人发布',
      summary: '学生个人发布的“兼职福利”信息：称“零门槛、日结”，要求添加私人微信获取详情，未提供主办方、地点和完整内容。',
      audience: '未注明',
      regType: 'unknown',
      place: null,
      extra: [
        '自称“零门槛、日结”',
        '要求添加私人微信获取详情',
        '未提供主办方、地点和完整内容',
      ],
      flags: ['疑似非正规兼职', '私下添加微信', '信息不完整'],
      tags: ['兼职', '福利'],
    },
    {
      id: 25,
      title: '学生发起｜数码新品体验交流',
      kind: 'activity', category: 'social', source: 'student',
      publisherLabel: '学生个人发布',
      summary: '标题为技术交流，正文主要介绍某商家优惠及购买链接；活动时间、地点未注明。',
      audience: '未注明',
      regType: 'unknown',
      place: null,
      extra: [
        '标题为技术交流',
        '正文主要介绍某商家优惠及购买链接',
        '活动时间、地点未注明',
      ],
      flags: ['疑似商业推广', '时间地点未注明'],
      tags: ['数码', '体验'],
    },
    {
      id: 26,
      title: '外国语学院校园语言角',
      kind: 'activity', category: 'social', source: 'college',
      publisherLabel: '外国语学院',
      summary: '外国语学院举办的语言角，面向全校学生自由交流，场地容量有限，无需提前报名。',
      audience: '全校学生',
      regType: 'none',
      start: '2026-09-21T15:00:00',
      capacityNote: '场地容量有限，无需提前报名',
      extra: [
        '时间：9/21 15:00',
        '面向全校学生',
        '自由交流',
        '场地容量有限，无需提前报名',
      ],
      tags: ['语言角', '外语', '交流'],
    },
  ];

  var DATA = {
    BASE_NOW: BASE_NOW,
    CATEGORIES: CATEGORIES,
    SOURCES: SOURCES,
    RAW_ITEMS: RAW_ITEMS,
    categoryById: function (id) {
      for (var i = 0; i < CATEGORIES.length; i++) {
        if (CATEGORIES[i].id === id) return CATEGORIES[i];
      }
      return null;
    },
    sourceById: function (id) {
      for (var i = 0; i < SOURCES.length; i++) {
        if (SOURCES[i].id === id) return SOURCES[i];
      }
      return null;
    },
    itemById: function (id) {
      for (var i = 0; i < RAW_ITEMS.length; i++) {
        if (RAW_ITEMS[i].id === id) return RAW_ITEMS[i];
      }
      return null;
    },
  };

  global.MIHUO_DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DATA;
  }
})(typeof window !== 'undefined' ? window : globalThis);
