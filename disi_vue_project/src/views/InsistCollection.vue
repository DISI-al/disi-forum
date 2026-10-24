<script setup>
/**
 * INSIST · 收藏室（接后端）
 */
import { ref, computed, onMounted } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { apiSkills, apiCreateSkill } from '../api/insist_api.js'
import { TIERS, IMPORTANCE, LEVELS, LEVEL_MIN, stars, forgetClass } from '../insist/constants.js'

const loading = ref(true)
const error = ref('')
const skills = ref([])

const groupBy = ref('importance')
const filterCategory = ref('all')
const filterTier = ref(0)
const sortBy = ref('proficiency')

const showAdd = ref(false)
const saving = ref(false)
const draft = ref({ name: '', category: '', tier: 2, importance: 2, level: 0 })

const categories = computed(() => [...new Set(skills.value.map((s) => s.category))])

const visible = computed(() => {
  let list = skills.value.filter((s) => {
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
    const key = groupBy.value === 'importance' ? s.importance : groupBy.value === 'tier' ? s.tier : s.category
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  }
  const keys = [...map.keys()]
  if (groupBy.value === 'category') keys.sort((a, b) => String(a).localeCompare(String(b), 'zh'))
  else keys.sort((a, b) => b - a)
  return keys.map((key) => ({
    key,
    label: groupBy.value === 'importance' ? IMPORTANCE[key - 1] : groupBy.value === 'tier' ? TIERS[key - 1] : key,
    items: map.get(key),
  }))
})

const totalXp = computed(() => skills.value.reduce((n, s) => n + s.xp, 0))
const fullCount = computed(() => skills.value.filter((s) => s.saturated).length)

async function load() {
  loading.value = true
  error.value = ''
  try {
    skills.value = await apiSkills()
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openAdd() {
  draft.value = { name: '', category: categories.value[0] || '编程语言', tier: 2, importance: 2, level: 0 }
  error.value = ''
  showAdd.value = true
}

async function submitAdd() {
  const name = draft.value.name.trim()
  if (!name || saving.value) return
  saving.value = true
  try {
    await apiCreateSkill({
      name,
      category: draft.value.category.trim() || '未分类',
      tier: Number(draft.value.tier),
      importance: Number(draft.value.importance),
      level: Number(draft.value.level),
      xp: LEVEL_MIN[Number(draft.value.level)] || 0,
    })
    showAdd.value = false
    await load()
  } catch (e) {
    error.value = e.message || '创建失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="insist-page">
    <InsistNav active="collection" />

    <main class="insist-main">
      <nav class="insist-crumb"><router-link to="/insist">← 主页</router-link></nav>

      <section class="summary">
        <div class="stat"><span class="num mono">{{ skills.length }}</span><span class="label">技能</span></div>
        <div class="stat"><span class="num mono">{{ totalXp.toLocaleString() }}</span><span class="label">总 XP</span></div>
        <div class="stat" :class="{ alert: fullCount > 0 }">
          <span class="num mono">{{ fullCount }}</span><span class="label">爆满待晋升</span>
        </div>
        <button class="insist-btn primary add-btn" type="button" @click="openAdd">＋ 新建技能</button>
      </section>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>

      <template v-else>
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

        <p v-if="visible.length === 0" class="insist-empty">还没有技能，点右上角「新建技能」开始。</p>

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
                <span class="sk-tier"><i v-for="n in 4" :key="n" :class="{ on: n <= s.tier }"></i></span>
              </div>

              <div class="sk-name">
                <span>{{ s.name }}</span>
                <span class="sk-stars">{{ stars(s.importance) }}</span>
              </div>

              <div class="sk-prof">
                <div class="sk-prof-head">
                  <span class="sk-level">{{ s.levelName }}</span>
                  <span class="sk-xp">{{ s.xp }}<template v-if="!s.saturated"> / {{ s.xp + s.nextNeed }}</template><template v-else> · 爆满</template></span>
                </div>
                <div class="insist-bar" :class="{ full: s.saturated }"><i :style="{ width: s.progress + '%' }"></i></div>
              </div>

              <div class="sk-foot">
                <span>{{ s.records }} 条 · {{ s.daysAgo }} 天前</span>
                <span class="sk-forget" :class="forgetClass(s.forget)">遗忘 {{ s.forget }}%</span>
              </div>
            </router-link>
          </div>
        </section>
      </template>

      <div v-if="showAdd" class="modal" @click.self="showAdd = false">
        <form class="dialog" @submit.prevent="submitAdd">
          <h3>新建技能</h3>

          <label class="field"><span>名称</span>
            <input v-model="draft.name" type="text" maxlength="60" placeholder="比如 C++、高等数学" autofocus />
          </label>

          <label class="field"><span>分类</span>
            <input v-model="draft.category" type="text" maxlength="30" list="cat-list" placeholder="编程语言 / 数学 / 生活…" />
            <datalist id="cat-list"><option v-for="c in categories" :key="c" :value="c" /></datalist>
          </label>

          <div class="field"><span>难度阶</span>
            <div class="chips">
              <button v-for="(t, i) in TIERS" :key="t" type="button" :class="{ on: draft.tier === i + 1 }" @click="draft.tier = i + 1">{{ t }}</button>
            </div>
          </div>

          <div class="field"><span>重要程度</span>
            <div class="chips">
              <button v-for="(t, i) in IMPORTANCE" :key="t" type="button" :class="{ on: draft.importance === i + 1 }" @click="draft.importance = i + 1">{{ t }}</button>
            </div>
          </div>

          <div class="field">
            <span>初始熟练度</span>
            <div class="chips">
              <button
                v-for="(name, i) in LEVELS" :key="name" type="button"
                :class="{ on: draft.level === i }" @click="draft.level = i"
              >{{ name }}</button>
            </div>
            <p class="field-hint">已经有基础的技能直接选段位，XP 从该段位起点算；选「初识」就是从零开始。</p>
          </div>

          <p v-if="error" class="dialog-err">{{ error }}</p>

          <footer class="dialog-foot">
            <button class="insist-btn" type="button" @click="showAdd = false">取消</button>
            <button class="insist-btn primary" type="submit" :disabled="saving">{{ saving ? '创建中…' : '创建' }}</button>
          </footer>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.state { color: #8a8a8a; font-size: 0.82rem; padding: 1rem 0; }
.state.err { color: #f85149; }

.summary { display: flex; align-items: flex-end; gap: 2.2rem; padding: 1.2rem 0 1rem; border-bottom: 1px solid #141414; }
.stat { display: flex; flex-direction: column; gap: 0.2rem; }
.stat .num { font-size: 1.45rem; line-height: 1; color: #ededed; }
.stat .label { font-size: 0.66rem; color: #6f6f6f; letter-spacing: 0.08em; }
.stat.alert .num { color: #f85149; }
.add-btn { margin-left: auto; }

.toolbar { display: flex; flex-wrap: wrap; gap: 1.1rem; padding: 0.85rem 0; border-bottom: 1px solid #141414; }
.ctl { display: flex; align-items: center; gap: 0.4rem; }
.ctl span { font-size: 0.68rem; color: #5c5c5c; letter-spacing: 0.08em; }
select { background: #0a0a0a; border: 1px solid #222; color: #cfcfcf; font-size: 0.72rem; padding: 0.22rem 0.4rem; border-radius: 3px; outline: none; }
select:focus { border-color: #444; }

.group { margin-top: 1.6rem; }
.group-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.16em; color: #8a8a8a; margin-bottom: 0.75rem; }
.count { color: #4a4a4a; letter-spacing: 0; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3a3a; }
.dot.imp-4 { background: #ededed; }
.dot.imp-3 { background: #b9b9b9; }
.dot.imp-2 { background: #7a7a7a; }
.dot.imp-1 { background: #4a4a4a; }

.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { width: min(440px, 100%); max-height: 86vh; overflow-y: auto; background: #070707; border: 1px solid #242424; border-radius: 10px; padding: 1.2rem 1.2rem 0.9rem; }
.dialog h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; }
.field { display: block; margin-bottom: 0.85rem; }
.field > span { display: block; font-size: 0.7rem; color: #6a6a6a; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
.field input { width: 100%; background: #0c0c0c; border: 1px solid #222; border-radius: 4px; color: #ededed; font-size: 0.85rem; padding: 0.45rem 0.55rem; outline: none; }
.field input:focus { border-color: #444; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips button { background: transparent; border: 1px solid #222; color: #8a8a8a; font-size: 0.75rem; padding: 0.28rem 0.6rem; border-radius: 4px; cursor: pointer; }
.chips button.on { border-color: #6a6a6a; color: #ededed; background: #111; }
.field-hint { margin-top: 0.4rem; font-size: 0.66rem; color: #5f5f5f; line-height: 1.6; }
.dialog-err { color: #f85149; font-size: 0.74rem; margin: 0.3rem 0 0; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.4rem; }
</style>
