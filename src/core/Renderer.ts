import * as THREE from 'three'
import type { AnimationSchema } from '../types/schema'
import { DEFAULT_BACKGROUND_COLOR } from '../types/schema'
import { resolveScene } from '../core/Interpolator'
import type { IAssetLoader } from '../texture/TextureLoader'
import { buildBlockMeshData } from '../texture/BlockTexture'

// ARGB hex string → { r, g, b, a } (0–1)
function parseARGB(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '')
  const a = parseInt(clean.substring(0, 2), 16) / 255
  const r = parseInt(clean.substring(2, 4), 16) / 255
  const g = parseInt(clean.substring(4, 6), 16) / 255
  const b = parseInt(clean.substring(6, 8), 16) / 255
  return { r, g, b, a }
}

interface BlockMeshEntry {
  object: THREE.Object3D
  blockId: string
  stateKey: string
}

interface SceneRendererOptions {
  pixelRatio?: number
}

export class SceneRenderer {
  public renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private animFrameId: number | null = null

  private schema: AnimationSchema | null = null
  private textureLoader: IAssetLoader | null = null
  private blockMeshes = new Map<string, BlockMeshEntry>()

  private currentTick = 0

  constructor(canvas: HTMLCanvasElement, options: SceneRendererOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
    this.renderer.setPixelRatio(options.pixelRatio ?? window.devicePixelRatio)
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 1000)
    this.camera.position.set(10, 10, 10)
    this.camera.lookAt(0, 0, 0)

    // ライティング
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    const sun = new THREE.DirectionalLight(0xffffff, 1.0)
    sun.position.set(5, 10, 5)
    this.scene.add(ambient, sun)
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  async loadSchema(schema: AnimationSchema, loader: IAssetLoader) {
    this.schema = schema
    this.textureLoader = loader
    this.blockMeshes.forEach(entry => {
      this.scene.remove(entry.object)
      this.disposeObject(entry.object)
    })
    this.blockMeshes.clear()

    // 背景色設定
    const bgHex = schema.metadata.background_color ?? DEFAULT_BACKGROUND_COLOR
    const { r, g, b, a } = parseARGB(bgHex)
    this.renderer.setClearColor(new THREE.Color(r, g, b), a)

    await this.updateScene(0)
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(material => material.dispose())
      }
    })
  }

  async updateScene(tick: number) {
    if (!this.schema || !this.textureLoader) return
    this.currentTick = tick

    const resolved = resolveScene(this.schema, tick)

    // カメラ更新
    const cam = resolved.camera
    this.camera.position.set(...cam.pos)
    this.camera.lookAt(new THREE.Vector3(...cam.look_at))
    this.camera.fov = cam.fov
    this.camera.updateProjectionMatrix()

    // ブロック更新
    const activeIds = new Set(resolved.blocks.keys())

    // 不要なメッシュを削除
    for (const [id, entry] of this.blockMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.object)
        this.disposeObject(entry.object)
        this.blockMeshes.delete(id)
      }
    }

    // ブロックを追加・更新
    for (const [id, blockState] of resolved.blocks) {
      const stateKey = JSON.stringify(blockState.state)
      const existing = this.blockMeshes.get(id)

      if (existing && existing.blockId === blockState.block && existing.stateKey === stateKey) {
        // テクスチャ変化なし、位置だけ更新
        existing.object.position.set(...blockState.pos)
      } else {
        // メッシュを再生成
        if (existing) {
          this.scene.remove(existing.object)
          this.disposeObject(existing.object)
        }

        const meshData = await buildBlockMeshData(
          blockState.block,
          blockState.state,
          this.textureLoader!,
          this.schema!.metadata.mc_version,
        )
        // air 等は null が返るのでスキップ
        if (!meshData) continue

        const object = meshData.object
        object.position.set(...blockState.pos)
        object.rotation.set(...meshData.rotation)
        this.scene.add(object)
        this.blockMeshes.set(id, { object, blockId: blockState.block, stateKey })
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  startPreview(getTick: () => number) {
    const loop = async () => {
      const tick = getTick()
      if (tick !== this.currentTick) {
        await this.updateScene(tick)
      } else {
        this.renderer.render(this.scene, this.camera)
      }
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  stopPreview() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  /** オフスクリーンレンダリングで指定 tick の PNG Blob を返す */
  async renderFrameBlob(tick: number): Promise<Blob> {
    await this.updateScene(tick)
    this.renderer.render(this.scene, this.camera)
    return new Promise<Blob>((resolve, reject) => {
      this.renderer.domElement.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png',
      )
    })
  }

  dispose() {
    this.stopPreview()
    this.blockMeshes.forEach(e => {
      this.scene.remove(e.object)
      this.disposeObject(e.object)
    })
    this.renderer.dispose()
  }
}
