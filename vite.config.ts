import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { base } from './lib/constants.ts'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [solid()],
})
