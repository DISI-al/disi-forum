<script setup>
/**
 * INSIST · 卡片库（接后端）
 * 只放经验卡：任务 / 打卡 / 项目。成就卡在「成就」页。
 */
import { ref, computed, onMounted } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { apiCards, apiSkills, apiCreateCard, apiCompleteCard, apiDeleteCard } from '../api/insist_api.js'
import { TIERS, kindLabel, tierName, statusLabel } from '../insist/constants.js'

const loading = ref(true)
const error = ref('')
const notice = ref('')
const cards = ref([])
const skills = ref([])

const tabs = [
  { key: 'task', label: '任务卡' },
  { key: 'habit', label: '打卡卡' },
  { key: 'project', label: '项目卡' },
]
const tab = ref('task')

const showAdd = ref(false)
const saving = ref(false)
const busyId = ref('')
const confirmId = ref('')
const draft = ref({ kind: 'task', title: '', detail: '', tier: 2, skillId: '', xpValue: 100, cycleDays: 30, dailyTarget: '' })

// 经验卡（排除成就卡）
const experience = computed(() => cards.value.filter((c) => c.kind !== 'achievement'))
const list = computed(() => experience.value.filter((c) => c.kind === tab.value))
// 未完成 / 已完成各放一起
const openList = computed(() => list.value.filter((c) => c.status === 'active'))
const closedList = computed(() => list.value.filter((c) => c.status !== 'active'))
const countOf = (kind) => experience.value.filter((c) => c.kind === kind).length
const skillName = (id) => skills.value.find((s) => s.id === id)?.name || ''

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [cs, sk] = await Promise.all([apiCards(), apiSkills()])
    cards.value = cs
    skills.value = sk
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openAdd() {
  draft.value = {
    kind: tab.value,
    title: '',
    detail: '',
    tier: 2,
    skillId: skills.value[0]?.id || '',
    xpValue: 100,
    cycleDays: 30,
    dailyTarget: '',
  }
  error.value = ''
  showAdd.value = true
}

async function submitAdd() {
  const title = draft.value.title.trim()
  if (!title || saving.value) return
  saving.value = true
  try {
    await apiCreateCard({
      kind: draft.value.kind,
      title,
      detail: draft.value.detail,
      tier: Number(draft.value.tier),
      skill_id: draft.value.skillId || null,
      xp_value: draft.value.kind === 'habit' ? 0 : Number(draft.value.xpValue) || 0,
      cycle_days: draft.value.kind === 'habit' ? Number(draft.value.cycleDays) || 30 : null,
      daily_target: draft.value.kind === 'habit' ? draft.value.dailyTarget : null,
    })
    showAdd.value = false
    tab.value = draft.value.kind
    await load()
    notice.value = '已添加'
  } catch (e) {
    error.value = e.message || '创建失败'
  } finally {
    saving.value = false
  }
}

async function complete(card) {
  if (busyId.value) return
  busyId.value = card.id
  try {
    const res = await apiCompleteCard(card.id)
    notice.value = `已结算 +${card.xpValue} XP` + (res.awards?.length ? ` · 获得成就「${res.awards.join('、')}」` : '')
    await load()
  } catch (e) {
    error.value = e.message || '结算失败'
  } finally {
    busyId.value = ''
  }
}

