import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vitest/config'

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {}
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

export default defineConfig({
  test: {
    environment: 'node',
    env: loadEnvFile(path.resolve(__dirname, '.env.development.local')),
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
