<script setup>
/**
 * INSIST · 收藏室（P1 静态版）
 * 全部技能卡：分组 / 筛选 / 排序；点卡片进技能详情。
 */
import { ref, computed } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import {
  skills, LEVELS, TIERS, IMPORTANCE,
  levelName, progressOf, forgetClass, tierOf, stars,
} from '../insist/mock.js'

const groupBy = ref('importance')      // importance | category | tier
const filterCategory = ref('all')
const filterTier = ref(0)
const sortBy = ref('proficiency')      // proficiency | recent | name

const categories = computed(() => [...new Set(skills.map((s) => s.category))])

const visible = computed(() => {
  let list = skills.filter((s) => {
    if (filterCategory.value !== 'all' && s.category !== filterCategory.value) return false
    if (filterTier.value && s.tier !== filterTier.value) return false
    return true
  })
  if (sortBy.value === 'recent') list = [...list].sort((a, b) => a.daysAgo - b.daysAgo)
  else if (sortBy.value === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  else list = [...list].sort((a, b) => (b.level - a.level) || (b.xp - a.xp))
  return list
})

const groups = computed(() => {
  const map = new Map()
  for (const s of visible.value) {
    const key = groupBy.value === 'importance' ? s.importance
      : groupBy.value === 'tier' ? s.tier
      : s.category
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  }
  const keys = [...map.keys()]
  if (groupBy.value === 'category') keys.sort((a, b) => String(a).localeCompare(String(b), 'zh'))
  else keys.sort((a, b) => b - a)
  return keys.map((key) => ({
    key,
    label: groupBy.value === 'importance' ? IMPORTANCE[key - 1]
      : groupBy.value === 'tier' ? TIERS[key - 1]
      : key,
    items: map.get(key),
  }))
})

const totalXp = computed(() => skills.reduce((n, s) => n + s.xp, 0))
const fullCount = computed(() => skills.filter((s) => s.overflow > 0).length)
</script>

<template>
  <div class="insist-page">
    <InsistNav active="collection" />

    <main class="insist-main">
      <nav class="insist-crumb">
        <router-link to="/insist">← 主页</router-link>
      </nav>

      <!-- 概览 -->
      <section class="summary">
        <div class="stat"><span class="num mono">{{ skills.length }}</span><span class="label">技能</span></div>
        <div class="stat"><span class="num mono">{{ totalXp.toLocaleString() }}</span><span class="label">总 XP</span></div>
        <div class="stat" :class="{ alert: fullCount > 0 }">
          <span class="num mono">{{ fullCount }}</span><span class="label">爆满待晋升</span>
        </div>
      </section>

      <!-- 工具条 -->
      <section class="toolbar">
        <label class="ctl"><span>分组</span>
          <select v-model="groupBy">
            <option value="importance">重要程度</option>
            <option value="category">分类</option>
            <option value="tier">难度阶</option>
          </select>
        </label>
        <label class="ctl"><span>分类</span>
          <select v-model="filterCategory">
            <option value="all">全部</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="ctl"><span>难度</span>
          <select v-model.number="filterTier">
            <option :value="0">全部</option>
            <option v-for="(t, i) in TIERS" :key="t" :value="i + 1">{{ t }}</option>
          </select>
        </label>
        <label class="ctl"><span>排序</span>
          <select v-model="sortBy">
            <option value="proficiency">熟练度</option>
            <option value="recent">最近记录</option>
            <option value="name">名称</option>
          </select>
        </label>
      </section>

      <p v-if="visible.length === 0" class="insist-empty">这个筛选下没有技能</p>

      <!-- 分组网格 -->
      <section v-for="group in groups" :key="group.key" class="group">
        <h2 class="group-title">
          <span class="dot" :class="groupBy === 'importance' ? 'imp-' + group.key : ''"></span>
          {{ group.label }}
          <span class="count">{{ group.items.length }}</span>
        </h2>

        <div class="insist-grid">
          <router-link
            v-for="s in group.items"
            :key="s.id"
            class="sk-card"
            :class="['imp-' + s.importance, { dusty: s.forget >= 60 }]"
            :to="'/insist/skill/' + s.id"
          >
            <div class="sk-top">
              <span class="sk-cat">{{ s.category }}</span>
              <span class="sk-tier">
                <i v-for="n in 4" :key="n" :class="{ on: n <= s.tier }"></i>
              </span>
            </div>

            <div class="sk-name">
              <span>{{ s.name }}</span>
              <span class="sk-stars">{{ stars(s.importance) }}</span>
            </div>

            <div class="sk-prof">
              <div class="sk-prof-head">
                <span class="sk-level">{{ levelName(s.level) }}</span>
                <span class="sk-xp">{{ s.xp }} / {{ s.level < 4 ? [0, 100, 300, 700, 1300][s.level + 1] : 'MAX' }}</span>
              </div>
              <div class="insist-bar" :class="{ full: s.overflow > 0 }"><i :style="{ width: progressOf(s) + '%' }"></i></div>
            </div>

            <div class="sk-foot">
              <span>{{ s.records }} 条 · {{ s.daysAgo }} 天前</span>
              <span class="sk-forget" :class="forgetClass(s.forget)">遗忘 {{ s.forget }}%</span>
            </div>
          </router-link>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  align-items: flex-end;
  gap: 2.2rem;
  padding: 1.5rem 0 1.1rem;
  border-bottom: 1px solid #141414;
}
.stat { display: flex; flex-direction: column; gap: 0.2rem; }
.stat .num { font-size: 1.45rem; line-height: 1; color: #ededed; }
.stat .label { font-size: 0.66rem; color: #6f6f6f; letter-spacing: 0.08em; }
.stat.alert .num { color: #f85149; }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid #141414;
}
.ctl { display: flex; align-items: center; gap: 0.4rem; }
.ctl span { font-size: 0.68rem; color: #5c5c5c; letter-spacing: 0.08em; }
select {
  background: #0a0a0a;
  border: 1px solid #222;
  color: #cfcfcf;
  font-size: 0.72rem;
  padding: 0.22rem 0.4rem;
  border-radius: 3px;
  outline: none;
}
select:focus { border-color: #444; }

.group { margin-top: 1.6rem; }
.group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: #8a8a8a;
  margin-bottom: 0.75rem;
}
.count { color: #4a4a4a; letter-spacing: 0; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3a3a; }
.dot.imp-4 { background: #ededed; }
.dot.imp-3 { background: #b9b9b9; }
.dot.imp-2 { background: #7a7a7a; }
.dot.imp-1 { background: #4a4a4a; }

@media (max-width: 720px) {
  .summary { gap: 1.4rem; }
}
</style>
