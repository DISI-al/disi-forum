/** INSIST 接口封装 */
import { clearAll } from '../insist/cache.js'

const API_ORIGIN = (typeof window !== 'undefined' && window.__DISI_API_BASE__) || ''
const BASE = API_ORIGIN + '/api/insist'

async function request(path, options = {}) {
  const token = localStorage.getItem('disi_token')
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    ;['disi_token', 'disi_role', 'disi_user_id', 'disi_user_name'].forEach((k) => localStorage.removeItem(k))
    if (import.meta.env.VITE_ROUTER_MODE === 'hash') {
      if (location.hash !== '#/login') location.hash = '#/login'
    } else if (!location.pathname.startsWith('/login')) {
      location.href = '/login'
    }
    throw new Error('登录已失效，请重新登录')
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
    data = null
  }

  if (!res.ok) {
    throw new Error((data && (data.detail || data.message)) || '请求失败（' + res.status + '）')
  }

  // 写操作后清空缓存，保证下次进页面读到最新数据
  if (options.method && options.method !== 'GET') clearAll()
  return data
}

const qs = (params = {}) => {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, v)
  })
  const str = s.toString()
  return str ? '?' + str : ''
}

// 技能
export const apiSkills = () => request('/skills')
export const apiSkill = (id) => request(`/skills/${id}`)
export const apiCreateSkill = (data) => request('/skills', { method: 'POST', body: JSON.stringify(data) })
export const apiPatchSkill = (id, data) => request(`/skills/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const apiDeleteSkill = (id) => request(`/skills/${id}`, { method: 'DELETE' })
export const apiSetFocus = (id) => request(`/skills/${id}/focus`, { method: 'POST' })

// 卡片
export const apiCards = (params) => request('/cards' + qs(params))
export const apiCard = (id) => request(`/cards/${id}`)
export const apiCreateCard = (data) => request('/cards', { method: 'POST', body: JSON.stringify(data) })
export const apiPatchCard = (id, data) => request(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
export const apiDeleteCard = (id) => request(`/cards/${id}`, { method: 'DELETE' })

// 打卡 / 结算
export const apiCheckin = (id) => request(`/cards/${id}/checkin`, { method: 'POST' })
export const apiCompleteCard = (id) => request(`/cards/${id}/complete`, { method: 'POST' })

// 晋升
export const apiPromotion = (id) => request(`/skills/${id}/promotion`)
export const apiPromote = (id) => request(`/skills/${id}/promote`, { method: 'POST' })

// 设置
export const apiSettings = () => request('/settings')
export const apiSaveSettings = (config) => request('/settings', { method: 'PATCH', body: JSON.stringify({ config }) })
export const apiResetSettings = () => request('/settings', { method: 'DELETE' })

// 统计
export const apiStats = (days = 14) => request(`/stats/checkins?days=${days}`)
export const apiOverview = () => request('/overview')

// AI 审核（预留）
export const apiAiReview = (skillId, targetLevel, note = '') =>
  request('/ai/review', { method: 'POST', body: JSON.stringify({ skill_id: skillId, target_level: targetLevel, note }) })

// 导出：直接触发浏览器下载
export async function apiExport(format = 'json') {
  const token = localStorage.getItem('disi_token')
  const res = await fetch(`${BASE}/export?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('导出失败')
  const blob = await res.blob()
  const names = { json: 'insist.json', csv: 'insist-skills.csv', 'csv-cards': 'insist-cards.csv' }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = names[format] || 'insist.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
