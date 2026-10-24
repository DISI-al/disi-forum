<script setup>
/**
 * INSIST · 打卡统计（接后端）
 */
import { ref, computed, onMounted } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { apiStats, apiSkills } from '../api/insist_api.js'
import { tierName } from '../insist/constants.js'

const loading = ref(true)
const error = ref('')
const items = ref([])
const days = ref(14)
const skills = ref([])

const todayDone = computed(() => items.value.filter((i) => i.todayDone).length)
const weekRate = computed(() => {
  const take = Math.min(7, days.value)
  const total = items.value.length * take
  if (!total) return 0
  const done = items.value.reduce((n, i) => n + i.cells.slice(-take).filter((v) => v === 1).length, 0)
  return Math.round((done / total) * 100)
})
const skillName = (id) => skills.value.find((s) => s.id === id)?.name || ''

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [st, sk] = await Promise.all([apiStats(days.value), apiSkills()])
    items.value = st.items.map((i) => ({ ...i }))
    skills.value = sk
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="insist-page">
    <InsistNav active="home" />

    <main class="insist-main">
      <nav class="insist-crumb">
        <router-link to="/insist">← 主页</router-link>
        <span>/</span>
        <span class="cur">打卡统计</span>
      </nav>

      <section class="head">
        <h1>打卡统计</h1>
        <span class="sub">近 {{ days }} 天 · {{ items.length }} 个打卡目标</span>
      </section>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>

      <template v-else>
        <section class="summary">
          <div class="stat"><span class="num mono">{{ todayDone }}/{{ items.length }}</span><span class="label">今日完成</span></div>
          <div class="stat"><span class="num mono">{{ weekRate }}%</span><span class="label">本周完成率</span></div>
        </section>

        <p v-if="items.length === 0" class="insist-empty">还没有打卡卡</p>

        <ul v-else class="rows">
          <li v-for="h in items" :key="h.id" class="row">
            <div class="row-head">
              <div class="row-title">
                <span class="name">{{ h.title }}</span>
                <span class="tier">{{ tierName(h.tier) }}</span>
              </div>
              <div class="row-meta">
                <span>连续 {{ h.streak }} 天</span>
                <span>近 {{ days }} 天 {{ h.doneCount }}/{{ days }}</span>
                <span class="rate">{{ h.rate }}%</span>
              </div>
            </div>

            <div class="cells">
              <span
                v-for="(v, i) in h.cells"
                :key="i"
                class="cell"
                :class="{ on: v === 1, today: i === h.cells.length - 1 }"
              ></span>
            </div>

            <div class="row-foot">
              <span class="status" :class="{ done: h.todayDone }">{{ h.todayDone ? '今日已打卡' : '今日未打卡' }}</span>
              <router-link class="link" :to="'/insist/card/' + h.id">查看卡片 →</router-link>
            </div>
          </li>
        </ul>

        <p class="hint">格子从左到右是 {{ days }} 天前 → 今天；今天还没打卡的格子带虚线边框。</p>
      </template>
    </main>
  </div>
</template>

<style scoped>
.state { color: #8a8a8a; font-size: 0.82rem; padding: 1rem 0; }
.state.err { color: #f85149; }

.head { margin-top: 0.9rem; display: flex; align-items: baseline; gap: 0.7rem; }
.head h1 { font-size: 1.1rem; font-weight: 600; margin: 0; }
.sub { font-size: 0.68rem; color: #5f5f5f; }

.summary { display: flex; gap: 2.4rem; margin-top: 1rem; padding-bottom: 0.9rem; border-bottom: 1px solid #141414; }
.stat { display: flex; flex-direction: column; gap: 0.2rem; }
.stat .num { font-size: 1.3rem; color: #ededed; }
.stat .label { font-size: 0.64rem; color: #6f6f6f; }

.rows { list-style: none; margin-top: 0.4rem; }
.row { padding: 0.9rem 0.1rem; border-bottom: 1px solid #101010; }
.row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
.row-title { display: flex; align-items: baseline; gap: 0.5rem; }
.name { font-size: 0.9rem; }
.tier { font-size: 0.62rem; color: #5f5f5f; border: 1px solid #1e1e1e; border-radius: 3px; padding: 0.02rem 0.28rem; }
.row-meta { display: flex; gap: 0.9rem; font-size: 0.66rem; color: #6a6a6a; }
.rate { color: #b9b9b9; }

.cells { display: flex; gap: 4px; margin-top: 0.6rem; }
.cell { width: 14px; height: 14px; border-radius: 3px; background: #161616; border: 1px solid #1a1a1a; }
.cell.on { background: #cfcfcf; border-color: #cfcfcf; }
.cell.today:not(.on) { border-style: dashed; border-color: #4a4a4a; }

.row-foot { display: flex; gap: 0.9rem; margin-top: 0.5rem; font-size: 0.66rem; color: #5f5f5f; align-items: center; }
.status.done { color: #8a8a8a; }
.link { margin-left: auto; color: #7a7a7a; text-decoration: none; }
.link:hover { color: #ededed; }

.hint { margin-top: 1.4rem; font-size: 0.68rem; color: #5f5f5f; }
</style>
