import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')

export default defineConfig({
  root,
  resolve: {
    alias: {
      [resolve(root, 'src/lib/faceBankAlign.ts')]: resolve(
        root,
        'scripts/stubs/faceBankAlign.stub.ts',
      ),
    },
  },
})
