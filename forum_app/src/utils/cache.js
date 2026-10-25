/**
 * 轻量数据缓存：路由切换前预取，页面直接用缓存渲染，避免空壳闪烁
 */
const store = new Map()
const inflight = new Map()

export function peek(key) {
  const hit = store.get(key)
  return hit ? hit.data : undefined
}

export function invalidate(key) {
  store.delete(key)
  inflight.delete(key)
}

export function clearAll() {
  store.clear()
  inflight.clear()
}

export async function cached(key, fetcher, ttl = 20000) {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttl) return hit.data
  if (inflight.has(key)) return inflight.get(key)

  const task = fetcher()
    .then((data) => {
      store.set(key, { at: Date.now(), data })
      inflight.delete(key)
      return data
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })
  inflight.set(key, task)
  return task
}

/** 带超时的预取：路由守卫里用，慢就放弃，不卡住导航 */
export async function prefetch(key, fetcher, timeout = 1200) {
  try {
    await Promise.race([
      cached(key, fetcher),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ])
  } catch (e) {
    // 预取失败不影响导航
  }
}
