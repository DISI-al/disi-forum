/** INSIST 常量与展示辅助 */
export const LEVELS = ['初识', '入门', '熟练', '精通', '专家']
export const LEVEL_MIN = [0, 100, 300, 700, 1300]
export const TIERS = ['低阶', '中阶', '高阶', '臻阶']
export const IMPORTANCE = ['次要', '一般', '重要', '核心']

export const levelName = (level) => LEVELS[level] ?? LEVELS[0]
export const tierName = (tier) => TIERS[(tier || 1) - 1] || TIERS[0]
export const stars = (n) => '★'.repeat(Math.max(1, Math.min(4, n || 1)))

export function forgetClass(pct) {
  if (pct >= 85) return 'danger'
  if (pct >= 60) return 'warn'
  return ''
}

export function daysAgo(iso) {
  if (!iso) return 0
  const d = new Date(iso)
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
}

/** 卡片类型中文 */
export const kindLabel = (kind) =>
  ({ checkin: '打卡', task: '任务', project: '项目', achievement: '成就' }[kind] || '卡片')

export const statusLabel = (status) =>
  ({ active: '进行中', done: '已完成', archived: '已归档' }[status] || '')

// 结算日：每天 06:00 换日（00:00–05:59 算前一天）
export function logicalToday() {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (now.getHours() < 6) d.setDate(d.getDate() - 1)
  return d
}

// 判断某个日期字符串是否属于"当前结算日"
export function isCurrentSettleDay(value) {
  if (!value) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  const t = logicalToday()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

// XP 统一显示一位小数
export function fmtXp(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
