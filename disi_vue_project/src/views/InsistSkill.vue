<script setup>
/**
 * INSIST · 技能详情（接后端）
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import InsistNav from '../components/InsistNav.vue'
import {
  apiSkill, apiPromotion, apiCards, apiCreateCard, apiPromote,
} from '../api/insist_api.js'
import { TIERS, stars, forgetClass, kindLabel, tierName } from '../insist/constants.js'

const route = useRoute()
const skill = ref(null)
const promotion = ref(null)
const cards = ref([])
const loading = ref(true)
const error = ref('')
const notice = ref('')

const showAdd = ref(false)
const saving = ref(false)
const busy = ref(false)
const draft = ref({ kind: 'task', title: '', tier: 2, xpValue: 100 })

const related = computed(() => cards.value.filter((c) => c.skillId === route.params.id))
const canPromote = computed(() => promotion.value?.canPromote)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [s, p, cs] = await Promise.all([
      apiSkill(route.params.id),
      apiPromotion(route.params.id),
      apiCards(),
    ])
    skill.value = s
    promotion.value = p
    cards.value = cs
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function promote() {
  if (busy.value) return
  busy.value = true
  notice.value = ''
  try {
    const res = await apiPromote(route.params.id)
    notice.value = `已晋升到「${res.skill.levelName}」，溢出转入 ${res.transferred} XP`
    await load()
  } catch (e) {
    error.value = e.message || '晋升失败'
  } finally {
    busy.value = false
  }
}

function openAdd() {
  draft.value = { kind: 'task', title: '', tier: skill.value?.tier || 2, xpValue: 100 }
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
      tier: Number(draft.value.tier),
      skill_id: route.params.id,
      xp_value: draft.value.kind === 'habit' ? 0 : Number(draft.value.xpValue) || 0,
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
      <nav class="insist-crumb">
        <router-link to="/insist">← 主页</router-link>
        <span>/</span>
        <router-link to="/insist/collection">收藏室</router-link>
      </nav>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>

      <template v-else-if="skill">
        <section class="head">
          <div class="head-top">
            <span class="cat">{{ skill.category }}</span>
            <span class="stars">{{ stars(skill.importance) }}</span>
            <span class="tier">{{ tierName(skill.tier) }}</span>
          </div>
          <h1 class="name">{{ skill.name }}</h1>

          <div class="bar-row">
            <div class="insist-bar" :class="{ full: skill.saturated }">
              <i :style="{ width: skill.progress + '%' }"></i>
            </div>
          </div>
          <div class="meta">
            <span>{{ skill.levelName }} · {{ skill.xp }}<template v-if="!skill.saturated"> / {{ skill.xp + skill.nextNeed }}</template></span>
            <span v-if="skill.nextNeed">还差 {{ skill.nextNeed }} XP</span>
            <span>遗忘 <b :class="forgetClass(skill.forget)">{{ skill.forget }}%</b></span>
            <span v-if="skill.overflow">溢出 +{{ skill.overflow }}</span>
          </div>
        </section>

        <p v-if="notice" class="notice">{{ notice }}</p>

        <section v-if="promotion && promotion.checklist.length" class="insist-block">
          <div class="insist-block-head">
            <h2>晋升清单 · 按量</h2>
            <span class="insist-block-sub">{{ promotion.levelName }} → {{ promotion.nextLevelName }}</span>
          </div>

          <ul class="checklist">
            <li v-for="n in promotion.checklist" :key="n.label" :class="{ done: n.got >= n.need }">
              <span class="tick">{{ n.got >= n.need ? '✓' : '○' }}</span>
              <span class="ck-label">{{ n.label }}</span>
              <span class="ck-count mono">{{ n.got }} / {{ n.need }}</span>
              <span class="ck-bar"><i :style="{ width: Math.min(100, (n.got / n.need) * 100) + '%' }"></i></span>
            </li>
          </ul>
          <p class="hint">凭证来自完成的项目卡 / 任务卡 / 成就卡（成就可用于替代同等级项目）。</p>

          <div class="actions">
            <button
              class="insist-btn primary"
              type="button"
              :disabled="!canPromote || busy"
              @click="promote"
            >{{ canPromote ? `晋升到 ${promotion.nextLevelName}` : '还没满足晋升条件' }}</button>
          </div>
        </section>

        <section class="insist-block">
          <div class="insist-block-head">
            <h2>关联经验卡</h2>
            <span class="insist-block-sub">{{ related.length }} 张</span>
          </div>

          <p v-if="related.length === 0" class="state small">还没有关联卡片</p>

          <div v-else class="insist-grid">
            <router-link v-for="c in related" :key="c.id" class="x-card" :class="c.kind" :to="'/insist/card/' + c.id">
              <header class="x-card-top">
                <span>{{ kindLabel(c.kind) }}</span>
                <span>{{ tierName(c.tier) }}</span>
              </header>
              <h3 class="x-card-name">{{ c.title }}</h3>
              <div class="insist-bar small"><i :style="{ width: c.progress + '%' }"></i></div>
              <div class="x-card-foot">
                <span class="mono">{{ c.progress }}%</span>
                <span>+{{ c.xpValue }}</span>
              </div>
            </router-link>
          </div>

          <div class="actions">
            <button class="insist-btn" type="button" @click="openAdd">＋ 新建经验卡</button>
          </div>
        </section>
      </template>

      <div v-if="showAdd" class="modal" @click.self="showAdd = false">
        <form class="dialog" @submit.prevent="submitAdd">
          <h3>新建经验卡</h3>

          <div class="field"><span>类型</span>
            <div class="chips">
              <button v-for="k in [['task','任务'],['project','项目'],['habit','打卡'],['achievement','成就']]" :key="k[0]"
                type="button" :class="{ on: draft.kind === k[0] }" @click="draft.kind = k[0]">{{ k[1] }}</button>
            </div>
          </div>

          <label class="field"><span>标题</span>
            <input v-model="draft.title" type="text" maxlength="120" placeholder="比如 读完 Primer 第 3 章" autofocus />
          </label>

          <div class="field"><span>等级</span>
            <div class="chips">
              <button v-for="(t, i) in TIERS" :key="t" type="button" :class="{ on: draft.tier === i + 1 }" @click="draft.tier = i + 1">{{ t }}</button>
            </div>
          </div>

          <label v-if="draft.kind !== 'habit'" class="field"><span>完成奖励 XP</span>
            <input v-model.number="draft.xpValue" type="number" min="0" step="10" />
          </label>

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
.state.small { padding: 0.8rem 0; }
.notice { margin-top: 0.8rem; font-size: 0.76rem; color: #b9b9b9; }

.head { margin-top: 0.9rem; padding-bottom: 1.1rem; border-bottom: 1px solid #141414; }
.head-top { display: flex; align-items: center; gap: 0.6rem; font-size: 0.66rem; color: #6a6a6a; }
.stars { color: #cfcfcf; letter-spacing: 1px; }
.name { margin-top: 0.45rem; font-size: 1.9rem; font-weight: 600; }
.bar-row { margin-top: 0.9rem; }
.meta { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.55rem; font-size: 0.7rem; color: #6a6a6a; }
.meta b { font-weight: 500; color: #b9b9b9; }
.meta b.warn { color: #d29922; }
.meta b.danger { color: #f85149; }

.checklist { list-style: none; margin-top: 0.6rem; }
.checklist li { display: flex; align-items: center; gap: 0.6rem; padding: 0.55rem 0; border-bottom: 1px solid #101010; font-size: 0.8rem; }
.checklist li.done .ck-label { color: #b9b9b9; }
.tick { color: #6a6a6a; font-size: 0.8rem; }
.ck-label { flex: 1; }
.ck-count { color: #8a8a8a; font-size: 0.72rem; }
.ck-bar { width: 90px; height: 3px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
.ck-bar i { display: block; height: 100%; background: #8a8a8a; }
.hint { margin-top: 0.6rem; font-size: 0.68rem; color: #5f5f5f; }
.actions { display: flex; gap: 0.6rem; margin-top: 1rem; }

.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { width: min(440px, 100%); max-height: 86vh; overflow-y: auto; background: #070707; border: 1px solid #242424; border-radius: 10px; padding: 1.2rem 1.2rem 0.9rem; }
.dialog h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; }
.field { display: block; margin-bottom: 0.85rem; }
.field > span { display: block; font-size: 0.7rem; color: #6a6a6a; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
.field input { width: 100%; background: #0c0c0c; border: 1px solid #222; border-radius: 4px; color: #ededed; font-size: 0.85rem; padding: 0.45rem 0.55rem; outline: none; }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chips button { background: transparent; border: 1px solid #222; color: #8a8a8a; font-size: 0.75rem; padding: 0.28rem 0.6rem; border-radius: 4px; cursor: pointer; }
.chips button.on { border-color: #6a6a6a; color: #ededed; background: #111; }
.dialog-err { color: #f85149; font-size: 0.74rem; margin: 0.3rem 0 0; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.4rem; }
</style>
