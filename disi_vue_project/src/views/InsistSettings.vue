<script setup>
/**
 * INSIST · 设置（P1 静态版）
 * 图例说明 + 段位阈值 + 打卡数值 + 复习间隔 + 原因模板
 */
import { ref } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { LEVELS, TIERS, IMPORTANCE } from '../insist/constants.js'
import { apiExport } from '../api/insist_api.js'

const exporting = ref(false)
const exportMsg = ref('')

async function download(format) {
  if (exporting.value) return
  exporting.value = true
  exportMsg.value = ''
  try {
    await apiExport(format)
    exportMsg.value = '已开始下载'
  } catch (e) {
    exportMsg.value = e.message || '导出失败'
  } finally {
    exporting.value = false
  }
}

const thresholds = [
  { level: '初识', min: 0 },
  { level: '入门', min: 100 },
  { level: '熟练', min: 300 },
  { level: '精通', min: 700 },
  { level: '专家', min: 1300 },
]

const dailyXp = [
  { tier: '低阶', minutes: '5–10 分钟', xp: '1.5' },
  { tier: '中阶', minutes: '20–30 分钟', xp: '3.5' },
  { tier: '高阶', minutes: '2–3 小时', xp: '12' },
  { tier: '臻阶', minutes: '4 小时+', xp: '24' },
]

const decay = [
  { range: '1–7 天', rate: '×1.00' },
  { range: '8–30 天', rate: '×0.85' },
  { range: '31–100 天', rate: '×0.62' },
  { range: '101–200 天', rate: '×0.45' },
  { range: '200 天以后', rate: '×0.30' },
]

const overflow = [
  { range: '爆满 0–7 天', rate: '×0.10' },
  { range: '8–30 天', rate: '×0.05' },
  { range: '31 天以后', rate: '×0.02' },
]

const intervals = [
  { importance: '次要', days: '180 天' },
  { importance: '一般', days: '120 天' },
  { importance: '重要', days: '60 天' },
  { importance: '核心', days: '30 天' },
]

const reasons = ['网课观看', '看书', '实践练习', '独立项目', '分享 / 教学', '其他']
</script>

