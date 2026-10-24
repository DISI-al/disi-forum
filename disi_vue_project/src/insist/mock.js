/**
 * INSIST 假数据（P1 静态版）
 * 后端接口就绪后，把这里的 export 换成请求即可。
 */

export const LEVELS = ['初识', '入门', '熟练', '精通', '专家']
export const LEVEL_MIN = [0, 100, 300, 700, 1300]
export const TIERS = ['低阶', '中阶', '高阶', '臻阶']
export const IMPORTANCE = ['次要', '一般', '重要', '核心']

/* ---------- 技能 ---------- */
export const skills = [
  { id: 'cpp', name: 'C++', category: '编程语言', tier: 3, importance: 4, level: 2, xp: 615, overflow: 0, forget: 12, daysAgo: 8, records: 12 },
  { id: 'ds', name: '数据结构', category: '计算机基础', tier: 3, importance: 4, level: 3, xp: 820, overflow: 0, forget: 35, daysAgo: 30, records: 20 },
  { id: 'math', name: '高等数学', category: '数学', tier: 3, importance: 3, level: 2, xp: 350, overflow: 0, forget: 82, daysAgo: 95, records: 6 },
  { id: 'en', name: '高中英语', category: '语言', tier: 2, importance: 3, level: 2, xp: 700, overflow: 6, forget: 40, daysAgo: 12, records: 9 },
  { id: 'linux', name: 'Linux', category: '工具链', tier: 2, importance: 2, level: 1, xp: 180, overflow: 0, forget: 55, daysAgo: 60, records: 4 },
  { id: 'cook', name: '做饭', category: '生活', tier: 1, importance: 1, level: 1, xp: 120, overflow: 0, forget: 100, daysAgo: 200, records: 2 },
  { id: 'jp', name: '日语', category: '语言', tier: 2, importance: 2, level: 0, xp: 40, overflow: 0, forget: 95, daysAgo: 120, records: 1 },
  { id: 'write', name: '写作', category: '表达', tier: 2, importance: 3, level: 2, xp: 380, overflow: 0, forget: 15, daysAgo: 15, records: 7 },
  { id: 'algo', name: '算法', category: '计算机基础', tier: 4, importance: 4, level: 3, xp: 1300, overflow: 24, forget: 20, daysAgo: 18, records: 26 },
  { id: 'design', name: 'UI 设计', category: '表达', tier: 2, importance: 2, level: 1, xp: 210, overflow: 0, forget: 48, daysAgo: 42, records: 5 },
]

/* ---------- 打卡 ---------- */
export const habits = [
  { id: 'h1', name: '英语 · 每天 20 词', skillId: 'en', tier: 2, streak: 13, total: 68, today: 3.0, capped: false, done: false, history: [1,1,0,1,1,1,1,1,1,1,1,1,1,0] },
  { id: 'h2', name: 'C++ · 每天 30 分钟', skillId: 'cpp', tier: 2, streak: 6, total: 41, today: 0, capped: true, done: true, history: [1,0,1,1,0,1,1,1,0,1,1,1,0,1] },
  { id: 'h3', name: '阅读 · 每天 10 页', skillId: 'write', tier: 1, streak: 3, total: 21, today: 1.5, capped: false, done: false, history: [0,1,1,0,1,1,1,0,1,1,1,1,0,0] },
  { id: 'h4', name: '算法 · 每天 1 题', skillId: 'algo', tier: 3, streak: 9, total: 54, today: 12, capped: false, done: false, history: [1,1,1,1,0,1,1,1,1,1,0,1,1,0] },
]

