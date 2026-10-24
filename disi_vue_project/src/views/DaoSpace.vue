<script setup>
/**
 * /dao/space —— 长按开锁后的落点（占位）
 *
 * 未来真正的应用会替换这个路由；现在只用一句话说明状态，
 * 保持和 /dao 同一套极简黑底。
 */
</script>

<template>
  <div class="space">
    <div class="space-glow" aria-hidden="true"></div>

    <main class="space-main">
      <p class="mark" aria-hidden="true">&gt;_</p>
      <h1 class="title">已开锁</h1>
      <p class="en">UNLOCKED</p>
      <p class="note">这里将是新的空间，还在建造中。</p>
    </main>

    <footer class="space-foot">
      <router-link to="/dao" class="back">← 回到入口</router-link>
      <router-link to="/user" class="back">返回论坛</router-link>
    </footer>
  </div>
</template>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }

.space {
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

.space-glow {
  position: absolute;
  inset: -30% -10% auto -10%;
  height: 60%;
  background: radial-gradient(48% 60% at 50% 10%, rgba(255, 255, 255, 0.08), transparent 70%);
  pointer-events: none;
}

.space-main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 0;
}

.mark {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.85rem;
  color: #5c5c5c;
  letter-spacing: -0.02em;
  margin-bottom: 1.6rem;
}

.title {
  font-size: clamp(1.8rem, 5vw, 2.6rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  background: linear-gradient(180deg, #ffffff 0%, #9d9d9d 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.en {
  margin-top: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  color: #6f6f6f;
}

.note {
  margin-top: 2rem;
  font-size: 0.85rem;
  color: #6f6f6f;
  line-height: 1.7;
}

.space-foot {
  display: flex;
  justify-content: center;
  gap: 2rem;
  padding: 1.5rem 0 2rem;
  border-top: 1px solid #141414;
}

.back {
  color: #7a7a7a;
  text-decoration: none;
  font-size: 0.78rem;
  transition: color 0.15s ease;
}
.back:hover { color: #ededed; }
</style>
