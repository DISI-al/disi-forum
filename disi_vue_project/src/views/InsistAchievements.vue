<script setup>
/**
 * INSIST · 成就墙（接后端）
 * 成就卡录入即获得，可以关联技能作为晋升凭证。
 */
import { ref, computed, onMounted } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { apiCards, apiSkills, apiCreateCard, apiDeleteCard } from '../api/insist_api.js'
import { TIERS, tierName } from '../insist/constants.js'

const loading = ref(true)
const error = ref('')
const notice = ref('')
const cards = ref([])
const skills = ref([])

const showAdd = ref(false)
const saving = ref(false)
const busyId = ref('')
const confirmId = ref('')
const draft = ref({ title: '', tier: 3, skillId: '', detail: '' })

const earned = computed(() => cards.value.filter((c) => c.kind === 'achievement'))
const skillName = (id) => skills.value.find((s) => s.id === id)?.name || ''

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [cs, sk] = await Promise.all([apiCards({ kind: 'achievement' }), apiSkills()])
    cards.value = cs
    skills.value = sk
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openAdd() {
  draft.value = { title: '', tier: 3, skillId: '', detail: '' }
  error.value = ''
  showAdd.value = true
}

async function submitAdd() {
  const title = draft.value.title.trim()
  if (!title || saving.value) return
  saving.value = true
  try {
    await apiCreateCard({
      kind: 'achievement',
      title,
      tier: Number(draft.value.tier),
      skill_id: draft.value.skillId || null,
      detail: draft.value.detail,
    })
    showAdd.value = false
    await load()
    notice.value = '已加入成就墙'
  } catch (e) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
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
    <InsistNav active="achievements" />

    <main class="insist-main">
      <nav class="insist-crumb"><router-link to="/insist">← 主页</router-link></nav>

      <section class="head">
        <div class="head-left">
          <h1>成就墙</h1>
          <span class="count">{{ earned.length }} 枚</span>
        </div>
        <button class="insist-btn primary" type="button" @click="openAdd">＋ 录入成就</button>
      </section>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>
      <p v-else-if="notice" class="notice">{{ notice }}</p>

      <template v-else-if="earned.length === 0">
        <p class="insist-empty">还没有成就卡，点右上角「录入成就」——比赛、证书、里程碑都可以，录入即获得。</p>
      </template>

      <div v-else class="ach-grid">
        <div v-for="a in earned" :key="a.id" class="ach-wrap">
          <router-link class="ach" :class="'tier-' + a.tier" :to="'/insist/card/' + a.id">
            <div class="ach-top">
              <span class="ach-star">✦</span>
              <span class="ach-grade">{{ tierName(a.tier) }}</span>
            </div>
            <h3 class="ach-name">{{ a.title }}</h3>
            <span class="ach-date">{{ a.detail || '已获得' }}</span>
            <span v-if="a.skillId" class="ach-skill">关联：{{ skillName(a.skillId) || '技能' }}</span>
          </router-link>
          <button
            class="ach-del"
            type="button"
            :disabled="busyId === a.id"
            @click="remove(a)"
          >{{ confirmId === a.id ? '确认删除' : '删除' }}</button>
        </div>
      </div>

      <div v-if="showAdd" class="modal" @click.self="showAdd = false">
        <form class="dialog" @submit.prevent="submitAdd">
          <h3>录入成就</h3>

          <label class="field"><span>名称</span>
            <input v-model="draft.title" type="text" maxlength="120" placeholder="比如 算法比赛二等奖" autofocus />
          </label>

          <div class="field"><span>等级</span>
            <div class="chips">
              <button v-for="t in [1,2,3,4]" :key="t" type="button" :class="{ on: draft.tier === t }" @click="draft.tier = t">{{ tierName(t) }}</button>
            </div>
          </div>

          <label class="field"><span>关联技能（可选，作为晋升凭证）</span>
            <select v-model="draft.skillId">
              <option value="">不关联</option>
              <option v-for="s in skills" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>

          <label class="field"><span>说明</span>
            <input v-model="draft.detail" type="text" maxlength="200" placeholder="比赛 / 证书 / 时间等" />
          </label>

          <p v-if="error" class="dialog-err">{{ error }}</p>

          <footer class="dialog-foot">
            <button class="insist-btn" type="button" @click="showAdd = false">取消</button>
            <button class="insist-btn primary" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
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

.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: 1.2rem; padding-bottom: 0.8rem; border-bottom: 1px solid #141414; flex-wrap: wrap; }
.head h1 { font-size: 1.05rem; font-weight: 600; margin: 0; }
.count { margin-left: 0.7rem; font-size: 0.68rem; color: #5f5f5f; }

.ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.75rem; margin-top: 0.9rem; }
.ach-wrap { position: relative; }
.ach { display: block; color: inherit; text-decoration: none; padding: 0.85rem 0.9rem 0.7rem; border: 1px solid #242424; border-radius: 8px; background: #070707; transition: transform 0.15s ease, border-color 0.15s ease; }
.ach.tier-3 { border-color: #3a3a3a; }
.ach.tier-4 { border-color: #5a5a5a; box-shadow: 0 0 22px rgba(255, 255, 255, 0.05); }
.ach:hover { transform: translateY(-2px); border-color: #5a5a5a; }
.ach-top { display: flex; align-items: center; justify-content: space-between; font-size: 0.62rem; color: #6a6a6a; }
.ach-star { font-size: 0.7rem; color: #6a6a6a; }
.ach.tier-4 .ach-star { color: #ededed; }
.ach.tier-3 .ach-star { color: #b9b9b9; }
.ach-name { margin-top: 0.5rem; font-size: 0.9rem; font-weight: 600; }
.ach-date { display: block; margin-top: 0.35rem; font-size: 0.64rem; color: #5f5f5f; }
.ach-skill { display: block; margin-top: 0.3rem; font-size: 0.62rem; color: #6a6a6a; }

.ach-del {
  position: absolute;
  top: 0.55rem;
  right: 0.55rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid #2a2a2a;
  color: #7a7a7a;
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.ach-wrap:hover .ach-del { opacity: 1; }
.ach-del:hover { color: #f85149; border-color: rgba(248, 81, 73, 0.5); }

.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { width: min(440px, 100%); background: #070707; border: 1px solid #242424; border-radius: 10px; padding: 1.2rem 1.2rem 0.9rem; }
.dialog h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; }
.field { display: block; margin-bottom: 0.85rem; }
.field > span { display: block; font-size: 0.7rem; color: #6a6a6a; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
.field input, .field select { width: 100%; background: #0c0c0c; border: 1px solid #222; border-radius: 4px; color: #ededed; font-size: 0.85rem; padding: 0.45rem 0.55rem; outline: none; }
.field input:focus, .field select:focus { border-color: #444; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips button { background: transparent; border: 1px solid #222; color: #8a8a8a; font-size: 0.75rem; padding: 0.28rem 0.6rem; border-radius: 4px; cursor: pointer; }
.chips button.on { border-color: #6a6a6a; color: #ededed; background: #111; }
.dialog-err { color: #f85149; font-size: 0.74rem; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.4rem; }
</style>
