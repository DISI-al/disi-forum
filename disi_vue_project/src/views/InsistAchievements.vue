<script setup>
/**
 * INSIST · 成就墙（P1 静态版）
 */
import InsistNav from '../components/InsistNav.vue'
import { achievements, lockedAchievements, TIERS } from '../insist/mock.js'

const gradeOf = (tier) => ['入门级', '熟练级', '精通级', '专家级'][tier - 1]
</script>

<template>
  <div class="insist-page">
    <InsistNav active="achievements" />

    <main class="insist-main">
      <section class="head">
        <div class="head-left">
          <h1>成就墙</h1>
          <span class="count">{{ achievements.length }} 枚 · 未解锁 {{ lockedAchievements.length }}</span>
        </div>
        <button class="insist-btn primary" type="button" disabled>＋ 录入现实奖项（待接后端）</button>
      </section>

      <section class="insist-block">
        <div class="insist-block-head">
          <h2>已获得</h2>
        </div>
        <div class="ach-grid">
          <article v-for="a in achievements" :key="a.id" class="ach" :class="'tier-' + a.tier">
            <div class="ach-top">
              <span class="ach-star">✦</span>
              <span class="ach-grade">{{ gradeOf(a.tier) }}</span>
            </div>
            <h3 class="ach-name">{{ a.name }}</h3>
            <span class="ach-date mono">{{ a.date }}</span>
          </article>
        </div>
      </section>

      <section class="insist-block">
        <div class="insist-block-head">
          <h2>未解锁</h2>
          <span class="insist-block-sub">系统按规则发放</span>
        </div>
        <div class="ach-grid">
          <article v-for="a in lockedAchievements" :key="a.id" class="ach locked">
            <div class="ach-top">
              <span class="ach-star">✦</span>
              <span class="ach-grade">未解锁</span>
            </div>
            <h3 class="ach-name">{{ a.name }}</h3>
            <span class="ach-date">{{ a.hint }}</span>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #141414;
  flex-wrap: wrap;
}
.head h1 { font-size: 1.05rem; font-weight: 600; margin: 0; }
.count { margin-left: 0.7rem; font-size: 0.68rem; color: #5f5f5f; }

.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.75rem;
  margin-top: 0.8rem;
}
.ach {
  padding: 0.85rem 0.9rem;
  border: 1px solid #242424;
  border-radius: 8px;
  background: #070707;
}
.ach.tier-3 { border-color: #3a3a3a; }
.ach.tier-4 {
  border-color: #5a5a5a;
  box-shadow: 0 0 22px rgba(255, 255, 255, 0.05);
}
.ach.locked { opacity: 0.45; border-style: dashed; }
.ach-top { display: flex; align-items: center; justify-content: space-between; font-size: 0.62rem; color: #6a6a6a; }
.ach-star { font-size: 0.7rem; color: #6a6a6a; }
.ach.tier-4 .ach-star { color: #ededed; }
.ach.tier-3 .ach-star { color: #b9b9b9; }
.ach-name { margin-top: 0.5rem; font-size: 0.9rem; font-weight: 600; }
.ach-date { display: block; margin-top: 0.35rem; font-size: 0.64rem; color: #5f5f5f; }
</style>
