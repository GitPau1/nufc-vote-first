import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'config.ts')

function loadConfig(env) {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
  }).outputText

  const cjsModule = { exports: {} }
  const fn = new Function('exports', 'module', 'process', compiled)
  fn(cjsModule.exports, cjsModule, { env })
  return cjsModule.exports
}

test('does not enable dev mock auth by default when a real Supabase URL exists', () => {
  const config = loadConfig({
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  })

  assert.equal(config.IS_MOCK, false)
  assert.equal(config.ENABLE_DEV_MOCK_AUTH, false)
})

test('enables dev mock auth only when explicitly requested', () => {
  const config = loadConfig({
    NODE_ENV: 'development',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_ENABLE_DEV_MOCK_AUTH: 'true',
  })

  assert.equal(config.IS_MOCK, false)
  assert.equal(config.ENABLE_DEV_MOCK_AUTH, true)
})

test('does not enable dev mock auth in production', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  })

  assert.equal(config.IS_MOCK, false)
  assert.equal(config.ENABLE_DEV_MOCK_AUTH, false)
})
