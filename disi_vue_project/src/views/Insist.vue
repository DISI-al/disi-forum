<script setup>
/**
 * INSIST —— 技能收藏室（P1 静态版）
 *
 * 现在用本地假数据，交互（分组/筛选/排序/添加）都能点；
 * 后端接口就绪后，把 MOCK_SKILLS 换成请求即可。
 */
import { ref, computed } from 'vue'

/* ---------- 字典 ---------- */
const LEVELS = ['初识', '入门', '熟练', '精通', '专家']
const LEVEL_MIN = [0, 100, 300, 700, 1300]
const TIERS = ['低阶', '中阶', '高阶', '臻阶']
const IMPORTANCE = ['次要', '一般', '重要', '核心']
const FORGET = ['无', '稍微', '中等', '严重', '彻底']

/* ---------- 假数据 ---------- */
const skills = ref([
  { id: 1, name: 'C++', category: '编程语言', tier: 3, importance: 4, level: 2, xp: 612, records: 12, daysAgo: 8, forget: 0, warn: false },
  { id: 2, name: '数据结构', category: '计算机基础', tier: 3, importance: 4, level: 3, xp: 820, records: 20, daysAgo: 30, forget: 1, warn: true },
  { id: 3, name: '高等数学', category: '数学', tier: 3, importance: 3, level: 2, xp: 350, records: 6, daysAgo: 95, forget: 3, warn: true },
  { id: 4, name: '英语', category: '语言', tier: 2, importance: 3, level: 2, xp: 420, records: 9, daysAgo: 40, forget: 1, warn: false },
  { id: 5, name: 'Linux', category: '工具链', tier: 2, importance: 2, level: 1, xp: 180, records: 4, daysAgo: 60, forget: 2, warn: false },
  { id: 6, name: '做饭', category: '生活', tier: 1, importance: 1, level: 1, xp: 120, records: 2, daysAgo: 200, forget: 4, warn: false },
  { id: 7, name: '日语', category: '语言', tier: 2, importance: 2, level: 0, xp: 40, records: 1, daysAgo: 120, forget: 3, warn: true },
  { id: 8, name: '写作', category: '表达', tier: 2, importance: 3, level: 2, xp: 380, records: 7, daysAgo: 15, forget: 0, warn: false },
])

/* ---------- 视图状态 ---------- */
const groupBy = ref('importance')      // importance | category | tier
const filterCategory = ref('all')
const filterTier = ref(0)              // 0 = 全部
const sortBy = ref('proficiency')      // proficiency | recent | name

const categories = computed(() => [...new Set(skills.value.map((s) => s.category))])

