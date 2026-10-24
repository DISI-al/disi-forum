<script setup>
/**
 * INSIST · 打卡统计
 * 每个打卡目标的近 14 天情况
 */
import { computed } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { habits, skills, TIERS } from '../insist/mock.js'

const list = computed(() =>
  habits.map((h) => {
    const done = h.history.filter((v) => v === 1).length
    return {
      ...h,
      doneCount: done,
      rate: Math.round((done / h.history.length) * 100),
      skillName: skills.find((s) => s.id === h.skillId)?.name || h.skillId,
    }
  })
)

const todayDone = computed(() => habits.filter((h) => h.done).length)
const weekRate = computed(() => {
  const total = habits.length * 7
  const done = habits.reduce((n, h) => n + h.history.slice(-7).filter((v) => v === 1).length, 0)
  return total ? Math.round((done / total) * 100) : 0
})
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
        <span class="sub">近 14 天 · {{ list.length }} 个打卡目标</span>
      </section>

      <section class="summary">
        <div class="stat"><span class="num mono">{{ todayDone }}/{{ list.length }}</span><span class="label">今日完成</span></div>
        <div class="stat"><span class="num mono">{{ weekRate }}%</span><span class="label">本周完成率</span></div>
      </section>

      <ul class="rows">
        <li v-for="h in list" :key="h.id" class="row">
          <div class="row-head">
            <div class="row-title">
              <span class="name">{{ h.name }}</span>
              <span class="tier">{{ TIERS[h.tier - 1] }}</span>
              <span v-if="h.capped" class="cap">已封顶</span>
            </div>
            <div class="row-meta">
              <span>连续 {{ h.streak }} 天</span>
              <span>近 14 天 {{ h.doneCount }}/14</span>
              <span class="rate">{{ h.rate }}%</span>
            </div>
          </div>

          <div class="cells" :title="'近 14 天'" >
            <span
              v-for="(v, i) in h.history"
              :key="i"
              class="cell"
              :class="{ on: v === 1, today: i === h.history.length - 1 }"
            ></span>
          </div>

          <div class="row-foot">
            <span class="skill">{{ h.skillName }}</span>
            <span class="xp">今日 +{{ h.today.toFixed(1) }}</span>
            <span class="status" :class="{ done: h.done }">{{ h.done ? '今日已打卡' : '今日未打卡' }}</span>
          </div>
        </li>
      </ul>

      <p class="hint">格子从左到右是 14 天前 → 今天；今天还没打卡的格子带虚线边框。</p>
    </main>
  </div>
</template>

<style scoped>
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
.cap { font-size: 0.62rem; color: #b98a00; border: 1px solid rgba(185, 138, 0, 0.4); border-radius: 3px; padding: 0.02rem 0.28rem; }
.row-meta { display: flex; gap: 0.9rem; font-size: 0.66rem; color: #6a6a6a; }
.rate { color: #b9b9b9; }

.cells { display: flex; gap: 4px; margin-top: 0.6rem; }
.cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #161616;
  border: 1px solid #1a1a1a;
}
.cell.on { background: #cfcfcf; border-color: #cfcfcf; }
.cell.today:not(.on) { border-style: dashed; border-color: #4a4a4a; }

.row-foot { display: flex; gap: 0.9rem; margin-top: 0.5rem; font-size: 0.66rem; color: #5f5f5f; }
.status { margin-left: auto; }
.status.done { color: #8a8a8a; }

.hint { margin-top: 1.4rem; font-size: 0.68rem; color: #5f5f5f; }
</style>
