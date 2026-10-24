<script setup>
/**
 * INSIST · 经验卡详情（打卡 / 任务 / 项目）
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import InsistNav from '../components/InsistNav.vue'
import { cards, skills, TIERS } from '../insist/mock.js'

const route = useRoute()
const card = computed(() => cards.find((c) => c.id === route.params.id) || cards[0])
const skill = computed(() => skills.find((s) => s.id === card.value.skillId))
const kindLabel = computed(() => (card.value.kind === 'project' ? '项目卡' : card.value.kind === 'habit' ? '打卡卡' : '任务卡'))
const statusLabel = computed(() => ({ active: '进行中', done: '已完成', archived: '已归档' }[card.value.status] || ''))
</script>

<template>
  <div class="insist-page">
    <InsistNav active="cards" />

    <main class="insist-main">
      <nav class="crumb">
        <router-link to="/insist">← 主页</router-link>
        <span>/</span>
        <router-link to="/insist/cards">卡片库</router-link>
      </nav>

      <section class="head">
        <div class="head-top">
          <span class="kind">{{ kindLabel }}</span>
          <span class="tier">{{ TIERS[card.tier - 1] }}</span>
          <span class="status">{{ statusLabel }}</span>
        </div>
        <h1 class="name">{{ card.name }}</h1>
        <p class="desc">{{ card.desc || '暂无描述' }}</p>
      </section>

      <section class="grid">
        <div class="cell">
          <span class="label">关联技能</span>
          <router-link v-if="skill" :to="'/insist/skill/' + skill.id" class="value link">{{ skill.name }}</router-link>
          <span v-else class="value">—</span>
        </div>
        <div class="cell">
          <span class="label">完成奖励</span>
          <span class="value mono">+{{ card.xp }} XP</span>
        </div>
        <div class="cell">
          <span class="label">进度</span>
          <span class="value mono">{{ card.progress }}%</span>
        </div>
        <div class="cell" v-if="card.phase">
          <span class="label">阶段</span>
          <span class="value mono">{{ card.phase }}</span>
        </div>
        <div class="cell" v-if="card.kind === 'habit'">
          <span class="label">打卡</span>
          <span class="value mono">持续 {{ card.total }} 天</span>
        </div>
      </section>

      <div class="bar-wrap">
        <div class="insist-bar"><i :style="{ width: card.progress + '%' }"></i></div>
      </div>

      <section class="insist-block" v-if="card.kind === 'habit'">
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
          <li v-else>完成时一次性结算；未完成前只记进度，不发 XP。</li>
        </ul>
      </section>

      <div class="actions">
        <button class="insist-btn primary" type="button" disabled>完成并结算（待接后端）</button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.crumb { display: flex; gap: 0.45rem; align-items: center; margin-top: 1.2rem; font-size: 0.74rem; }
.crumb a { color: #7a7a7a; text-decoration: none; }
.crumb a:hover { color: #ededed; }
.crumb span { color: #3f3f3f; }

.head { margin-top: 0.9rem; padding-bottom: 1rem; border-bottom: 1px solid #141414; }
.head-top { display: flex; gap: 0.5rem; font-size: 0.64rem; color: #6a6a6a; }
.kind { border: 1px solid #2a2a2a; border-radius: 3px; padding: 0.05rem 0.3rem; color: #b9b9b9; }
.name { margin-top: 0.45rem; font-size: 1.7rem; font-weight: 600; }
.desc { margin-top: 0.5rem; font-size: 0.82rem; color: #8a8a8a; line-height: 1.7; max-width: 44rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.9rem;
  margin-top: 1.1rem;
}
.cell { display: flex; flex-direction: column; gap: 0.25rem; }
.label { font-size: 0.64rem; color: #5f5f5f; letter-spacing: 0.08em; }
.value { font-size: 0.9rem; color: #d8d8d8; }
.value.link { color: #ededed; text-decoration: none; }
.value.link:hover { text-decoration: underline; text-underline-offset: 3px; }

.bar-wrap { margin-top: 1.2rem; }

.rules { list-style: none; margin-top: 0.5rem; }
.rules li {
  position: relative;
  padding: 0.35rem 0 0.35rem 0.9rem;
  font-size: 0.76rem;
  color: #8a8a8a;
  line-height: 1.7;
}
.rules li::before { content: '·'; position: absolute; left: 0.2rem; color: #4a4a4a; }

.actions { margin-top: 2rem; }
</style>
