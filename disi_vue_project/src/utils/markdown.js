/**
 * 轻量 Markdown 渲染（零依赖，移动端开销极小）
 *
 * 设计要点：
 * 1. 先整体转义 HTML，再按白名单生成标签，因此不支持、也不会输出任何原始 HTML —— 天然免疫 XSS。
 * 2. 链接地址只放行 http(s) / mailto / tel / 站内相对路径，其余一律替换为 #。
 * 3. 只做论坛常用的语法：标题、粗体、斜体、删除线、行内代码、代码块、引用、
 *    有序/无序列表、分割线、图片、链接，以及裸 URL 自动识别（就是「正文里的链接变成超链接」）。
 *
 * 支持的语法示例：
 *   # 标题 / ## 二级标题
 *   **粗体**  *斜体*  ~~删除线~~  `行内代码`
 *   ```js 代码块 ```
 *   > 引用
 *   - 无序列表 / 1. 有序列表
 *   [文字](https://example.com)  ![图片](https://example.com/a.png)
 *   https://example.com  ← 不需要写方括号也会变成链接
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** 转义 HTML 特殊字符 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/** 只允许安全协议与站内相对路径 */
const SAFE_URL = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i

function safeUrl(raw) {
  const url = String(raw ?? '').trim()
  return SAFE_URL.test(url) ? url : '#'
}

function linkHtml(url, label) {
  return `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
}

/** 行内强调（粗体 / 斜体 / 删除线），用于链接文字之类的短片段 */
function emphasize(text) {
  return String(text ?? '')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/(^|[\s（(【>])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s（(【>])_([^_\n]+)_/g, '$1<em>$2</em>')
}

/**
 * 渲染一段「已转义」的行内文本。
 * 先用手法把代码、图片、链接替换成占位符，避免后续的强调/自动链接把 HTML 拆坏。
 */
export function renderInline(escapedText) {
  const slots = []
  const hold = (html) => {
    slots.push(html)
    return `\u0000${slots.length - 1}\u0000`
  }

  let s = String(escapedText ?? '')

  // 行内代码
  s = s.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${code}</code>`))

  // 图片 ![alt](src "title") —— URL 允许一层圆括号，如 https://x.com/a_(b)
  s = s.replace(/!\[([^\]]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;([^)]*?)&quot;)?\s*\)/g, (_, alt, src, title) => {
    const t = title ? ` title="${title}"` : ''
    return hold(`<img src="${safeUrl(src)}" alt="${alt}"${t} loading="lazy" decoding="async" />`)
  })

  // 链接 [文字](url "title")
  s = s.replace(/\[([^\]]+)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;([^)]*?)&quot;)?\s*\)/g, (_, label, href, title) => {
    const t = title ? ` title="${title}"` : ''
    return hold(`<a href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer"${t}>${emphasize(label)}</a>`)
  })

  // <https://...> 尖括号自动链接
  s = s.replace(/&lt;((?:https?:\/\/|mailto:)[^\s]+?)&gt;/g, (_, url) => hold(linkHtml(url, url)))

  // 裸链接自动识别（正文里直接写 URL 也能点）
  s = s.replace(/https?:\/\/[^\s\u0000]+/g, (raw) => {
    const url = raw.replace(/[.,;:!?)\]}>，。；：！？、）】]+$/, '')
    const tail = raw.slice(url.length)
    return hold(linkHtml(url, url)) + tail
  })

  s = emphasize(s)

  return s.replace(/\u0000(\d+)\u0000/g, (_, idx) => slots[Number(idx)] ?? '')
}

/** 把 Markdown 源码渲染成安全的 HTML 字符串 */
export function renderMarkdown(source) {
  const lines = escapeHtml(source).replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // 代码块 ```lang
    const fence = line.match(/^\s*```(\S*)\s*$/)
    if (fence) {
      const lang = fence[1] || ''
      const buf = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
      if (i < lines.length) i++
      const cls = lang ? ` class="language-${lang.replace(/[^\w-]/g, '')}"` : ''
      out.push(`<pre><code${cls}>${buf.join('\n')}</code></pre>`)
      continue
    }

    // 标题 # ~ ######
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      i++
      continue
    }

    // 分割线
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr />')
      i++
      continue
    }

    // 引用 > （转义后是 &gt;）
    if (/^\s*&gt;\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*&gt;\s?/, ''))
        i++
      }
      out.push(`<blockquote><p>${buf.map(renderInline).join('<br>')}</p></blockquote>`)
      continue
    }

    // 列表 - * + / 1. 2)
    const ordered = /^\s*\d+[.)]\s+/.test(line)
    const bulleted = /^\s*[-*+]\s+/.test(line)
    if (ordered || bulleted) {
      const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/
      const items = []
      while (i < lines.length && marker.test(lines[i])) {
        const parts = [lines[i].replace(marker, '')]
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) {
          parts.push(lines[i].trim())
          i++
        }
        items.push(`<li>${parts.map(renderInline).join('<br>')}</li>`)
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
      continue
    }

    // 段落：连续非空行，行内换行保留为 <br>
    const buf = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(?:```|#{1,6}\s|&gt;|[-*+]\s|\d+[.)]\s)/.test(lines[i])
    ) {
      buf.push(lines[i].trim())
      i++
    }
    if (!buf.length) { i++; continue }
    out.push(`<p>${buf.map(renderInline).join('<br>')}</p>`)
  }

  return out.join('\n')
}

/** 把 Markdown 压成一行纯文本，用于列表预览、搜索和截断 */
export function mdToPlainText(source) {
  let s = String(source ?? '').replace(/\r\n?/g, '\n')
  s = s.replace(/```[\s\S]*?```/g, ' ')
  s = s.replace(/`([^`\n]+)`/g, '$1')
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, '$1')
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  s = s.replace(/^\s*>\s?/gm, '')
  s = s.replace(/^\s*[-*+]\s+/gm, '')
  s = s.replace(/^\s*\d+[.)]\s+/gm, '')
  s = s.replace(/[*_~]{1,3}/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** 生成列表用的短预览（默认 160 字） */
export function makePreview(content, max = 160) {
  const text = mdToPlainText(content)
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** 从正文里提取 #标签，规则与后端 create_post 保持一致 */
export function extractTags(content) {
  const tags = []
  for (const word of String(content ?? '').split(/\s+/)) {
    if (word.startsWith('#') && word.length > 1) {
      // 遇到标点就截断：#bug，好累 → bug
      const tag = word.slice(1).split(/[,.;:!?，。；：！？、)\]}>]/)[0]
      if (tag && !tags.includes(tag)) tags.push(tag)
    }
  }
  return tags
}
