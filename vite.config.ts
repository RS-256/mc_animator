import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/mc_animator/', // GitHub Pages のリポジトリ名に合わせる
})
