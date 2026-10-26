const { contextBridge } = require('electron')

// 渲染层通过 window.__DISI_API_BASE__ 决定 API 地址
const arg = process.argv.find((a) => a.startsWith('--disi-api='))
const API_BASE = arg ? arg.slice('--disi-api='.length) : 'https://forum.disi-al.com'

contextBridge.exposeInMainWorld('__DISI_API_BASE__', API_BASE)