/* ---------- 经验卡 ---------- */
export const cards = [
  { id: 't1', kind: 'task', name: '读完《C++ Primer》第 3 章', skillId: 'cpp', tier: 2, progress: 60, xp: 100, status: 'active', desc: '第 3 章：字符串、向量和数组，含课后 12 道练习。' },
  { id: 't2', kind: 'task', name: '整理 Linux 常用命令笔记', skillId: 'linux', tier: 1, progress: 30, xp: 40, status: 'active', desc: '按文件 / 进程 / 网络分组整理，目标 60 条。' },
  { id: 'p1', kind: 'project', name: '机房管理系统', skillId: 'cpp', tier: 3, progress: 30, xp: 250, status: 'active', phase: '2/4', desc: 'C++ 独立项目：机房预约、座位分配、上机记录导出。当前完成 2/4 阶段。' },
  { id: 'p2', kind: 'project', name: '个人博客重构', skillId: 'write', tier: 2, progress: 100, xp: 100, status: 'done' },
  { id: 't3', kind: 'task', name: '《算法导论》第 2 章', skillId: 'algo', tier: 3, progress: 100, xp: 250, status: 'done' },
  { id: 'h5', kind: 'habit', name: '日语 · 每天 15 分钟', skillId: 'jp', tier: 1, progress: 100, xp: 60, status: 'archived', streak: 0, total: 40 },
]

/* ---------- 成就 ---------- */
export const achievements = [
  { id: 'a1', name: '算法比赛二等奖', tier: 4, grade: '专家级', date: '2026-09', desc: '2026 年校级程序设计竞赛，独立完成 3 道题，总排名第 2。' },
  { id: 'a2', name: '150 天坚持', tier: 3, grade: '精通级', date: '2026-08', desc: '英语打卡累计 150 天，最近 30 天完成 26 天。' },
  { id: 'a3', name: '连续 30 天', tier: 2, grade: '熟练级', date: '2026-07', desc: '连续 30 天有任意学习记录。' },
  { id: 'a4', name: '六级 520', tier: 3, grade: '精通级', date: '2026-06', desc: 'CET-6 总分 520，可作为英语「熟练 → 精通」的晋升凭证。' },
  { id: 'a5', name: '10 张经验卡', tier: 2, grade: '熟练级', date: '2026-05', desc: '累计完成 10 张经验卡（任务 + 项目）。' },
  { id: 'a6', name: '首个项目卡完成', tier: 2, grade: '熟练级', date: '2026-04', desc: '完成第一个项目卡《个人博客重构》。' },
]

export const lockedAchievements = [
  { id: 'l1', name: '连续 100 天学习', hint: '再坚持 68 天' },
  { id: 'l2', name: '累计 50 张经验卡', hint: '当前 23 张' },
  { id: 'l3', name: '精通技能 ×5', hint: '当前 2 个' },
  { id: 'l4', name: '臻阶项目完成', hint: '暂无' },
]

/* ---------- 最近 14 天每日 XP ---------- */
export const dailyXp = [18, 0, 22, 35, 12, 0, 0, 0, 41, 15, 30, 22, 18, 26]

/* ---------- 工具 ---------- */
export const levelName = (level) => LEVELS[level] || LEVELS[0]

export function progressOf(skill) {
  if (skill.level >= LEVELS.length - 1) return 100
  const base = LEVEL_MIN[skill.level]
  const next = LEVEL_MIN[skill.level + 1]
  return Math.max(0, Math.min(100, ((skill.xp - base) / (next - base)) * 100))
}

export function nextNeed(skill) {
  if (skill.level >= LEVELS.length - 1) return 0
  return Math.max(0, LEVEL_MIN[skill.level + 1] - skill.xp)
}

export function forgetClass(pct) {
  if (pct >= 85) return 'danger'
  if (pct >= 60) return 'warn'
  return ''
}

export function tierOf(skill) {
  return TIERS[skill.tier - 1]
}

export function stars(n) {
  return '★'.repeat(n)
}

/* 晋升清单（按量） */
export function promotionNeeds(skill) {
  if (skill.level === 2) {
    return [
      { label: '高阶项目卡', need: 1, got: 0 },
      { label: '中阶任务卡', need: 3, got: 2 },
      { label: '小任务卡', need: 5, got: 4 },
    ]
  }
  if (skill.level === 3) {
    return [
      { label: '臻阶项目卡', need: 1, got: 0 },
      { label: '高阶项目卡', need: 2, got: 1 },
      { label: '高阶成就卡', need: 1, got: 0 },
    ]
  }
  return []
}