<template>
  <div class="insist-page">
    <InsistNav active="settings" />

    <main class="insist-main">
      <nav class="insist-crumb">
        <router-link to="/insist">← 主页</router-link>
      </nav>

      <section class="head">
        <h1>设置</h1>
        <span class="sub">图例、阈值、模板（P1 只读，P4 可编辑）</span>
      </section>

      <!-- 图例 -->
      <section class="insist-block">
        <div class="insist-block-head"><h2>图例说明</h2></div>
        <div class="legend">
          <div class="lg"><span class="lg-stars">★★★</span><div><b>重要程度</b><p>星星数量 1–4，对应 次要 / 一般 / 重要 / 核心</p></div></div>
          <div class="lg"><span class="lg-tier"><i class="on"></i><i class="on"></i><i></i><i></i></span><div><b>难度阶</b><p>四格填充数量：低阶 / 中阶 / 高阶 / 臻阶</p></div></div>
          <div class="lg"><span class="lg-bar"><i style="width: 65%"></i></span><div><b>熟练度</b><p>段内进度；变红并呼吸 = 已爆满，等待晋升</p></div></div>
          <div class="lg"><span class="lg-pct">35%</span><div><b>遗忘度</b><p>越高越生疏；≥60% 琥珀色，≥85% 红色</p></div></div>
          <div class="lg"><span class="lg-frame">&nbsp;</span><div><b>卡框</b><p>越粗代表越重要，核心技能带外发光</p></div></div>
        </div>
      </section>

      <!-- 段位阈值 -->
      <section class="insist-block">
        <div class="insist-block-head"><h2>段位阈值</h2><span class="insist-block-sub">XP 累计</span></div>
        <table class="tbl">
          <thead><tr><th>段位</th><th>起始 XP</th></tr></thead>
          <tbody>
            <tr v-for="t in thresholds" :key="t.level"><td>{{ t.level }}</td><td class="mono">{{ t.min }}</td></tr>
          </tbody>
        </table>
      </section>

      <!-- 打卡数值 -->
      <section class="insist-block">
        <div class="insist-block-head"><h2>打卡每日 XP</h2><span class="insist-block-sub">按卡等级</span></div>
        <table class="tbl">
          <thead><tr><th>卡等级</th><th>每日投入</th><th>基础 XP / 天</th></tr></thead>
          <tbody>
            <tr v-for="d in dailyXp" :key="d.tier"><td>{{ d.tier }}</td><td>{{ d.minutes }}</td><td class="mono">{{ d.xp }}</td></tr>
          </tbody>
        </table>

        <div class="two-col">
          <div>
            <h3 class="sub-title">天数递减</h3>
            <table class="tbl">
              <tbody><tr v-for="d in decay" :key="d.range"><td>{{ d.range }}</td><td class="mono">{{ d.rate }}</td></tr></tbody>
            </table>
          </div>
          <div>
            <h3 class="sub-title">爆满溢出</h3>
            <table class="tbl">
              <tbody><tr v-for="o in overflow" :key="o.range"><td>{{ o.range }}</td><td class="mono">{{ o.rate }}</td></tr></tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- 复习间隔 -->
      <section class="insist-block">
        <div class="insist-block-head"><h2>遗忘复习间隔</h2><span class="insist-block-sub">按重要程度</span></div>
        <table class="tbl">
          <thead><tr><th>重要程度</th><th>复习间隔</th></tr></thead>
          <tbody>
            <tr v-for="i in intervals" :key="i.importance"><td>{{ i.importance }}</td><td class="mono">{{ i.days }}</td></tr>
          </tbody>
        </table>
      </section>

      <!-- 原因模板 -->
      <section class="insist-block">
        <div class="insist-block-head"><h2>XP 原因模板</h2><span class="insist-block-sub">P4 可增删改</span></div>
        <div class="chips">
          <span v-for="r in reasons" :key="r" class="chip">{{ r }}</span>
        </div>
      </section>

      <!-- 数据导出 -->
      <section class="insist-block">
        <div class="insist-block-head"><h2>数据导出</h2><span class="insist-block-sub">备份 / 迁移</span></div>
        <p class="hint">
          JSON 是完整备份（技能、卡片、打卡记录、XP 事件），换设备或迁移时用；
          CSV 适合丢进 Excel 看，带 BOM，中文不乱码。
        </p>
        <div class="actions export-actions">
          <button class="insist-btn" type="button" :disabled="exporting" @click="download('json')">导出 JSON（全量）</button>
          <button class="insist-btn" type="button" :disabled="exporting" @click="download('csv')">导出技能 CSV</button>
          <button class="insist-btn" type="button" :disabled="exporting" @click="download('csv-cards')">导出卡片 CSV</button>
        </div>
        <p v-if="exportMsg" class="notice">{{ exportMsg }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: baseline; gap: 0.8rem; margin-top: 1.5rem; padding-bottom: 0.8rem; border-bottom: 1px solid #141414; }
.head h1 { font-size: 1.05rem; font-weight: 600; margin: 0; }
.sub { font-size: 0.68rem; color: #5f5f5f; }

.legend { margin-top: 0.7rem; display: grid; gap: 0.7rem; }
.lg { display: flex; align-items: flex-start; gap: 0.8rem; font-size: 0.78rem; }
.lg b { font-weight: 500; }
.lg p { margin: 0.1rem 0 0; font-size: 0.68rem; color: #6a6a6a; }
.lg > span { flex-shrink: 0; width: 76px; display: inline-flex; align-items: center; justify-content: flex-start; }
.lg-stars { color: #cfcfcf; letter-spacing: 1px; font-size: 0.72rem; }
.lg-tier { gap: 3px; }
.lg-tier i { display: block; width: 10px; height: 3px; background: #232323; border-radius: 1px; }
.lg-tier i.on { background: #cfcfcf; }
.lg-bar { height: 5px; background: #1a1a1a; border-radius: 3px; overflow: hidden; }
.lg-bar i { display: block; height: 100%; background: linear-gradient(90deg, #7a7a7a, #ededed); }
.lg-pct { font-size: 0.72rem; color: #d29922; }
.lg-frame { width: 30px !important; height: 18px; border: 2px solid #4a4a4a; border-radius: 4px; }

.tbl { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.76rem; }
.tbl th { text-align: left; font-weight: 400; color: #5f5f5f; font-size: 0.64rem; padding: 0.3rem 0.2rem; border-bottom: 1px solid #161616; }
.tbl td { padding: 0.34rem 0.2rem; border-bottom: 1px solid #101010; color: #b9b9b9; }
.tbl td.mono { color: #8a8a8a; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6rem; margin-top: 1rem; }
.sub-title { font-size: 0.68rem; font-weight: 400; color: #6f6f6f; letter-spacing: 0.08em; }

.chips { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.6rem; }
.chip { font-size: 0.72rem; color: #b9b9b9; border: 1px solid #242424; border-radius: 4px; padding: 0.2rem 0.55rem; }

.actions { margin-top: 2rem; }
@media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }
.hint { margin-top: 0.4rem; font-size: 0.7rem; color: #5f5f5f; line-height: 1.7; }
.export-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.8rem; }
.notice { margin-top: 0.6rem; font-size: 0.72rem; color: #8a8a8a; }
</style>
