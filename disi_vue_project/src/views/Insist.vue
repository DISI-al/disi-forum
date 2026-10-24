<script setup>
/**
 * INSIST · 主页（接后端）
 */
import { ref, computed, onMounted } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { apiOverview, apiSkills, apiCards, apiCheckin } from '../api/insist_api.js'
import { levelName, tierName, stars, forgetClass, kindLabel } from '../insist/constants.js'

const loading = ref(true)
const error = ref('')
const overview = ref({ skillCount: 0, totalXp: 0, saturatedCount: 0, dailyXp: [], todayCheckins: 0 })
const skills = ref([])
const cards = ref([])
const busyId = ref('')
const notice = ref('')

const focus = computed(() => skills.value[0] || null)
const habits = computed(() => cards.value.filter((c) => c.kind === 'habit' && c.status === 'active'))
const activeCards = computed(() => cards.value.filter((c) => c.status === 'active' && c.kind !== 'habit').slice(0, 3))
const achievements = computed(() => cards.value.filter((c) => c.kind === 'achievement' && c.status === 'done'))

const dailyXp = computed(() => overview.value.dailyXp || [])
const weekXp = computed(() => dailyXp.value.slice(-7).reduce((a, b) => a + b, 0))
const checkDays = computed(() => dailyXp.value.slice(-7).filter((v) => v > 0).length)
const streakDays = computed(() => {
  let n = 0
  for (let i = dailyXp.value.length - 1; i >= 0; i--) {
    if (dailyXp.value[i] > 0) n++
    else break
  }
  return n
})