const visible = computed(() => {
  let list = skills.value.filter((s) => {
    if (filterCategory.value !== 'all' && s.category !== filterCategory.value) return false
    if (filterTier.value && s.tier !== filterTier.value) return false
    return true
  })
  const byDate = (a, b) => a.daysAgo - b.daysAgo
  if (sortBy.value === 'recent') list = [...list].sort(byDate)
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

/* ---------- 概览 ---------- */
const totalXp = computed(() => skills.value.reduce((n, s) => n + s.xp, 0))
const coreWarnings = computed(() => skills.value.filter((s) => s.importance === 4 && s.warn).length)

/* ---------- 卡片计算 ---------- */
const levelName = (s) => LEVELS[s.level]
const isMax = (s) => s.level >= LEVELS.length - 1
const progress = (s) => {
  if (isMax(s)) return 100
  const base = LEVEL_MIN[s.level]
  const next = LEVEL_MIN[s.level + 1]
  return Math.max(0, Math.min(100, ((s.xp - base) / (next - base)) * 100))
}
const nextNeed = (s) => (isMax(s) ? 0 : Math.max(0, LEVEL_MIN[s.level + 1] - s.xp))
const forgetPct = (s) => (s.forget / 4) * 100

/* ---------- 添加技能（本地演示） ---------- */
const showAdd = ref(false)
const draft = ref({ name: '', category: '', tier: 2, importance: 2, level: 0 })

function openAdd() {
  draft.value = { name: '', category: categories.value[0] || '编程语言', tier: 2, importance: 2, level: 0 }
  showAdd.value = true
}

function submitAdd() {
  const name = draft.value.name.trim()
  if (!name) return
  const baseXp = LEVEL_MIN[draft.value.level]
  skills.value.push({
    id: Date.now(),
    name,
    category: draft.value.category.trim() || '未分类',
    tier: Number(draft.value.tier),
    importance: Number(draft.value.importance),
    level: Number(draft.value.level),
    xp: baseXp,
    records: 0,
    daysAgo: 0,
    forget: 0,
    warn: false,
  })
  showAdd.value = false
}
</script>

<template>
  <div class="insist">
    <header class="nav">
      <span class="mark" aria-hidden="true">&gt;_</span>
      <span class="brand">INSIST</span>
      <router-link to="/index" class="back">返回论坛</router-link>
    </header>

    <main class="main">
      <!-- 概览 -->
      <section class="summary">
        <div class="stat"><span class="num">{{ skills.length }}</span><span class="label">技能</span></div>
        <div class="stat"><span class="num">{{ totalXp.toLocaleString() }}</span><span class="label">总 XP</span></div>
        <div class="stat" :class="{ alert: coreWarnings > 0 }">
          <span class="num">{{ coreWarnings }}</span><span class="label">核心待复习</span>
        </div>
        <button class="add-btn" type="button" @click="openAdd">＋ 添加技能</button>
      </section>

      <!-- 工具条 -->
      <section class="toolbar">
        <div class="ctl">
          <span class="ctl-label">分组</span>
          <select v-model="groupBy">
            <option value="importance">重要程度</option>
            <option value="category">分类</option>
            <option value="tier">难度阶</option>
          </select>
        </div>
        <div class="ctl">
          <span class="ctl-label">分类</span>
          <select v-model="filterCategory">
            <option value="all">全部</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="ctl">
          <span class="ctl-label">难度</span>
          <select v-model.number="filterTier">
            <option :value="0">全部</option>
            <option v-for="(t, i) in TIERS" :key="t" :value="i + 1">{{ t }}</option>
          </select>
        </div>
        <div class="ctl">
          <span class="ctl-label">排序</span>
          <select v-model="sortBy">
            <option value="proficiency">熟练度</option>
            <option value="recent">最近记录</option>
            <option value="name">名称</option>
          </select>
        </div>
      </section>

      <!-- 分组网格 -->
      <section v-if="visible.length === 0" class="empty">这个筛选下没有技能</section>

      <section v-for="group in groups" :key="group.key" class="group">
        <h2 class="group-title">
          <span class="dot" :class="groupBy === 'importance' ? 'imp-' + group.key : ''"></span>
          {{ group.label }}
          <span class="group-count">{{ group.items.length }}</span>
        </h2>

        <div class="grid">
          <article
            v-for="s in group.items"
            :key="s.id"
            class="card"
            :class="['imp-' + s.importance, { dusty: s.forget >= 2, warned: s.warn }]"
            :style="{ opacity: 1 - s.forget * 0.11 }"
          >
            <!-- 顶部：分类 + 难度阶 -->
            <div class="card-top">
              <span class="category">{{ s.category }}</span>
              <span class="tier" :aria-label="TIERS[s.tier - 1]">
                <i v-for="n in 4" :key="n" :class="{ on: n <= s.tier }"></i>
              </span>
            </div>

            <!-- 名称 -->
            <div class="card-name">
              <span>{{ s.name }}</span>
              <span v-if="s.importance === 4" class="core-star" title="核心技能">★</span>
            </div>

            <!-- 熟练度 -->
            <div class="prof">
              <div class="prof-head">
                <span class="level">{{ levelName(s) }}</span>
                <span class="xp">{{ s.xp }}<template v-if="!isMax(s)"> / {{ LEVEL_MIN[s.level + 1] }}</template><template v-else> · MAX</template></span>
              </div>
              <div class="bar"><i :style="{ width: progress(s) + '%' }"></i></div>
              <div class="dots">
                <i v-for="n in 5" :key="n" :class="{ on: n <= s.level + 1 }"></i>
                <span v-if="!isMax(s)" class="need">差 {{ nextNeed(s) }}</span>
              </div>
            </div>

            <!-- 元信息 + 遗忘环 -->
            <div class="card-foot">
              <span class="meta">{{ s.records }} 条 · {{ s.daysAgo }} 天前</span>
              <span class="forget" :title="'遗忘度：' + FORGET[s.forget]">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" class="ring-bg" />
                  <circle cx="12" cy="12" r="9" class="ring-fg" :class="{ danger: s.warn }"
                          :style="{ strokeDasharray: 2 * Math.PI * 9, strokeDashoffset: 2 * Math.PI * 9 * (1 - forgetPct(s) / 100) }" />
                </svg>
              </span>
            </div>
          </article>
        </div>
      </section>
    </main>

    <!-- 添加技能 -->
    <div v-if="showAdd" class="modal" @click.self="showAdd = false">
      <form class="dialog" @submit.prevent="submitAdd">
        <h3>添加技能</h3>

        <label class="field">
          <span>名称</span>
          <input v-model="draft.name" type="text" maxlength="30" placeholder="比如 C++、高等数学" autofocus />
        </label>

        <label class="field">
          <span>分类</span>
          <input v-model="draft.category" type="text" maxlength="20" list="cat-list" placeholder="编程语言 / 数学 / 生活…" />
          <datalist id="cat-list">
            <option v-for="c in categories" :key="c" :value="c" />
          </datalist>
        </label>

        <div class="field">
          <span>难度阶</span>
          <div class="chips">
            <button v-for="(t, i) in TIERS" :key="t" type="button"
                    :class="{ on: draft.tier === i + 1 }" @click="draft.tier = i + 1">{{ t }}</button>
          </div>
        </div>

        <div class="field">
          <span>重要程度</span>
          <div class="chips">
            <button v-for="(t, i) in IMPORTANCE" :key="t" type="button"
                    :class="{ on: draft.importance === i + 1 }" @click="draft.importance = i + 1">{{ t }}</button>
          </div>
        </div>

        <div class="field">
          <span>初始段位</span>
          <div class="chips">
            <button v-for="(t, i) in LEVELS" :key="t" type="button"
                    :class="{ on: draft.level === i }" @click="draft.level = i">{{ t }}</button>
          </div>
        </div>

        <footer class="dialog-foot">
          <button class="ghost" type="button" @click="showAdd = false">取消</button>
          <button class="primary" type="submit">添加</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.insist {
  min-height: 100vh;
  background: #000;
  color: #ededed;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", Inter, Helvetica, Arial, sans-serif;
  padding: 0 1.5rem 4rem;
}

/* ---------- 导航 ---------- */
.nav {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  max-width: 1120px;
  margin: 0 auto;
  padding: 1.4rem 0;
  border-bottom: 1px solid #141414;
}
.mark {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: #ededed;
}
.brand {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  color: #9a9a9a;
}
.back {
  margin-left: auto;
  color: #7a7a7a;
  text-decoration: none;
  font-size: 0.78rem;
}
.back:hover { color: #ededed; }

.main { max-width: 1120px; margin: 0 auto; }

/* ---------- 概览 ---------- */
.summary {
  display: flex;
  align-items: flex-end;
  gap: 2.2rem;
  padding: 1.6rem 0 1.2rem;
  border-bottom: 1px solid #141414;
}
.stat { display: flex; flex-direction: column; gap: 0.25rem; }
.stat .num {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1.5rem;
  line-height: 1;
  color: #ededed;
}
.stat .label { font-size: 0.7rem; color: #6f6f6f; letter-spacing: 0.08em; }
.stat.alert .num { color: #f85149; }

.add-btn {
  margin-left: auto;
  background: transparent;
  border: 1px solid #2a2a2a;
  color: #cfcfcf;
  font-size: 0.8rem;
  padding: 0.45rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.add-btn:hover { border-color: #4a4a4a; color: #fff; }

/* ---------- 工具条 ---------- */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1.1rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid #141414;
}
.ctl { display: flex; align-items: center; gap: 0.4rem; }
.ctl-label { font-size: 0.7rem; color: #5c5c5c; letter-spacing: 0.08em; }
select {
  background: #0a0a0a;
  border: 1px solid #222;
  color: #cfcfcf;
  font-size: 0.75rem;
  padding: 0.25rem 0.4rem;
  border-radius: 3px;
  outline: none;
}
select:focus { border-color: #444; }

/* ---------- 分组 ---------- */
.group { margin-top: 1.8rem; }
.group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: #8a8a8a;
  margin-bottom: 0.9rem;
}
.group-count { color: #4a4a4a; letter-spacing: 0; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3a3a; }
.dot.imp-4 { background: #ededed; }
.dot.imp-3 { background: #b9b9b9; }
.dot.imp-2 { background: #7a7a7a; }
.dot.imp-1 { background: #4a4a4a; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.9rem;
}

/* ---------- 卡片 ---------- */
.card {
  position: relative;
  border-radius: 8px;
  padding: 0.9rem 1rem 0.8rem;
  background: #070707;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.card:hover { transform: translateY(-2px); }

/* 重要程度 → 卡框 */
.card.imp-1 { border: 1px solid #171717; }
.card.imp-2 { border: 1px solid #242424; }
.card.imp-3 { border: 2px solid #333; }
.card.imp-4 {
  border: 2px solid #4a4a4a;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 24px rgba(255, 255, 255, 0.06);
}

.card-top { display: flex; align-items: center; justify-content: space-between; }
.category { font-size: 0.66rem; color: #6a6a6a; letter-spacing: 0.1em; }

/* 难度阶：4 格 */
.tier { display: inline-flex; gap: 3px; }
.tier i {
  display: block;
  width: 10px;
  height: 3px;
  background: #232323;
  border-radius: 1px;
}
.tier i.on { background: #cfcfcf; }

.card-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.55rem;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.core-star { font-size: 0.8rem; color: #ededed; }

/* 熟练度 */
.prof { margin-top: 0.85rem; }
.prof-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 0.7rem;
}
.level { color: #cfcfcf; letter-spacing: 0.08em; }
.xp {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.66rem;
  color: #6a6a6a;
}
.bar {
  margin-top: 0.35rem;
  height: 4px;
  background: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #8a8a8a, #ededed);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.dots { display: flex; align-items: center; gap: 4px; margin-top: 0.45rem; }
.dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #232323;
}
.dots i.on { background: #cfcfcf; }
.need {
  margin-left: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.62rem;
  color: #4f4f4f;
}

/* 底部 */
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.8rem;
}
.meta { font-size: 0.64rem; color: #565656; }

.forget svg { width: 16px; height: 16px; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: #1e1e1e; stroke-width: 2; }
.ring-fg {
  fill: none;
  stroke: #8a8a8a;
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}
.ring-fg.danger { stroke: #f85149; }

/* 蒙尘（遗忘 ≥ 中等） */
.card.dusty .card-name { color: #b8b8b8; }
.card.dusty .bar i { background: linear-gradient(90deg, #5a5a5a, #9a9a9a); }

.empty {
  padding: 3rem 0;
  text-align: center;
  color: #6a6a6a;
  font-size: 0.85rem;
}

/* ---------- 弹窗 ---------- */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 50;
}
.dialog {
  width: min(460px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  background: #070707;
  border: 1px solid #242424;
  border-radius: 10px;
  padding: 1.2rem 1.2rem 0.9rem;
}
.dialog h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; }

.field { display: block; margin-bottom: 0.85rem; }
.field > span {
  display: block;
  font-size: 0.7rem;
  color: #6a6a6a;
  letter-spacing: 0.08em;
  margin-bottom: 0.35rem;
}
.field input {
  width: 100%;
  background: #0c0c0c;
  border: 1px solid #222;
  border-radius: 4px;
  color: #ededed;
  font-size: 0.85rem;
  padding: 0.45rem 0.55rem;
  outline: none;
}
.field input:focus { border-color: #444; }
.field input::placeholder { color: #4a4a4a; }

.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips button {
  background: transparent;
  border: 1px solid #222;
  color: #8a8a8a;
  font-size: 0.75rem;
  padding: 0.28rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
}
.chips button.on { border-color: #6a6a6a; color: #ededed; background: #111; }

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.4rem;
}
.ghost, .primary {
  font-size: 0.8rem;
  padding: 0.42rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #222;
  background: transparent;
  color: #8a8a8a;
}
.ghost:hover { color: #ededed; border-color: #444; }
.primary { background: #ededed; border-color: #ededed; color: #000; }
.primary:hover { background: #fff; }

/* ---------- 响应 ---------- */
@media (max-width: 720px) {
  .insist { padding: 0 1rem 3rem; }
  .summary { gap: 1.4rem; flex-wrap: wrap; }
  .add-btn { margin-left: 0; width: 100%; }
  .grid { grid-template-columns: 1fr; }
}
</style>
