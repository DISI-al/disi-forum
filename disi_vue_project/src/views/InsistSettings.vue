<script setup>
/**
 * INSIST · 设置（可编辑，每用户生效）
 * 图例 + 段位阈值 + 打卡数值 + 溢出 + 复习间隔（可改）+ 数据导出
 */
import { ref, onMounted } from 'vue'
import InsistNav from '../components/InsistNav.vue'
import { LEVELS, TIERS, IMPORTANCE } from '../insist/constants.js'
import { apiSettings, apiSaveSettings, apiResetSettings, apiExport } from '../api/insist_api.js'

const loading = ref(true)
const saving = ref(false)
const msg = ref('')
const error = ref('')

const config = ref(null)
const defaults = ref(null)
const customized = ref(false)

const exporting = ref(false)
const exportMsg = ref('')

const levelNames = ['入门', '熟练', '精通', '专家']

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiSettings()
    config.value = res.config
    defaults.value = res.defaults
    customized.value = res.customized
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function validate() {
  const c = config.value
  for (let i = 1; i < c.levelMin.length; i++) {
    if (!(c.levelMin[i] > c.levelMin[i - 1])) return '段位阈值必须递增'
  }
  for (const tier of ['1', '2', '3', '4']) {
    if (!(Number(c.dailyXp[tier]) > 0)) return '每日 XP 必须大于 0'
  }
  for (const item of c.decay) {
    if (!(item.factor >= 0 && item.factor <= 1)) return '递减系数要在 0 到 1 之间'
  }
  for (const item of c.overflow) {
    if (!(item.rate >= 0 && item.rate <= 1)) return '溢出倍率要在 0 到 1 之间'
  }
  for (const key of ['1', '2', '3', '4']) {
    if (!(Number(c.reviewDays[key]) > 0)) return '复习间隔必须大于 0'
  }
  return ''
}

async function save() {
  if (saving.value) return
  const bad = validate()
  if (bad) { error.value = bad; return }
  saving.value = true
  error.value = ''
  msg.value = ''
  try {
    const res = await apiSaveSettings(config.value)
    config.value = res.config
    customized.value = res.customized
    msg.value = '已保存，之后的打卡 / 晋升按新数值计算'
  } catch (e) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function reset() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  msg.value = ''
  try {
    const res = await apiResetSettings()
    config.value = res.config
    customized.value = res.customized
    msg.value = '已恢复默认数值'
  } catch (e) {
    error.value = e.message || '恢复失败'
  } finally {
    saving.value = false
  }
}

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

