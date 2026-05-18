<script setup lang="ts">
import * as THREE from 'three'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { SceneObject } from '../types/schema'
import { useAppState } from '../composables/useAppState'
import { buildItemMeshData, isAirBlockId } from '../texture/BlockTexture'

const props = defineProps<{
  object: SceneObject
}>()

const { schema, zipLoader } = useAppState()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const emoji = computed(() => props.object.type === 'camera' ? '📷' : '⬛')

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let currentObject: THREE.Object3D | null = null
let loadToken = 0

const firstBlock = computed(() => {
  if (props.object.type !== 'block') return null
  return props.object.keyframes[0]?.block ?? null
})

const firstState = computed(() => {
  if (props.object.type !== 'block') return {}
  return props.object.keyframes[0]?.state ?? {}
})

const shouldUseEmoji = computed(() =>
  props.object.type === 'camera' || isAirBlockId(firstBlock.value),
)

function disposeObject(object: THREE.Object3D) {
  object.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach(material => material.dispose())
    }
  })
}

function clearObject() {
  if (!scene || !currentObject) return
  scene.remove(currentObject)
  disposeObject(currentObject)
  currentObject = null
}

function renderIcon() {
  if (!renderer || !scene || !camera) return
  renderer.render(scene, camera)
}

function setCameraView(view: 'isometric' | 'front') {
  if (!camera) return
  if (view === 'front') {
    camera.position.set(0, 0, 4)
  } else {
    camera.position.set(2.2, 1.8, 2.2)
  }
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

function initRenderer() {
  if (!canvasRef.value || renderer) return

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: false,
    alpha: true,
  })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(28, 28, false)
  renderer.setClearColor(0x000000, 0)

  scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.75))

  const light = new THREE.DirectionalLight(0xffffff, 0.9)
  light.position.set(2, 4, 3)
  scene.add(light)

  camera = new THREE.OrthographicCamera(-1.05, 1.05, 1.05, -1.05, 0.1, 20)
  setCameraView('isometric')
}

async function loadIcon() {
  const token = ++loadToken
  initRenderer()
  clearObject()

  if (!scene || shouldUseEmoji.value || !firstBlock.value || !schema.value) {
    renderIcon()
    return
  }

  const meshData = await buildItemMeshData(
    firstBlock.value,
    firstState.value,
    zipLoader,
    schema.value.metadata.mc_version,
  )

  if (token !== loadToken || !scene || !meshData) return

  currentObject = meshData.object
  const iconView = meshData.iconView ?? 'isometric'
  setCameraView(iconView)
  currentObject.rotation.set(...meshData.rotation)
  currentObject.scale.setScalar(iconView === 'front' ? 1.55 : 1.25)
  scene.add(currentObject)
  renderIcon()
}

onMounted(loadIcon)

watch(
  () => [
    props.object.type,
    firstBlock.value,
    JSON.stringify(firstState.value),
    schema.value?.metadata.mc_version,
  ],
  loadIcon,
)

onUnmounted(() => {
  loadToken++
  clearObject()
  renderer?.dispose()
})
</script>

<template>
  <span class="object-icon" :class="{ 'object-icon--emoji': shouldUseEmoji }" aria-hidden="true">
    <span v-if="shouldUseEmoji" class="object-icon__emoji">{{ emoji }}</span>
    <canvas
      ref="canvasRef"
      class="object-icon__canvas"
      :class="{ 'object-icon__canvas--hidden': shouldUseEmoji }"
      width="28"
      height="28"
    />
  </span>
</template>

<style scoped>
.object-icon {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: grid;
  place-items: center;
}

.object-icon__canvas {
  width: 28px;
  height: 28px;
  display: block;
  image-rendering: pixelated;
}

.object-icon__emoji {
  font-size: 1rem;
  line-height: 1;
}

.object-icon__canvas--hidden {
  display: none;
}
</style>
