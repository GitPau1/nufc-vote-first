import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname
const source = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8')

// ACCOUNT_PURGE_SECRET이 유출돼도 요청 바디의 userIds를 그대로 믿고 삭제하면 임의 계정이
// 지워질 수 있다. 서버가 DB에서 deleted_at 기준으로 재검증한 dueIds만 삭제 대상으로 좁혀야 한다.
test('purge route re-validates userIds against deleted_at before deleting', () => {
  assert.match(source, /\.not\('deleted_at', 'is', null\)/)
  assert.match(source, /\.lte\('deleted_at', new Date\(Date\.now\(\) - 24 \* 60 \* 60 \* 1000\)\.toISOString\(\)\)/)
  assert.match(source, /const dueIds = \(dueUsers \?\? \[\]\)\.map/)

  // deleteUser 호출은 검증되지 않은 userIds가 아니라 재검증된 dueIds를 기준으로 이뤄져야 한다.
  assert.match(source, /dueIds\.map\(\(id: string\) => supabase\.auth\.admin\.deleteUser\(id\)\)/)
  assert.doesNotMatch(source, /userIds\.map\(id => supabase\.auth\.admin\.deleteUser\(id\)\)/)
})
