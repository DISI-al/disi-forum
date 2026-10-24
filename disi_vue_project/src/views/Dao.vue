<script setup>
/**
 * /dao —— 新空间的入口页
 *
 * 结构：一句引言（中文在上、英文在下）＋ 长按充能开锁。
 * 开锁后跳到 UNLOCK_TARGET；后续独立应用挂到该路径时，改这一行常量即可。
 * 视觉与论坛的 GitHub 风格区分：纯黑、无边框卡片、只保留极细的分割线。
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const UNLOCK_TARGET = '/dao/space'   // 未来应用的挂载点；现在是一个占位页
const CHARGE_MS = 1200               // 按住多久算充满

const RING_R = 28
const RING_C = 2 * Math.PI * RING_R

const progress = ref(0)     // 0 ~ 1
const charging = ref(false)
const unlocked = ref(false)

let rafId = 0
let startedAt = 0
let jumpTimer = 0

const dashOffset = computed(() => RING_C * (1 - progress.value))

function start(event) {
  if (unlocked.value) return
  if (event && event.pointerType === 'mouse' && event.button !== 0) return
  if (event && event.currentTarget?.setPointerCapture && event.pointerId !== undefined) {
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch (err) { /* 忽略 */ }
  }
  charging.value = true
  startedAt = performance.now()
  cancelAnimationFrame(rafId)
  const tick = (now) => {
    progress.value = Math.min(1, (now - startedAt) / CHARGE_MS)
    if (progress.value >= 1) {
      finish()
      return
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function stop() {
  if (unlocked.value || !charging.value) return
  charging.value = false
  cancelAnimationFrame(rafId)
  progress.value = 0
}

function finish() {
  cancelAnimationFrame(rafId)
  charging.value = false
  unlocked.value = true
  progress.value = 1
  jumpTimer = window.setTimeout(() => router.push(UNLOCK_TARGET), 320)
}

function onKeyDown(event) {
  if (event.repeat) return
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    start()
  }
}

function onKeyUp(event) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    stop()
  }
}

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  clearTimeout(jumpTimer)
})
</script>

<template>
  <div class="dao">
    <div class="dao-glow" aria-hidden="true"></div>

    <header class="dao-nav">
      <span class="dao-mark" aria-hidden="true">&gt;_</span>
      <router-link to="/user" class="dao-back">返回</router-link>
    </header>

    <main class="dao-main">
      <blockquote class="quote">
        <p class="cn">虚无缥缈的天赋，<br>又怎么能比得上脚踏实地的努力</p>
        <p class="en">How can ethereal talent compare with down-to-earth effort?</p>
      </blockquote>

      <div class="unlock">
        <button
          type="button"
          class="charge"
          :class="{ charging, unlocked }"
          :aria-label="unlocked ? '已解锁' : '长按充能开锁'"
          @pointerdown="start"
          @pointerup="stop"
          @pointercancel="stop"
          @pointerleave="stop"
          @keydown="onKeyDown"
          @keyup="onKeyUp"
          @contextmenu.prevent
        >
          <svg class="ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" :r="RING_R" class="ring-track" />
            <circle
              cx="32"
              cy="32"
              :r="RING_R"
              class="ring-bar"
              :style="{ strokeDasharray: RING_C, strokeDashoffset: dashOffset }"
            />
          </svg>

          <svg class="lock" viewBox="0 0 24 24" aria-hidden="true">
            <template v-if="!unlocked">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
              <path d="M8.4 10.5V7.6a3.6 3.6 0 0 1 7.2 0v2.9" />
            </template>
            <path v-else d="M5.2 12.6l4.6 4.6L18.9 7.4" />
          </svg>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.dao {
  position: relative;
  min-height: 100vh;
  background: #000;
  color: #ededed;
  display: flex;
  flex-direction: column;
  padding: 0 1.5rem;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", Inter, Helvetica, Arial, sans-serif;
}

.dao-glow {
  position: absolute;
  inset: -30% -10% auto -10%;
  height: 62%;
  background: radial-gradient(50% 60% at 50% 0%, rgba(255, 255, 255, 0.07), transparent 70%);
  pointer-events: none;
}

.dao-nav {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 1.4rem 0;
  border-bottom: 1px solid #141414;
}

.dao-mark {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: #ededed;
  letter-spacing: -0.02em;
}

.dao-back {
  margin-left: auto;
  color: #7a7a7a;
  text-decoration: none;
  font-size: 0.78rem;
  transition: color 0.15s ease;
}
.dao-back:hover { color: #ededed; }

.dao-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 0 5rem;
  text-align: center;
}

.quote { max-width: 46rem; }

.cn {
  font-size: clamp(1.7rem, 5vw, 2.6rem);
  font-weight: 600;
  line-height: 1.6;
  letter-spacing: 0.01em;
  background: linear-gradient(180deg, #ffffff 0%, #9d9d9d 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.en {
  margin-top: 1.4rem;
  font-size: clamp(0.98rem, 2.2vw, 1.12rem);
  line-height: 1.6;
  color: #767676;
  letter-spacing: 0.01em;
}

.unlock {
  margin-top: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.charge {
  position: relative;
  width: 96px;
  height: 96px;
  border: none;
  background: transparent;
  color: #ededed;
  display: grid;
  place-items: center;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.charge:focus-visible {
  outline: 2px solid #ededed;
  outline-offset: 8px;
  border-radius: 50%;
}

.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.ring-track {
  fill: none;
  stroke: #232323;
  stroke-width: 1.6;
}
.ring-bar {
  fill: none;
  stroke: #ededed;
  stroke-width: 1.6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.25s ease;
}
.charge.charging .ring-bar { transition: none; }

.lock {
  width: 30px;
  height: 30px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.9;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.charge.charging .lock { opacity: 1; transform: scale(0.95); }
.charge.unlocked { cursor: default; }
.charge.unlocked .lock { opacity: 1; }

@media (max-width: 640px) {
  .dao { padding: 0 1rem; }
  .dao-main { padding: 2rem 0 3.5rem; }
  .en { font-size: 0.82rem; }
  .unlock { margin-top: 3rem; }
}

@media (prefers-reduced-motion: reduce) {
  .ring-bar, .lock, .dao-back { transition: none; }
}
</style>
