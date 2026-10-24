<script setup>
/**
 * INSIST · 经验卡详情（接后端）
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import InsistNav from '../components/InsistNav.vue'
import { apiCard, apiSkills, apiCheckin, apiCompleteCard } from '../api/insist_api.js'
import { tierName, kindLabel, statusLabel } from '../insist/constants.js'

const route = useRoute()
const card = ref(null)
const skillName = ref('')
const loading = ref(true)
const error = ref('')
const notice = ref('')
const busy = ref(false)

const isHabit = computed(() => card.value?.kind === 'habit')
const isDone = computed(() => card.value?.status === 'done')

function todayDone() {
  if (!card.value?.lastCheckin) return false
  const d = new Date(card.value.lastCheckin)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const c = await apiCard(route.params.id)
    card.value = c
    if (c.skillId) {
      const list = await apiSkills()
      skillName.value = list.find((s) => s.id === c.skillId)?.name || ''
    }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function checkin() {
  if (busy.value) return
  busy.value = true
  try {
    const res = await apiCheckin(card.value.id)
    notice.value = `打卡成功 +${res.xp} XP` + (res.streak > 1 ? ` · 连续 ${res.streak} 天` : '')
    await load()
  } catch (e) {
    error.value = e.message || '打卡失败'
  } finally {
    busy.value = false
  }
}

async function complete() {
  if (busy.value) return
  busy.value = true
  try {
    const res = await apiCompleteCard(card.value.id)
    notice.value = `已结算 +${card.value.xpValue} XP`
    await load()
  } catch (e) {
    error.value = e.message || '结算失败'
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="insist-page">
    <InsistNav active="cards" />

    <main class="insist-main">
      <nav class="insist-crumb">
        <router-link to="/insist">← 主页</router-link>
        <span>/</span>
        <router-link to="/insist/cards">卡片库</router-link>
      </nav>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>

      <template v-else-if="card">
        <section class="head">
          <div class="head-top">
            <span class="kind">{{ kindLabel(card.kind) }}</span>
            <span class="tier">{{ tierName(card.tier) }}</span>
            <span class="status">{{ statusLabel(card.status) }}</span>
          </div>
          <h1 class="name">{{ card.title }}</h1>
          <p class="desc">{{ card.detail || '暂无描述' }}</p>
        </section>

        <p v-if="notice" class="notice">{{ notice }}</p>

        <section class="grid">
          <div class="cell">
            <span class="label">关联技能</span>
            <router-link v-if="card.skillId" :to="'/insist/skill/' + card.skillId" class="value link">{{ skillName || '查看技能' }}</router-link>
            <span v-else class="value">—</span>
          </div>
          <div class="cell"><span class="label">奖励</span><span class="value mono">+{{ card.xpValue }} XP</span></div>
          <div class="cell"><span class="label">进度</span><span class="value mono">{{ card.progress }}%</span></div>
          <div v-if="card.phase" class="cell"><span class="label">阶段</span><span class="value mono">{{ card.phase }}</span></div>
          <div v-if="isHabit" class="cell"><span class="label">打卡</span><span class="value mono">连续 {{ card.streak }} 天 · 累计 {{ card.totalDays }} 天</span></div>
          <div v-if="card.dailyTarget" class="cell"><span class="label">每日目标</span><span class="value">{{ card.dailyTarget }}</span></div>
        </section>

        <div class="bar-wrap">
          <div class="insist-bar"><i :style="{ width: card.progress + '%' }"></i></div>
        </div>

        <section class="insist-block" v-if="isHabit">
          <div class="insist-block-head"><h2>打卡规则</h2></div>
          <ul class="rules">
            <li>每日结算一次，不打卡不计；连续中断清零连续天数，累计天数保留。</li>
            <li>每日 XP 随累计天数递减：1.0 → 0.85 → 0.62 → 0.45 → 0.30。</li>
            <li>累计达标且近期完成率 ≥ 2/3，可进化成任务卡，XP 锁定、重要度 −1。</li>
          </ul>
        </section>

        <section class="insist-block" v-else>
          <div class="insist-block-head"><h2>结算方式</h2></div>
          <ul class="rules">
            <li v-if="card.kind === 'project'">按阶段分批结算，完成一个阶段发对应比例 XP。</li>
            <li v-else-if="card.kind === 'achievement'">成就卡不需要结算，成功后自动加入成就墙。</li>
            <li v-else>完成时一次性结算；未完成前只记进度，不发 XP。</li>
          </ul>
        </section>

        <div class="actions">
          <button
            v-if="isHabit"
            class="insist-btn primary"
            type="button"
            :disabled="todayDone() || busy"
            @click="checkin"
          >{{ todayDone() ? '今天已打卡' : '打卡' }}</button>

          <button
            v-else-if="!isDone && card.kind !== 'achievement'"
            class="insist-btn primary"
            type="button"
            :disabled="busy"
            @click="complete"
          >完成并结算</button>

          <router-link to="/insist/cards" class="insist-btn">返回卡片库</router-link>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.state { color: #8a8a8a; font-size: 0.82rem; padding: 1rem 0; }
.state.err { color: #f85149; }
.notice { margin-top: 0.8rem; font-size: 0.76rem; color: #b9b9b9; }

.head { margin-top: 0.9rem; padding-bottom: 1rem; border-bottom: 1px solid #141414; }
.head-top { display: flex; gap: 0.5rem; font-size: 0.64rem; color: #6a6a6a; }
.kind { border: 1px solid #2a2a2a; border-radius: 3px; padding: 0.05rem 0.3rem; color: #b9b9b9; }
.name { margin-top: 0.45rem; font-size: 1.7rem; font-weight: 600; }
.desc { margin-top: 0.5rem; font-size: 0.82rem; color: #8a8a8a; line-height: 1.7; max-width: 44rem; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.9rem; margin-top: 1.1rem; }
.cell { display: flex; flex-direction: column; gap: 0.25rem; }
.label { font-size: 0.64rem; color: #5f5f5f; letter-spacing: 0.08em; }
.value { font-size: 0.9rem; color: #d8d8d8; }
.value.link { color: #ededed; text-decoration: none; }
.value.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.bar-wrap { margin-top: 1.2rem; }
.rules { list-style: none; margin-top: 0.5rem; }
.rules li { position: relative; padding: 0.35rem 0 0.35rem 0.9rem; font-size: 0.76rem; color: #8a8a8a; line-height: 1.7; }
.rules li::before { content: '·'; position: absolute; left: 0.2rem; color: #4a4a4a; }
.actions { margin-top: 2rem; display: flex; gap: 0.6rem; }
</style>
