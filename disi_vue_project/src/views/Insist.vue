<script setup>
/**
 * INSIST · 主页（P1 静态版）
 * 成就滑墙 → 近期目标（主位）+ 14 天小折线 → 爆满提醒 → 今日打卡 → 进行中
 */
import { ref, computed } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import {
  skills, habits, cards, achievements, dailyXp,
  progressOf, forgetClass, tierOf, stars,
} from '../insist/mock.js'

/* 近期目标：固定 C++ */
const focus = computed(() => skills.find((s) => s.id === 'cpp') || skills[0])
const focusPct = computed(() => progressOf(focus.value))

/* 爆满的技能 */
const saturated = computed(() => skills.filter((s) => s.overflow > 0 && s.xp >= 700))

/* 今日打卡 */
const habitsState = ref(habits.map((h) => ({ ...h })))
const doneToday = computed(() => habitsState.value.filter((h) => h.done).length)

function checkIn(habit) {
  if (habit.done) return
  habit.done = true
  habit.streak += 1
  habit.total += 1
}

/* 进行中的卡片（最多 3 张） */
const activeCards = computed(() => cards.filter((c) => c.status === 'active').slice(0, 3))

/* 14 天折线 */
const chart = computed(() => {
  const values = dailyXp
  const max = Math.max(...values, 1)
  const w = 220
  const h = 44
  const step = w / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`)
  return { points: 'M' + points.join(' L'), w, h }
})

const weekXp = computed(() => dailyXp.slice(-7).reduce((a, b) => a + b, 0))
const checkDays = computed(() => dailyXp.slice(-7).filter((v) => v > 0).length)

/* 连续天数：从今天往回数，连续有记录的天数 */
const streakDays = computed(() => {
  let n = 0
  for (let i = dailyXp.length - 1; i >= 0; i--) {
    if (dailyXp[i] > 0) n++
    else break
  }
  return n
})

const skillName = (id) => skills.find((s) => s.id === id)?.name || id
</script>

<template>
  <div class="insist-page">
    <InsistNav active="home" />

    <main class="insist-main">
      <!-- 成就滑墙（固定在顶部，持续滚动） -->
      <section class="marquee-wrap" aria-label="成就墙">
        <div class="marquee-track">
          <span
            v-for="(a, i) in [...achievements, ...achievements]"
            :key="a.id + '-' + i"
            class="mq-ach"
            :class="'tier-' + a.tier"
          >
            <span class="mq-star">✦</span>{{ a.name }}
          </span>
        </div>
      </section>

      <!-- 近期目标（主位） + 14 天小折线 -->
      <section class="hero-row">
        <div class="focus">
          <div class="focus-head">
            <span class="focus-label">近期目标</span>
            <span class="focus-meta">{{ focus.daysAgo }} 天前记录</span>
          </div>

          <div class="focus-body">
            <span class="focus-name">{{ focus.name }}</span>
            <span class="focus-stars">{{ stars(focus.importance) }}</span>
            <span class="focus-tier">{{ tierOf(focus) }}</span>
          </div>

          <div class="insist-bar big" :class="{ full: focus.overflow > 0 }">
            <i :style="{ width: focusPct + '%' }"></i>
          </div>

          <div class="focus-foot">
            <span class="mono">{{ focus.xp }} / 700</span>
            <span>本周 +{{ weekXp }} · 连续 {{ streakDays }} 天</span>
          </div>

          <div class="focus-tags">
            <span class="tag">遗忘 <b :class="forgetClass(focus.forget)">{{ focus.forget }}%</b></span>
            <span class="tag">记录 {{ focus.records }} 条</span>
            <span class="tag">难度 {{ tierOf(focus) }}</span>
          </div>
        </div>

        <aside class="mini">
          <div class="mini-head">
            <span>最近 14 天</span>
            <span class="mini-unit">每日 XP</span>
          </div>
          <svg class="mini-chart" :viewBox="`0 0 ${chart.w} ${chart.h}`" preserveAspectRatio="none" aria-hidden="true">
            <path :d="chart.points" />
          </svg>
          <div class="mini-axis"><span>14 天前</span><span>今天</span></div>
          <div class="mini-stats">
            <div class="ms"><b class="mono">+{{ weekXp }}</b><span>本周</span></div>
            <div class="ms"><b class="mono">{{ checkDays }}/7</b><span>打卡</span></div>
            <div class="ms"><b class="mono">{{ streakDays }}</b><span>连续</span></div>
          </div>
        </aside>
      </section>

      <!-- 爆满提醒 -->
      <section v-if="saturated.length" class="alert">
        <span class="alert-mark">⚠</span>
        <div class="alert-body">
          <strong>{{ saturated[0].name }}</strong> 已爆满 · 溢出 +{{ saturated[0].overflow }}
          <span class="alert-sub">继续打卡只进溢出池（×0.10 起），尽快凑齐晋升凭证</span>
        </div>
        <router-link class="alert-btn" :to="'/insist/skill/' + saturated[0].id">查看</router-link>
      </section>

      <!-- 今日打卡 -->
      <section class="insist-block">
        <div class="insist-block-head">
          <h2>今日打卡</h2>
          <span class="insist-block-sub">{{ doneToday }} / {{ habitsState.length }} 已完成</span>
        </div>

        <ul class="habit-list">
          <li v-for="h in habitsState" :key="h.id" class="habit" :class="{ done: h.done }">
            <div class="habit-main">
              <span class="habit-name">{{ h.name }}</span>
              <span class="habit-tier">{{ ['低阶', '中阶', '高阶', '臻阶'][h.tier - 1] }}</span>
              <span v-if="h.capped" class="habit-cap">已封顶</span>
            </div>
            <div class="habit-sub">
              <span>连续 {{ h.streak }} 天 · 累计 {{ h.total }} 天</span>
              <span class="habit-xp">今日 +{{ h.today.toFixed(1) }}</span>
            </div>
            <button class="insist-btn" :class="{ 'done-btn': h.done }" type="button" :disabled="h.done" @click="checkIn(h)">
              {{ h.done ? '已打卡' : '打卡' }}
            </button>
          </li>
        </ul>
      </section>

      <!-- 进行中 -->
      <section class="insist-block">
        <div class="insist-block-head">
          <h2>进行中</h2>
          <router-link to="/insist/cards" class="insist-more">{{ activeCards.length }} 张 · 全部 →</router-link>
        </div>

        <div class="insist-grid">
          <article v-for="c in activeCards" :key="c.id" class="x-card" :class="c.kind">
            <header class="x-card-top">
              <span>{{ c.kind === 'project' ? '项目' : '任务' }}</span>
              <span>{{ ['低阶', '中阶', '高阶', '臻阶'][c.tier - 1] }}</span>
            </header>
            <h3 class="x-card-name">{{ c.name }}</h3>
            <p class="x-card-sub">{{ skillName(c.skillId) }}<template v-if="c.phase"> · 阶段 {{ c.phase }}</template></p>
            <div class="insist-bar small"><i :style="{ width: c.progress + '%' }"></i></div>
            <div class="x-card-foot">
              <span class="mono">{{ c.progress }}%</span>
              <span>完成 +{{ c.xp }}</span>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
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
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #8a8a8a;
  white-space: nowrap;
}
.mq-star { color: #4a4a4a; font-size: 0.62rem; }
.mq-ach.tier-3 { color: #b9b9b9; }
.mq-ach.tier-3 .mq-star { color: #9a9a9a; }
.mq-ach.tier-4 { color: #ededed; }
.mq-ach.tier-4 .mq-star { color: #ededed; }

/* 主位：近期目标 + 小折线 */
.hero-row {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1rem;
  margin-top: 1.3rem;
  align-items: stretch;
}

.focus {
  padding: 1.15rem 1.25rem 1rem;
  border: 1px solid #2c2c2c;
  border-radius: 10px;
  background: #060606;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.focus-head { display: flex; justify-content: space-between; align-items: baseline; }
.focus-label { font-size: 0.7rem; letter-spacing: 0.18em; color: #7a7a7a; }
.focus-meta { font-size: 0.66rem; color: #555; }
.focus-body { display: flex; align-items: baseline; gap: 0.6rem; margin-top: 0.6rem; }
.focus-name { font-size: 2rem; font-weight: 600; letter-spacing: -0.01em; }
.focus-stars { font-size: 0.74rem; color: #cfcfcf; letter-spacing: 1px; }
.focus-tier { font-size: 0.7rem; color: #7a7a7a; }

.insist-bar.big { height: 8px; border-radius: 4px; margin-top: 0.9rem; }
.insist-bar.big > i { border-radius: 4px; }

.focus-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 0.55rem;
  font-size: 0.72rem;
  color: #7a7a7a;
}
.focus-tags { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
.tag {
  font-size: 0.64rem;
  color: #7a7a7a;
  border: 1px solid #1e1e1e;
  border-radius: 3px;
  padding: 0.1rem 0.35rem;
}
.tag b { font-weight: 500; color: #b9b9b9; }
.tag b.warn { color: #d29922; }
.tag b.danger { color: #f85149; }

/* 小折线 */
.mini {
  padding: 0.85rem 0.95rem 0.75rem;
  border: 1px solid #1c1c1c;
  border-radius: 10px;
  background: #050505;
  display: flex;
  flex-direction: column;
}
.mini-head { display: flex; justify-content: space-between; align-items: baseline; }
.mini-head span:first-child { font-size: 0.68rem; letter-spacing: 0.14em; color: #8a8a8a; }
.mini-unit { font-size: 0.6rem; color: #4a4a4a; }
.mini-chart { width: 100%; height: 52px; margin-top: 0.45rem; }
.mini-chart path {
  fill: none;
  stroke: #7a7a7a;
  stroke-width: 1.3;
  vector-effect: non-scaling-stroke;
}
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
.habit {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.7rem 0.1rem;
  border-bottom: 1px solid #101010;
}
.habit.done { opacity: 0.55; }
.habit-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.5rem; }
.habit-name { font-size: 0.88rem; }
.habit-tier { font-size: 0.62rem; color: #5f5f5f; border: 1px solid #1e1e1e; border-radius: 3px; padding: 0.02rem 0.28rem; }
.habit-cap { font-size: 0.62rem; color: #b98a00; border: 1px solid rgba(185, 138, 0, 0.4); border-radius: 3px; padding: 0.02rem 0.28rem; }
.habit-sub { display: flex; gap: 0.8rem; font-size: 0.64rem; color: #5f5f5f; }
.habit-xp { color: #8a8a8a; }
.done-btn { opacity: 0.5; }

@media (max-width: 820px) {
  .hero-row { grid-template-columns: 1fr; }
  .mini { order: 2; }
  .habit { flex-wrap: wrap; }
  .habit-sub { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
}
</style>
