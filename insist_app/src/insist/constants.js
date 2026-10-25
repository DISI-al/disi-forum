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
  ({ habit: '打卡', task: '任务', project: '项目', achievement: '成就' }[kind] || '卡片')

export const statusLabel = (status) =>
  ({ active: '进行中', done: '已完成', archived: '已归档' }[status] || '')
