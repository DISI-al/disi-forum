<script setup>
/**
 * INSIST · 经验卡详情（接后端）
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InsistNav from '../components/InsistNav.vue'
import { apiCard, apiSkills, apiCheckin, apiCompleteCard, apiPatchCard, apiDeleteCard } from '../api/insist_api.js'
import { tierName, kindLabel, statusLabel } from '../insist/constants.js'

const route = useRoute()
const router = useRouter()
const card = ref(null)
const skillName = ref('')
const loading = ref(true)
const error = ref('')
const notice = ref('')
const busy = ref(false)
const showEdit = ref(false)
const savingEdit = ref(false)
const confirmDelete = ref(false)
const editDraft = ref({ title: '', detail: '', tier: 2, xpValue: 0 })

const isHabit = computed(() => card.value?.kind === 'habit')
const isAchievement = computed(() => card.value?.kind === 'achievement')
const isDone = computed(() => card.value?.status === 'done')
// 成就卡回成就墙，其他回卡片库
const backPath = computed(() => (isAchievement.value ? '/insist/achievements' : '/insist/cards'))
const backLabel = computed(() => (isAchievement.value ? '成就墙' : '卡片库'))

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

function openEdit() {
  editDraft.value = {
    title: card.value.title,
    detail: card.value.detail || '',
    tier: card.value.tier,
    xpValue: card.value.xpValue,
  }
  error.value = ''
  showEdit.value = true
}

async function submitEdit() {
  if (savingEdit.value) return
  const title = editDraft.value.title.trim()
  if (!title) return
  savingEdit.value = true
  try {
    await apiPatchCard(route.params.id, {
      title,
      detail: editDraft.value.detail,
      tier: Number(editDraft.value.tier),
      xp_value: card.value.kind === 'habit' ? 0 : Number(editDraft.value.xpValue) || 0,
    })
    showEdit.value = false
    await load()
    notice.value = '已保存'
  } catch (e) {
    error.value = e.message || '保存失败'
  } finally {
    savingEdit.value = false
  }
}

async function removeCard() {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    setTimeout(() => (confirmDelete.value = false), 3000)
    return
  }
  busy.value = true
  try {
    await apiDeleteCard(route.params.id)
    router.push(backPath.value)
  } catch (e) {
    error.value = e.message || '删除失败'
    busy.value = false
  }
}

async function checkin() {
  if (busy.value) return
  busy.value = true
  try {
    const res = await apiCheckin(card.value.id)
    notice.value = `打卡成功 +${res.xp} XP` + (res.streak > 1 ? ` · 连续 ${res.streak} 天` : '') + (res.awards?.length ? ` · 获得成就「${res.awards.join('、')}」` : '')
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
    notice.value = `已结算 +${card.value.xpValue} XP` + (res.awards?.length ? ` · 获得成就「${res.awards.join('、')}」` : '')
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
        <router-link :to="backPath">{{ backLabel }}</router-link>
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

          <button class="insist-btn" type="button" @click="openEdit">编辑卡片</button>
          <router-link :to="backPath" class="insist-btn">返回{{ backLabel }}</router-link>

          <button class="insist-btn danger" type="button" :disabled="busy" @click="removeCard">
            {{ confirmDelete ? '再点一次确认删除' : '删除卡片' }}
          </button>
        </div>
      </template>

      <!-- 编辑卡片 -->
      <div v-if="showEdit" class="modal" @click.self="showEdit = false">
        <form class="dialog" @submit.prevent="submitEdit">
          <h3>编辑卡片</h3>

          <label class="field"><span>标题</span>
            <input v-model="editDraft.title" type="text" maxlength="120" autofocus />
          </label>

          <label class="field"><span>描述 / 内容</span>
            <textarea v-model="editDraft.detail" rows="3" maxlength="1000" />
          </label>

          <div class="field"><span>等级</span>
            <div class="chips">
              <button v-for="t in ['低阶', '中阶', '高阶', '臻阶']" :key="t" type="button"
                :class="{ on: editDraft.tier === ['低阶', '中阶', '高阶', '臻阶'].indexOf(t) + 1 }"
                @click="editDraft.tier = ['低阶', '中阶', '高阶', '臻阶'].indexOf(t) + 1">{{ t }}</button>
            </div>
          </div>

          <label v-if="card.kind !== 'habit'" class="field"><span>奖励 XP</span>
            <input v-model.number="editDraft.xpValue" type="number" min="0" step="10" />
          </label>

          <p v-if="error" class="dialog-err">{{ error }}</p>

          <footer class="dialog-foot">
            <button class="insist-btn" type="button" @click="showEdit = false">取消</button>
            <button class="insist-btn primary" type="submit" :disabled="savingEdit">{{ savingEdit ? '保存中…' : '保存' }}</button>
          </footer>
        </form>
      </div>
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
.desc { margin-top: 0.5rem; font-size: 0.82rem; color: #8a8a8a; line-height: 1.7; max-width: 44rem; white-space: pre-line; word-break: break-word; }

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
.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { width: min(440px, 100%); max-height: 86vh; overflow-y: auto; background: #070707; border: 1px solid #242424; border-radius: 10px; padding: 1.2rem 1.2rem 0.9rem; }
.dialog h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; }
.field { display: block; margin-bottom: 0.85rem; }
.field > span { display: block; font-size: 0.7rem; color: #6a6a6a; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
.field input, .field textarea { width: 100%; background: #0c0c0c; border: 1px solid #222; border-radius: 4px; color: #ededed; font-size: 0.85rem; padding: 0.45rem 0.55rem; outline: none; resize: vertical; }
.field input:focus, .field textarea:focus { border-color: #444; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips button { background: transparent; border: 1px solid #222; color: #8a8a8a; font-size: 0.75rem; padding: 0.28rem 0.6rem; border-radius: 4px; cursor: pointer; }
.chips button.on { border-color: #6a6a6a; color: #ededed; background: #111; }
.dialog-err { color: #f85149; font-size: 0.74rem; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.4rem; }
</style>