onMounted(load)
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
        <span class="sub">{{ customized ? '已使用自定义数值' : '当前是默认数值' }}</span>
      </section>

      <p v-if="error" class="state err">{{ error }}</p>
      <p v-else-if="loading" class="state">加载中…</p>

      <template v-else-if="config">
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
          <div class="insist-block-head"><h2>段位阈值</h2><span class="insist-block-sub">XP 累计，必须递增</span></div>
          <table class="tbl">
            <thead><tr><th>段位</th><th>起始 XP</th></tr></thead>
            <tbody>
              <tr><td>初识</td><td class="mono">0（固定）</td></tr>
              <tr v-for="(name, i) in levelNames" :key="name">
                <td>{{ name }}</td>
                <td><input v-model.number="config.levelMin[i + 1]" type="number" min="1" step="10" class="num" /></td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 打卡每日 XP -->
        <section class="insist-block">
          <div class="insist-block-head"><h2>打卡每日 XP</h2><span class="insist-block-sub">按卡等级</span></div>
          <table class="tbl">
            <thead><tr><th>卡等级</th><th>每日基础 XP</th></tr></thead>
            <tbody>
              <tr v-for="(name, i) in TIERS" :key="name">
                <td>{{ name }}</td>
                <td><input v-model.number="config.dailyXp[String(i + 1)]" type="number" min="0" step="0.5" class="num" /></td>
              </tr>
            </tbody>
          </table>

          <div class="two-col">
            <div>
              <h3 class="sub-title">天数递减（累计打卡天数）</h3>
              <table class="tbl">
                <tbody>
                  <tr v-for="(item, i) in config.decay" :key="i">
                    <td>第 {{ i === 0 ? 1 : config.decay[i - 1].days }}–{{ item.days === null ? '∞' : item.days - 1 }} 天</td>
                    <td><input v-model.number="config.decay[i].factor" type="number" min="0" max="1" step="0.01" class="num" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 class="sub-title">爆满溢出（爆满后第 N 天）</h3>
              <table class="tbl">
                <tbody>
                  <tr v-for="(item, i) in config.overflow" :key="i">
                    <td>{{ i === 0 ? '0' : config.overflow[i - 1].days }}–{{ item.days === null ? '∞' : item.days - 1 }} 天</td>
                    <td><input v-model.number="config.overflow[i].rate" type="number" min="0" max="1" step="0.01" class="num" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- 复习间隔 -->
        <section class="insist-block">
          <div class="insist-block-head"><h2>遗忘复习间隔</h2><span class="insist-block-sub">按重要程度，单位天</span></div>
          <table class="tbl">
            <thead><tr><th>重要程度</th><th>复习间隔</th></tr></thead>
            <tbody>
              <tr v-for="(name, i) in IMPORTANCE" :key="name">
                <td>{{ name }}</td>
                <td><input v-model.number="config.reviewDays[String(i + 1)]" type="number" min="1" step="5" class="num" /></td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 原因模板 -->
        <section class="insist-block">
          <div class="insist-block-head"><h2>XP 原因模板</h2><span class="insist-block-sub">记录 XP 时可选的原因</span></div>
          <div class="reason-list">
            <div v-for="(r, i) in config.reasons" :key="i" class="reason-row">
              <input v-model="config.reasons[i]" type="text" maxlength="20" class="num wide" />
              <button class="insist-btn" type="button" @click="config.reasons.splice(i, 1)">删除</button>
            </div>
          </div>
          <button class="insist-btn" type="button" @click="config.reasons.push('')">＋ 添加原因</button>
        </section>

        <div class="actions">
          <button class="insist-btn primary" type="button" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存设置' }}
          </button>
          <button class="insist-btn" type="button" :disabled="saving" @click="reset">恢复默认</button>
          <span v-if="msg" class="notice inline">{{ msg }}</span>
        </div>

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
      </template>
    </main>
  </div>
</template>

<style scoped>
.state { color: #8a8a8a; font-size: 0.82rem; padding: 1rem 0; }
.state.err { color: #f85149; }

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

.num {
  width: 90px;
  background: #0c0c0c;
  border: 1px solid #222;
  border-radius: 4px;
  color: #ededed;
  font-size: 0.78rem;
  padding: 0.25rem 0.4rem;
  outline: none;
}
.num:focus { border-color: #444; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6rem; margin-top: 1rem; }
.sub-title { font-size: 0.68rem; font-weight: 400; color: #6f6f6f; letter-spacing: 0.08em; }

.chips { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.6rem; }
.chip { font-size: 0.72rem; color: #b9b9b9; border: 1px solid #242424; border-radius: 4px; padding: 0.2rem 0.55rem; }

.actions { margin-top: 1.4rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.export-actions { margin-top: 0.8rem; }
.hint { margin-top: 0.4rem; font-size: 0.7rem; color: #5f5f5f; line-height: 1.7; }
.notice { margin-top: 0.6rem; font-size: 0.72rem; color: #8a8a8a; }
.notice.inline { margin-top: 0; margin-left: 0.2rem; }
@media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }
.reason-list { display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.6rem; }
.reason-row { display: flex; align-items: center; gap: 0.5rem; }
.num.wide { width: 200px; }
</style>
