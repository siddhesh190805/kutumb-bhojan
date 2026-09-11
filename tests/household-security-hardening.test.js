import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260916010000_household_security_hardening.sql'
);

function readMigration() {
  return fs.readFileSync(migrationPath, 'utf8');
}

test('SECURITY HARDENING: active household preference is server-side and membership-verified', () => {
  const sql = readMigration();

  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.user_household_preferences/i);
  assert.match(sql, /active_household_id\s+uuid\s+not\s+null\s+references\s+public\.households/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.set_active_household\s*\(/i);
  assert.match(sql, /not\s+public\.is_household_member\(target_household\)/i);
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.bootstrap_household\s*\(/i);
  assert.match(sql, /p\.active_household_id[\s\S]*public\.is_household_member\(p\.active_household_id\)/i);
});

test('SECURITY HARDENING: invite credential has at least 128 bits of randomness and plaintext is not stored', () => {
  const sql = readMigration();

  assert.match(
    sql,
    /gen_random_bytes\(4\)[\s\S]*gen_random_bytes\(4\)[\s\S]*gen_random_bytes\(4\)[\s\S]*gen_random_bytes\(4\)/i,
    'Invite token must use four 32-bit random segments (128 bits total)'
  );
  assert.match(sql, /token_hash\s*=\s*encode\(digest\(raw_token,\s*'sha256'\)/i);
  assert.doesNotMatch(
    sql,
    /insert\s+into\s+public\.household_invites[\s\S]{0,600}raw_token/i,
    'Plaintext invite token must never be inserted into household_invites'
  );
  assert.match(sql, /max_uses\s*> 100/i, 'Invite use count must be bounded server-side');
});

test('SECURITY HARDENING: joining sets active household atomically with membership', () => {
  const sql = readMigration();

  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.join_household\s*\(/i);
  assert.match(sql, /insert\s+into\s+public\.household_members[\s\S]*on\s+conflict\s*\(household_id,\s*user_id\)\s+do\s+nothing/i);
  assert.match(sql, /insert\s+into\s+public\.user_household_preferences\(user_id,\s*active_household_id/i);
});

test('SECURITY HARDENING: legacy ownerless shared households are quarantined', () => {
  const sql = readMigration();

  assert.match(sql, /hh\.name\s*=\s*'कुटुंब भोजन'/i);
  assert.match(sql, /not\s+exists\s*\([\s\S]*hm\.role\s*=\s*'owner'/i);
  assert.match(sql, /order\s+by\s+hm\.created_at,\s*hm\.user_id/i);
  assert.match(sql, /set\s+role\s*=\s*'owner'/i);
  assert.match(sql, /delete\s+from\s+public\.household_members[\s\S]*user_id\s*<>\s*keep_user/i);
});
