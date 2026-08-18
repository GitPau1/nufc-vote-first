import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const sourcePath = path.join(__dirname, 'rating.ts')

function loadRatingModule() {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
  }).outputText

  const cjsModule = { exports: {} }
  const fn = new Function('exports', 'module', compiled)
  fn(cjsModule.exports, cjsModule)
  return cjsModule.exports
}

test('maps average rating scores to fan-facing grades', () => {
  const { getRatingGrade } = loadRatingModule()
  assert.equal(getRatingGrade(0), 'F')
  assert.equal(getRatingGrade(0.5), 'F')
  assert.equal(getRatingGrade(0.6), 'D-')
  assert.equal(getRatingGrade(1.1), 'D')
  assert.equal(getRatingGrade(1.5), 'D+')
  assert.equal(getRatingGrade(2.5), 'C+')
  assert.equal(getRatingGrade(3.5), 'B+')
  assert.equal(getRatingGrade(4.5), 'A+')
  assert.equal(getRatingGrade(4.8), 'S')
  assert.equal(getRatingGrade(5), 'S+')
})

test('sorts rating players by GK, DEF, MID, FWD and then squad number', () => {
  const { sortPlayersForRating } = loadRatingModule()
  const players = [
    { id: 'fwd-14', position: 'FWD', squad_number: 14 },
    { id: 'def-5', position: 'DEF', squad_number: 5 },
    { id: 'mid-8', position: 'MID', squad_number: 8 },
    { id: 'gk-22', position: 'GK', squad_number: 22 },
    { id: 'def-2', position: 'DEF', squad_number: 2 },
  ]

  assert.deepEqual(
    sortPlayersForRating(players).map(player => player.id),
    ['gk-22', 'def-2', 'def-5', 'mid-8', 'fwd-14']
  )
})
