import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import { base } from './lib/constants.ts';
import { readdirSync } from 'node:fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [devtools(), solidPlugin()],
  base,
  appType: 'mpa',
  build: {
    assetsInlineLimit(filePath, content) {
      return !filePath.endsWith('icons.svg')
    },
    target: 'esnext',
    rolldownOptions: {
      input: readdirSync('./').filter(n => n.endsWith('.html'))
    }
  },
})