const chart = computed(() => {
  const values = dailyXp.value.length ? dailyXp.value : new Array(14).fill(0)
  const max = Math.max(...values, 1)
  const w = 220
  const h = 44
  const step = w / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`)
  return { points: 'M' + points.join(' L'), w, h }
})

const saturated = computed(() => skills.value.filter((s) => s.saturated))

function isToday(card) {
  if (!card.lastCheckin) return false
  const d = new Date(card.lastCheckin)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [ov, sk, cs] = await Promise.all([apiOverview(), apiSkills(), apiCards()])
    overview.value = ov
    skills.value = sk
    cards.value = cs
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function checkIn(card) {
  if (busyId.value || isToday(card)) return
  busyId.value = card.id
  notice.value = ''
  try {
    const res = await apiCheckin(card.id)
    notice.value = `打卡成功 +${res.xp} XP` + (res.streak > 1 ? ` · 连续 ${res.streak} 天` : '')
    await load()
  } catch (e) {
    notice.value = e.message || '打卡失败'
  } finally {
    busyId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="insist-page">
    <InsistNav active="home" />

    <main class="insist-main">
      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>

      <template v-else>
        <!-- 成就滑墙 -->
        <section v-if="achievements.length" class="marquee-wrap" aria-label="成就墙">
          <div class="marquee-track">
            <router-link
              v-for="(a, i) in [...achievements, ...achievements]"
              :key="a.id + '-' + i"
              class="mq-ach"
              :class="'tier-' + a.tier"
              :to="'/insist/card/' + a.id"
            >
              <span class="mq-star">✦</span>{{ a.title }}
            </router-link>
          </div>
        </section>

        <p v-if="notice" class="notice">{{ notice }}</p>

        <!-- 近期目标 + 14 天折线 -->
        <section class="hero-row">
          <router-link v-if="focus" class="focus" :to="'/insist/skill/' + focus.id">
            <div class="focus-head">
              <span class="focus-label">近期目标</span>
              <span class="focus-meta">{{ focus.daysAgo }} 天前记录</span>
            </div>
            <div class="focus-body">
              <span class="focus-name">{{ focus.name }}</span>
              <span class="focus-stars">{{ stars(focus.importance) }}</span>
              <span class="focus-tier">{{ tierName(focus.tier) }}</span>
            </div>
            <div class="insist-bar big" :class="{ full: focus.saturated }">
              <i :style="{ width: focus.progress + '%' }"></i>
            </div>
            <div class="focus-foot">
              <span class="mono">{{ focus.xp }} / {{ focus.saturated ? focus.xp : focus.xp + focus.nextNeed }}</span>
              <span>本周 +{{ weekXp }} · 连续 {{ streakDays }} 天</span>
            </div>
            <div class="focus-tags">
              <span class="tag">遗忘 <b :class="forgetClass(focus.forget)">{{ focus.forget }}%</b></span>
              <span class="tag">记录 {{ focus.records }} 条</span>
              <span class="tag">{{ levelName(focus.level) }}</span>
            </div>
          </router-link>

          <router-link v-else class="focus" to="/insist/collection">
            <div class="focus-head"><span class="focus-label">近期目标</span></div>
            <div class="focus-name">还没有技能</div>
            <div class="focus-foot"><span>去收藏室新建一个 →</span></div>
          </router-link>

          <router-link class="mini" to="/insist/stats">
            <div class="mini-head"><span>最近 14 天</span><span class="mini-unit">每日 XP</span></div>
            <svg class="mini-chart" :viewBox="`0 0 ${chart.w} ${chart.h}`" preserveAspectRatio="none" aria-hidden="true">
              <path :d="chart.points" />
            </svg>
            <div class="mini-axis"><span>14 天前</span><span>今天</span></div>
            <div class="mini-stats">
              <div class="ms"><b class="mono">+{{ weekXp }}</b><span>本周</span></div>
              <div class="ms"><b class="mono">{{ checkDays }}/7</b><span>打卡</span></div>
              <div class="ms"><b class="mono">{{ streakDays }}</b><span>连续</span></div>
            </div>
          </router-link>
        </section>

        <!-- 爆满提醒 -->
        <section v-if="saturated.length" class="alert">
          <span class="alert-mark">⚠</span>
          <div class="alert-body">
            <strong>{{ saturated[0].name }}</strong> 已爆满<template v-if="saturated[0].overflow > 0"> · 溢出 +{{ saturated[0].overflow }}</template>
            <span class="alert-sub">继续记录只进溢出池（×0.10 起），尽快凑齐晋升凭证</span>
          </div>
          <router-link class="alert-btn" :to="'/insist/skill/' + saturated[0].id">查看</router-link>
        </section>

        <!-- 今日打卡 -->
        <section class="insist-block">
          <div class="insist-block-head">
            <h2>今日打卡</h2>
            <span class="insist-block-sub">{{ overview.todayCheckins }} / {{ habits.length }} 已完成</span>
          </div>

          <p v-if="habits.length === 0" class="state small">还没有打卡卡，去卡片页新建一个。</p>

          <ul v-else class="habit-list">
            <li v-for="h in habits" :key="h.id" class="habit" :class="{ done: isToday(h) }">
              <router-link class="habit-main" :to="'/insist/card/' + h.id">
                <span class="habit-name">{{ h.title }}</span>
                <span class="habit-tier">{{ tierName(h.tier) }}</span>
              </router-link>
              <div class="habit-sub">
                <span>连续 {{ h.streak }} 天 · 累计 {{ h.totalDays }} 天</span>
              </div>
              <button
                class="insist-btn"
                type="button"
                :disabled="isToday(h) || busyId === h.id"
                @click="checkIn(h)"
              >{{ isToday(h) ? '已打卡' : '打卡' }}</button>
            </li>
          </ul>
        </section>

        <!-- 进行中 -->
        <section class="insist-block">
          <div class="insist-block-head">
            <h2>进行中</h2>
            <router-link to="/insist/cards" class="insist-more">{{ activeCards.length }} 张 · 全部 →</router-link>
          </div>

          <p v-if="activeCards.length === 0" class="state small">没有进行中的卡片</p>

          <div v-else class="insist-grid">
            <router-link v-for="c in activeCards" :key="c.id" class="x-card" :class="c.kind" :to="'/insist/card/' + c.id">
              <header class="x-card-top">
                <span>{{ kindLabel(c.kind) }}</span>
                <span>{{ tierName(c.tier) }}</span>
              </header>
              <h3 class="x-card-name">{{ c.title }}</h3>
              <p class="x-card-sub">{{ c.phase ? '阶段 ' + c.phase : '' }}</p>
              <div class="insist-bar small"><i :style="{ width: c.progress + '%' }"></i></div>
              <div class="x-card-foot">
                <span class="mono">{{ c.progress }}%</span>
                <span>完成 +{{ c.xpValue }}</span>
              </div>
            </router-link>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.state { color: #8a8a8a; font-size: 0.82rem; padding: 1.5rem 0; }
.state.err { color: #f85149; }
.state.small { padding: 1rem 0; }

.notice { margin-top: 0.8rem; font-size: 0.76rem; color: #b9b9b9; }

/* 成就滑墙 */
.marquee-wrap {
  margin-top: 1.2rem;
  overflow: hidden;
  border-top: 1px solid #141414;
  border-bottom: 1px solid #141414;
  padding: 0.55rem 0;
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
}
.marquee-track {
  display: flex;
  gap: 2.2rem;
  width: max-content;
  padding-left: 90px;
  animation: marquee 32s linear infinite;
}
.marquee-wrap:hover .marquee-track { animation-play-state: paused; }
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.mq-ach {
  text-decoration: none;
  transition: transform 0.16s ease, color 0.16s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #8a8a8a;
  white-space: nowrap;
}
.mq-ach:hover { transform: scale(1.15); color: #fff; }
.mq-star { color: #4a4a4a; font-size: 0.62rem; }
.mq-ach.tier-3 { color: #b9b9b9; }
.mq-ach.tier-3 .mq-star { color: #9a9a9a; }
.mq-ach.tier-4 { color: #ededed; }
.mq-ach.tier-4 .mq-star { color: #ededed; }

/* 主位 */
.hero-row { display: grid; grid-template-columns: 1fr 280px; gap: 1rem; margin-top: 1.3rem; align-items: stretch; }

.focus {
  display: block;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  padding: 1.15rem 1.25rem 1rem;
  border: 1px solid #2c2c2c;
  border-radius: 10px;
  background: #060606;
}
.focus:hover { transform: translateY(-2px); border-color: #4a4a4a; }
.focus-head { display: flex; justify-content: space-between; align-items: baseline; }
.focus-label { font-size: 0.7rem; letter-spacing: 0.18em; color: #7a7a7a; }
.focus-meta { font-size: 0.66rem; color: #555; }
.focus-body { display: flex; align-items: baseline; gap: 0.6rem; margin-top: 0.6rem; }
.focus-name { font-size: 2rem; font-weight: 600; letter-spacing: -0.01em; }
.focus-stars { font-size: 0.74rem; color: #cfcfcf; letter-spacing: 1px; }
.focus-tier { font-size: 0.7rem; color: #7a7a7a; }

.insist-bar.big { height: 8px; border-radius: 4px; margin-top: 0.9rem; }
.insist-bar.big > i { border-radius: 4px; }

.focus-foot { display: flex; justify-content: space-between; margin-top: 0.55rem; font-size: 0.72rem; color: #7a7a7a; }
.focus-tags { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
.tag { font-size: 0.64rem; color: #7a7a7a; border: 1px solid #1e1e1e; border-radius: 3px; padding: 0.1rem 0.35rem; }
.tag b { font-weight: 500; color: #b9b9b9; }
.tag b.warn { color: #d29922; }
.tag b.danger { color: #f85149; }

/* 小折线 */
.mini {
  display: block;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
  padding: 0.85rem 0.95rem 0.75rem;
  border: 1px solid #1c1c1c;
  border-radius: 10px;
  background: #050505;
}
.mini:hover { transform: translateY(-2px); border-color: #4a4a4a; }
.mini-head { display: flex; justify-content: space-between; align-items: baseline; }
.mini-head span:first-child { font-size: 0.68rem; letter-spacing: 0.14em; color: #8a8a8a; }
.mini-unit { font-size: 0.6rem; color: #4a4a4a; }
.mini-chart { width: 100%; height: 52px; margin-top: 0.45rem; }
.mini-chart path { fill: none; stroke: #7a7a7a; stroke-width: 1.3; vector-effect: non-scaling-stroke; }
.mini-axis { display: flex; justify-content: space-between; font-size: 0.56rem; color: #3f3f3f; margin-top: 0.15rem; }
.mini-stats { display: flex; justify-content: space-between; margin-top: auto; padding-top: 0.6rem; }
.ms { display: flex; flex-direction: column; gap: 0.05rem; }
.ms b { font-size: 0.86rem; font-weight: 600; color: #d8d8d8; }
.ms span { font-size: 0.58rem; color: #565656; }

/* 爆满提醒 */
.alert {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.9rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid rgba(248, 81, 73, 0.35);
  border-radius: 8px;
  background: rgba(248, 81, 73, 0.06);
}
.alert-mark { color: #f85149; font-size: 0.85rem; }
.alert-body { font-size: 0.78rem; color: #d0d0d0; }
.alert-sub { display: block; margin-top: 0.1rem; font-size: 0.66rem; color: #8a8a8a; }
.alert-btn {
  margin-left: auto;
  color: #f85149;
  text-decoration: none;
  font-size: 0.72rem;
  border: 1px solid rgba(248, 81, 73, 0.45);
  border-radius: 4px;
  padding: 0.3rem 0.65rem;
  white-space: nowrap;
}
.alert-btn:hover { background: rgba(248, 81, 73, 0.12); }

/* 打卡 */
.habit-list { list-style: none; margin-top: 0.4rem; }
.habit { display: flex; align-items: center; gap: 0.9rem; padding: 0.7rem 0.1rem; border-bottom: 1px solid #101010; }
.habit.done { opacity: 0.55; }
.habit-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.5rem; color: inherit; text-decoration: none; }
.habit-main:hover .habit-name { color: #fff; }
.habit-name { font-size: 0.88rem; }
.habit-tier { font-size: 0.62rem; color: #5f5f5f; border: 1px solid #1e1e1e; border-radius: 3px; padding: 0.02rem 0.28rem; }
.habit-sub { display: flex; gap: 0.8rem; font-size: 0.64rem; color: #5f5f5f; }

@media (max-width: 820px) {
  .hero-row { grid-template-columns: 1fr; }
  .habit { flex-wrap: wrap; }
  .habit-sub { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
}
</style>
