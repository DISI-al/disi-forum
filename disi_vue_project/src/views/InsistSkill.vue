<script setup>
/**
 * INSIST · 技能详情（P1 静态版）
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import InsistNav from '../components/InsistNav.vue'
import {
  skills, cards, LEVELS, LEVEL_MIN, TIERS,
  levelName, progressOf, nextNeed, forgetClass, tierOf, stars, promotionNeeds,
} from '../insist/mock.js'

const route = useRoute()
const skill = computed(() => skills.find((s) => s.id === route.params.id) || skills[0])

const pct = computed(() => progressOf(skill.value))
const need = computed(() => nextNeed(skill.value))
const needs = computed(() => promotionNeeds(skill.value))
const related = computed(() => cards.filter((c) => c.skillId === skill.value.id))

/* 静态时间线 */
const timeline = [
  { date: '08-14', text: '完成「C++ 面向对象」网课', xp: 100, kind: '计划' },
  { date: '08-20', text: '打卡 · 每天 30 分钟', xp: 3.5, kind: '打卡' },
  { date: '08-27', text: '完成「机房管理系统」阶段 1', xp: 60, kind: '项目' },
  { date: '09-02', text: '打卡 · 每天 30 分钟', xp: 3.0, kind: '打卡' },
  { date: '09-10', text: '读完《C++ Primer》前两章', xp: 100, kind: '任务' },
]

const nextMin = computed(() => (skill.value.level < 4 ? LEVEL_MIN[skill.value.level + 1] : 0))
</script>

<template>
  <div class="insist-page">
    <InsistNav active="collection" />

    <main class="insist-main">
      <nav class="crumb">
        <router-link to="/insist">← 主页</router-link>
        <span>/</span>
        <router-link to="/insist/collection">收藏室</router-link>
      </nav>

      <!-- 头部 -->
      <section class="head">
        <div class="head-top">
          <span class="cat">{{ skill.category }}</span>
          <span class="stars">{{ stars(skill.importance) }}</span>
          <span class="tier">{{ tierOf(skill) }}</span>
        </div>
        <h1 class="name">{{ skill.name }}</h1>

        <div class="bar-row">
          <div class="insist-bar" :class="{ full: skill.overflow > 0 }">
            <i :style="{ width: pct + '%' }"></i>
          </div>
        </div>
        <div class="meta">
          <span>{{ levelName(skill.level) }} · {{ skill.xp }}<template v-if="skill.level < 4"> / {{ nextMin }}</template><template v-else> · MAX</template></span>
          <span v-if="need">还差 {{ need }} XP</span>
          <span>遗忘 <b :class="forgetClass(skill.forget)">{{ skill.forget }}%</b></span>
          <span v-if="skill.overflow">溢出 +{{ skill.overflow }}（×0.10 入账）</span>
        </div>
      </section>

      <!-- 晋升清单 -->
      <section class="insist-block" v-if="needs.length">
        <div class="insist-block-head">
          <h2>晋升清单 · 按量</h2>
          <span class="insist-block-sub">{{ levelName(skill.level) }} → {{ levelName(skill.level + 1) }}</span>
        </div>

        <ul class="checklist">
          <li v-for="n in needs" :key="n.label" :class="{ done: n.got >= n.need }">
            <span class="tick">{{ n.got >= n.need ? '✓' : '○' }}</span>
            <span class="ck-label">{{ n.label }}</span>
            <span class="ck-count mono">{{ n.got }} / {{ n.need }}</span>
            <span class="ck-bar"><i :style="{ width: Math.min(100, (n.got / n.need) * 100) + '%' }"></i></span>
          </li>
        </ul>
        <p class="hint">凭证可来自项目卡，也可以来自同等级成就卡（如考级、比赛）。</p>
      </section>

      <!-- 关联卡片 -->
      <section class="insist-block">
        <div class="insist-block-head">
          <h2>关联经验卡</h2>
          <span class="insist-block-sub">{{ related.length }} 张</span>
        </div>
        <div class="insist-grid" v-if="related.length">
          <article v-for="c in related" :key="c.id" class="x-card" :class="c.kind">
            <header class="x-card-top">
              <span>{{ c.kind === 'project' ? '项目' : c.kind === 'habit' ? '打卡' : '任务' }}</span>
              <span>{{ TIERS[c.tier - 1] }}</span>
            </header>
            <h3 class="x-card-name">{{ c.name }}</h3>
            <div class="insist-bar small"><i :style="{ width: c.progress + '%' }"></i></div>
            <div class="x-card-foot">
              <span class="mono">{{ c.progress }}%</span>
              <span>+{{ c.xp }}</span>
            </div>
          </article>
        </div>
        <p v-else class="insist-empty">还没有关联卡片</p>
      </section>

      <!-- 时间线 -->
      <section class="insist-block">
        <div class="insist-block-head">
          <h2>时间线</h2>
          <span class="insist-block-sub">最近 5 条</span>
        </div>
        <ul class="timeline">
          <li v-for="(t, i) in timeline" :key="i">
            <span class="tl-date mono">{{ t.date }}</span>
            <span class="tl-kind">{{ t.kind }}</span>
            <span class="tl-text">{{ t.text }}</span>
            <span class="tl-xp mono">+{{ t.xp }}</span>
          </li>
        </ul>
      </section>

      <div class="actions">
        <button class="insist-btn primary" type="button" disabled>新建经验卡（待接后端）</button>
        <button class="insist-btn" type="button" disabled>编辑技能</button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.crumb { display: flex; gap: 0.45rem; align-items: center; margin-top: 1.2rem; font-size: 0.74rem; }
.crumb a { color: #7a7a7a; text-decoration: none; }
.crumb a:hover { color: #ededed; }
.crumb span { color: #3f3f3f; }

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
.checklist li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid #101010;
  font-size: 0.8rem;
}
.checklist li.done .ck-label { color: #b9b9b9; }
.tick { color: #6a6a6a; font-size: 0.8rem; }
.ck-label { flex: 1; }
.ck-count { color: #8a8a8a; font-size: 0.72rem; }
.ck-bar { width: 90px; height: 3px; background: #1a1a1a; border-radius: 2px; overflow: hidden; }
.ck-bar i { display: block; height: 100%; background: #8a8a8a; }

.hint { margin-top: 0.6rem; font-size: 0.68rem; color: #5f5f5f; }

.timeline { list-style: none; margin-top: 0.5rem; }
.timeline li {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #101010;
  font-size: 0.76rem;
}
.tl-date { color: #5f5f5f; font-size: 0.66rem; width: 3.2rem; }
.tl-kind { color: #6a6a6a; font-size: 0.64rem; width: 2.4rem; }
.tl-text { flex: 1; color: #b9b9b9; }
.tl-xp { color: #8a8a8a; font-size: 0.7rem; }

.actions { display: flex; gap: 0.6rem; margin-top: 2rem; }
</style>
