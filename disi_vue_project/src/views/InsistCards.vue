<script setup>
/**
 * INSIST · 卡片库（P1 静态版）
 * 进行中 / 已完成 / 已归档 三个 tab
 */
import { ref, computed } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { cards, skills, TIERS } from '../insist/mock.js'

const tab = ref('active')
const tabs = [
  { key: 'active', label: '进行中' },
  { key: 'done', label: '已完成' },
  { key: 'archived', label: '已归档' },
]

const list = computed(() => cards.filter((c) => c.status === tab.value))
const countOf = (key) => cards.filter((c) => c.status === key).length
const kindLabel = (c) => (c.kind === 'project' ? '项目' : c.kind === 'habit' ? '打卡' : '任务')
const skillName = (id) => skills.find((s) => s.id === id)?.name || id
</script>

<template>
  <div class="insist-page">
    <InsistNav active="cards" />

    <main class="insist-main">
      <nav class="insist-crumb">
        <router-link to="/insist">← 主页</router-link>
      </nav>

      <section class="head">
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="tab"
            :class="{ on: tab === t.key }"
            @click="tab = t.key"
          >{{ t.label }} <span class="num">{{ countOf(t.key) }}</span></button>
        </div>
        <button class="insist-btn primary" type="button" disabled>＋ 新建卡片（待接后端）</button>
      </section>

      <p v-if="list.length === 0" class="insist-empty">这里还没有卡片</p>

      <ul v-else class="card-list">
        <li v-for="c in list" :key="c.id">
        <router-link class="row" :class="c.kind" :to="'/insist/card/' + c.id">
          <span class="kind">{{ kindLabel(c) }}</span>
          <div class="main">
            <div class="title">{{ c.name }}</div>
            <div class="sub">{{ skillName(c.skillId) }} · {{ TIERS[c.tier - 1] }}<template v-if="c.phase"> · 阶段 {{ c.phase }}</template></div>
          </div>

          <div class="prog">
            <div class="insist-bar small"><i :style="{ width: c.progress + '%' }"></i></div>
            <span class="mono">{{ c.progress }}%</span>
          </div>

          <span class="xp mono">+{{ c.xp }}</span>
          <span class="chev">→</span>
        </router-link>
      </li>
      </ul>

      <p class="hint">
        打卡卡：每天结算，达到阈值可进化成任务卡。任务卡：完成一次性结算。项目卡：按阶段分批结算。
      </p>
    </main>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.4rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid #141414;
  flex-wrap: wrap;
}
.tabs { display: flex; gap: 0.4rem; }
.tab {
  background: transparent;
  border: 1px solid transparent;
  color: #7a7a7a;
  font-size: 0.78rem;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
}
.tab:hover { color: #ededed; }
.tab.on { color: #ededed; border-color: #2a2a2a; background: #0a0a0a; }
.tab .num { color: #5f5f5f; font-size: 0.66rem; }

.card-list { list-style: none; margin-top: 0.4rem; }
.row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.1rem;
  border-bottom: 1px solid #101010;
}
.kind {
  flex-shrink: 0;
  font-size: 0.62rem;
  color: #8a8a8a;
  border: 1px solid #242424;
  border-radius: 3px;
  padding: 0.08rem 0.3rem;
  width: 2.4rem;
  text-align: center;
}
.row.project .kind { border-color: #444; color: #cfcfcf; }
.main { flex: 1; min-width: 0; }
.title { font-size: 0.86rem; }
.sub { margin-top: 0.15rem; font-size: 0.64rem; color: #5f5f5f; }
.prog { display: flex; align-items: center; gap: 0.5rem; width: 130px; }
.prog .insist-bar { flex: 1; }
.prog .mono { font-size: 0.64rem; color: #6a6a6a; width: 2.6rem; text-align: right; }
.xp { font-size: 0.7rem; color: #8a8a8a; width: 3.2rem; text-align: right; }
.chev { color: #4a4a4a; font-size: 0.8rem; }
.row:hover { background: #060606; }
.row:hover .chev { color: #b9b9b9; }
.hint { margin-top: 1.4rem; font-size: 0.68rem; color: #5f5f5f; line-height: 1.7; }

@media (max-width: 720px) {
  .row { flex-wrap: wrap; }
  .prog { width: 100%; }
}
</style>
