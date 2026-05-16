import * as THREE from 'three'

// ── インターフェース ───────────────────────────────────────────────

export interface ITextureLoader {
  /** テクスチャを取得する。失敗時は Missing Texture を返す */
  load(path: string): Promise<THREE.Texture>
  /** リソースパック ZIP をセットする */
  setResourcePack?(zip: File): Promise<void>
}

// ── Missing Texture（マゼンタ/黒チェッカー） ─────────────────────────

function createMissingTexture(): THREE.Texture {
  const size = 16
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const isMagenta = (x < size / 2) !== (y < size / 2)
      data[idx + 0] = isMagenta ? 255 : 0
      data[idx + 1] = 0
      data[idx + 2] = isMagenta ? 255 : 0
      data[idx + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

export const MISSING_TEXTURE = createMissingTexture()

// ── CDN テクスチャローダー（jsDelivr + minecraft-assets） ────────────

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets'

export class CdnTextureLoader implements ITextureLoader {
  private version: string
  private cache = new Map<string, THREE.Texture>()
  private threeLoader = new THREE.TextureLoader()

  constructor(version: string) {
    this.version = version
  }

  setVersion(version: string) {
    this.version = version
    this.cache.clear()
  }

  async load(path: string): Promise<THREE.Texture> {
    if (this.cache.has(path)) return this.cache.get(path)!

    const url = `${CDN_BASE}@${this.version}/${path}`
    try {
      const tex = await new Promise<THREE.Texture>((resolve, reject) => {
        this.threeLoader.load(url, resolve, undefined, reject)
      })
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      this.cache.set(path, tex)
      return tex
    } catch {
      console.warn(`[TextureLoader] Failed to load: ${url}`)
      return MISSING_TEXTURE
    }
  }
}

// ── ZIP テクスチャローダー（ユーザー提供リソースパック） ──────────────

import JSZip from 'jszip'

export class ZipTextureLoader implements ITextureLoader {
  private fallback: CdnTextureLoader
  private zipEntries = new Map<string, Blob>()
  private cache = new Map<string, THREE.Texture>()

  constructor(fallback: CdnTextureLoader) {
    this.fallback = fallback
  }

  async setResourcePack(file: File): Promise<void> {
    this.zipEntries.clear()
    this.cache.clear()
    const zip = await JSZip.loadAsync(file)
    const tasks: Promise<void>[] = []
    zip.forEach((relativePath, entry) => {
      if (!entry.dir && relativePath.endsWith('.png')) {
        tasks.push(
          entry.async('blob').then(blob => {
            const key = relativePath.replace(/^assets\/minecraft\//, '')
            this.zipEntries.set(key, blob)
          }),
        )
      }
    })
    await Promise.all(tasks)
  }

  async load(path: string): Promise<THREE.Texture> {
    if (this.cache.has(path)) return this.cache.get(path)!

    // assets/minecraft/ を除いた key で検索
    const key = path.replace(/^assets\/minecraft\//, '')
    const blob = this.zipEntries.get(key)

    if (!blob) return this.fallback.load(path)

    const url = URL.createObjectURL(blob)
    const loader = new THREE.TextureLoader()
    try {
      const tex = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(url, resolve, undefined, reject)
      })
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      URL.revokeObjectURL(url)
      this.cache.set(path, tex)
      return tex
    } catch {
      URL.revokeObjectURL(url)
      return this.fallback.load(path)
    }
  }
}