async function remove(card) {
  if (confirmId.value !== card.id) {
    confirmId.value = card.id
    setTimeout(() => { if (confirmId.value === card.id) confirmId.value = '' }, 3000)
    return
  }
  busyId.value = card.id
  confirmId.value = ''
  try {
    await apiDeleteCard(card.id)
    await load()
    notice.value = '已删除'
  } catch (e) {
    error.value = e.message || '删除失败'
  } finally {
    busyId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="insist-page">
    <InsistNav active="cards" />

    <main class="insist-main">
      <nav class="insist-crumb"><router-link to="/insist">← 主页</router-link></nav>

      <section class="head">
        <div class="tabs">
          <button
            v-for="t in tabs" :key="t.key" type="button" class="tab"
            :class="{ on: tab === t.key }" @click="tab = t.key"
          >{{ t.label }} <span class="num">{{ countOf(t.key) }}</span></button>
        </div>
        <button class="insist-btn primary" type="button" @click="openAdd">＋ 新建{{ tabs.find(t => t.key === tab)?.label }}</button>
      </section>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>
      <p v-else-if="notice" class="notice">{{ notice }}</p>
      <p v-else-if="list.length === 0" class="insist-empty">这一类还没有卡片</p>

      <template v-if="!loading && !error && list.length">
        <section v-if="openList.length" class="group">
          <h2 class="group-title">未完成 <span class="count">{{ openList.length }}</span></h2>
          <ul class="card-list">
            <li v-for="c in openList" :key="c.id">
              <div class="row" :class="c.kind">
                <span class="kind">{{ kindLabel(c.kind) }}</span>

                <router-link class="main" :to="'/insist/card/' + c.id">
                  <div class="title">{{ c.title }}</div>
                  <div class="sub">
                    {{ skillName(c.skillId) || '未关联技能' }} · {{ tierName(c.tier) }}
                    <template v-if="c.phase"> · 阶段 {{ c.phase }}</template>
                  </div>
                </router-link>

                <div class="prog">
                  <div class="insist-bar small"><i :style="{ width: c.progress + '%' }"></i></div>
                  <span class="mono">{{ c.progress }}%</span>
                </div>

                <span class="xp mono">+{{ c.xpValue }}</span>

                <button
                  v-if="c.kind === 'task' || c.kind === 'project'"
                  class="insist-btn"
                  type="button"
                  :disabled="busyId === c.id"
                  @click="complete(c)"
                >完成</button>

                <button
                  class="insist-btn danger"
                  type="button"
                  :disabled="busyId === c.id"
                  @click="remove(c)"
                >{{ confirmId === c.id ? '确认删除' : '删除' }}</button>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="closedList.length" class="group">
          <h2 class="group-title">已完成 <span class="count">{{ closedList.length }}</span></h2>
          <ul class="card-list">
            <li v-for="c in closedList" :key="c.id">
              <div class="row done" :class="c.kind">
                <span class="kind">{{ kindLabel(c.kind) }}</span>

                <router-link class="main" :to="'/insist/card/' + c.id">
                  <div class="title">{{ c.title }}</div>
                  <div class="sub">
                    {{ skillName(c.skillId) || '未关联技能' }} · {{ tierName(c.tier) }} · {{ statusLabel(c.status) }}
                    <template v-if="c.phase"> · 阶段 {{ c.phase }}</template>
                  </div>
                </router-link>

                <span class="xp mono">+{{ c.xpValue }}</span>

                <button
                  class="insist-btn danger"
                  type="button"
                  :disabled="busyId === c.id"
                  @click="remove(c)"
                >{{ confirmId === c.id ? '确认删除' : '删除' }}</button>
              </div>
            </li>
          </ul>
        </section>
      </template>

      <p class="hint">打卡卡：每天结算，达到阈值可进化成任务卡。任务卡：完成一次性结算。项目卡：按阶段分批结算。成就卡在「成就」页录入，不入卡片库。</p>

      <div v-if="showAdd" class="modal" @click.self="showAdd = false">
        <form class="dialog" @submit.prevent="submitAdd">
          <h3>新建{{ tabs.find(t => t.key === draft.kind)?.label }}</h3>

          <div class="field"><span>类型</span>
            <div class="chips">
              <button v-for="t in tabs" :key="t.key" type="button"
                :class="{ on: draft.kind === t.key }" @click="draft.kind = t.key">{{ t.label }}</button>
            </div>
          </div>

          <label class="field"><span>标题</span>
            <input v-model="draft.title" type="text" maxlength="120" placeholder="比如 读完 Primer 第 3 章" autofocus />
          </label>

          <label class="field"><span>详情</span>
            <textarea v-model="draft.detail" rows="3" maxlength="1000" placeholder="补充说明、拆分步骤、参考资料…（会显示在卡片详情页）" />
          </label>

          <div class="field"><span>等级</span>
            <div class="chips">
              <button v-for="(t, i) in TIERS" :key="t" type="button" :class="{ on: draft.tier === i + 1 }" @click="draft.tier = i + 1">{{ t }}</button>
            </div>
          </div>

          <label class="field"><span>关联技能</span>
            <select v-model="draft.skillId">
              <option value="">不关联</option>
              <option v-for="s in skills" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>

          <label v-if="draft.kind !== 'habit'" class="field"><span>完成奖励 XP</span>
            <input v-model.number="draft.xpValue" type="number" min="0" step="10" />
          </label>

          <template v-if="draft.kind === 'habit'">
            <label class="field"><span>每日目标</span>
              <input v-model="draft.dailyTarget" type="text" maxlength="60" placeholder="比如 20 个单词 / 30 分钟" />
            </label>
            <label class="field"><span>周期（天）</span>
              <input v-model.number="draft.cycleDays" type="number" min="1" step="1" />
            </label>
          </template>

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
.notice { margin-top: 0.8rem; font-size: 0.74rem; color: #b9b9b9; }

.head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1.2rem; padding-bottom: 0.7rem; border-bottom: 1px solid #141414; flex-wrap: wrap; }
.tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.tab { background: transparent; border: 1px solid transparent; color: #7a7a7a; font-size: 0.78rem; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; }
.tab:hover { color: #ededed; }
.tab.on { color: #ededed; border-color: #2a2a2a; background: #0a0a0a; }
.tab .num { color: #5f5f5f; font-size: 0.66rem; }

.card-list { list-style: none; margin-top: 0.4rem; }
.row { display: flex; align-items: center; gap: 0.9rem; padding: 0.75rem 0.1rem; border-bottom: 1px solid #101010; }
.row.done { opacity: 0.62; }
.row:hover { background: #060606; }
.kind { flex-shrink: 0; font-size: 0.62rem; color: #8a8a8a; border: 1px solid #242424; border-radius: 3px; padding: 0.08rem 0.3rem; width: 2.4rem; text-align: center; }
.row.project .kind { border-color: #444; color: #cfcfcf; }
.main { flex: 1; min-width: 0; color: inherit; text-decoration: none; }
.main:hover .title { color: #fff; }
.title { font-size: 0.86rem; }
.sub { margin-top: 0.15rem; font-size: 0.64rem; color: #5f5f5f; }
.prog { display: flex; align-items: center; gap: 0.5rem; width: 130px; }
.prog .insist-bar { flex: 1; }
.prog .mono { font-size: 0.64rem; color: #6a6a6a; width: 2.6rem; text-align: right; }
.xp { font-size: 0.7rem; color: #8a8a8a; width: 3.2rem; text-align: right; }
.hint { margin-top: 1.4rem; font-size: 0.68rem; color: #5f5f5f; line-height: 1.7; }

.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { width: min(460px, 100%); max-height: 86vh; overflow-y: auto; background: #070707; border: 1px solid #242424; border-radius: 10px; padding: 1.2rem 1.2rem 0.9rem; }
.dialog h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; }
.field { display: block; margin-bottom: 0.85rem; }
.field > span { display: block; font-size: 0.7rem; color: #6a6a6a; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
.field textarea { width: 100%; background: #0c0c0c; border: 1px solid #222; border-radius: 4px; color: #ededed; font-size: 0.85rem; padding: 0.45rem 0.55rem; outline: none; resize: vertical; font-family: inherit; }
.field textarea:focus { border-color: #444; }
.field input, .field select { width: 100%; background: #0c0c0c; border: 1px solid #222; border-radius: 4px; color: #ededed; font-size: 0.85rem; padding: 0.45rem 0.55rem; outline: none; }
.field input:focus, .field select:focus { border-color: #444; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips button { background: transparent; border: 1px solid #222; color: #8a8a8a; font-size: 0.75rem; padding: 0.28rem 0.6rem; border-radius: 4px; cursor: pointer; }
.chips button.on { border-color: #6a6a6a; color: #ededed; background: #111; }
.dialog-err { color: #f85149; font-size: 0.74rem; margin: 0.3rem 0 0; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.4rem; }

@media (max-width: 720px) {
  .row { flex-wrap: wrap; row-gap: 0.35rem; }
  .prog { width: 100%; }
}
.group { margin-top: 1.3rem; }
.group-title { display: flex; align-items: center; gap: 0.45rem; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.14em; color: #8a8a8a; margin-bottom: 0.4rem; }
.group-title .count { color: #4a4a4a; letter-spacing: 0; }
</style>
