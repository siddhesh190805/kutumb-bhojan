import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// PART 1: Static Migration & SQL Policy Audit
// ---------------------------------------------------------------------------

test('SECURITY AUDIT: canonical schema and latest migration enforce per-identity isolation', () => {
  const schemaPath = path.join(process.cwd(), 'supabase.schema.sql');
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260916000000_secure_household_isolation.sql');

  assert.ok(fs.existsSync(schemaPath), 'supabase.schema.sql must exist');
  assert.ok(fs.existsSync(migrationPath), 'secure isolation migration must exist');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  // Verify that the bootstrap_household function in the latest migration does NOT
  // blindly match households by global name for anonymous users.
  assert.doesNotMatch(
    migrationContent,
    /where\s+name\s*=\s*'कुटुंब भोजन'[\s\S]*?insert\s+into\s+public\.household_members/i,
    'Latest migration bootstrap_household must not globally bind anonymous users to household named कुटुंब भोजन'
  );

  // Verify that the canonical schema also removes the global name binding.
  assert.doesNotMatch(
    schemaContent,
    /where\s+name\s*=\s*'कुटुंब भोजन'[\s\S]*?insert\s+into\s+public\.household_members/i,
    'Canonical schema bootstrap_household must not globally bind anonymous users to household named कुटुंब भोजन'
  );

  // Verify creation of new households with caller as owner
  assert.match(
    migrationContent,
    /insert\s+into\s+public\.household_members\s*\([^)]*role[^)]*\)\s*values\s*\([^)]*'owner'\)/i,
    'bootstrap_household must establish caller as owner of a new isolated household'
  );
});

test('SECURITY AUDIT: household_invites table and RPCs are defined with hashed token storage', () => {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260916000000_secure_household_isolation.sql');
  const content = fs.readFileSync(migrationPath, 'utf8');

  // Table definition
  assert.match(content, /create\s+table\s+(if\s+not\s+exists\s+)?public\.household_invites/i);
  assert.match(content, /token_hash\s+text\s+not\s+null/i, 'household_invites must store hashed token, not plaintext');
  assert.match(content, /expires_at\s+timestamptz\s+not\s+null/i, 'household_invites must enforce expiration');
  assert.match(content, /max_uses\s+integer/i, 'household_invites must support bounded usage');
  assert.match(content, /revoked\s+boolean/i, 'household_invites must support revocation');

  // RPCs
  assert.match(content, /create\s+or\s+replace\s+function\s+public\.create_household_invite/i);
  assert.match(content, /create\s+or\s+replace\s+function\s+public\.join_household/i);
  assert.match(content, /create\s+or\s+replace\s+function\s+public\.revoke_household_invite/i);

  // Cryptographic hashing (digest sha256)
  assert.match(content, /digest\s*\([^)]*'sha256'\s*\)/i, 'Invite creation and join must use sha256 digest');
  assert.match(content, /invalid_or_expired_invite/, 'join_household must emit generic error to prevent enumeration');
});

test('SECURITY AUDIT: all household-scoped tables enforce RLS on SELECT and MUTATE', () => {
  const schemaPath = path.join(process.cwd(), 'supabase.schema.sql');
  const content = fs.readFileSync(schemaPath, 'utf8');

  const householdScopedTables = [
    'family_members',
    'recipes',
    'meal_entries',
    'shopping_items',
    'prep_tasks',
    'household_settings',
    'recipe_ingredients',
    'dietary_rules',
    'meal_assignments',
    'household_frequency_rules'
  ];

  for (const table of householdScopedTables) {
    // Check RLS enabled
    const rlsRegex = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i');
    assert.match(content, rlsRegex, `Table ${table} must have RLS enabled`);

    // Check policy uses is_household_member for both using and with check
    const policyRegex = new RegExp(`create\\s+policy\\s+\\w+\\s+on\\s+public\\.${table}\\s+for\\s+all[\\s\\S]*?using[\\s\\S]*?is_household_member[\\s\\S]*?with\\s+check[\\s\\S]*?is_household_member`, 'i');
    assert.match(content, policyRegex, `Table ${table} must enforce is_household_member on both USING and WITH CHECK`);
  }
});

test('SECURITY AUDIT: client app.js does not expose service-role key or bypass isolation', () => {
  const appJs = fs.readFileSync(path.join(process.cwd(), 'app.js'), 'utf8');

  // Service role key pattern check
  assert.doesNotMatch(appJs, /service_role/i, 'app.js must not reference or include service_role');
  assert.doesNotMatch(appJs, /sb_secret/i, 'app.js must not include Supabase secret keys');

  // Verify URL invite join handling exists
  assert.match(appJs, /join_household/, 'app.js must support join_household RPC');
  assert.match(appJs, /create_household_invite/, 'app.js must support create_household_invite RPC');
});

// ---------------------------------------------------------------------------
// PART 2: Functional Security Isolation Simulation (Scenarios A - H)
// ---------------------------------------------------------------------------

class MockDatabase {
  constructor() {
    this.households = new Map();
    this.householdMembers = []; // { household_id, user_id, role, created_at }
    this.householdInvites = []; // { id, household_id, token_hash, created_by, expires_at, max_uses, use_count, revoked }
    this.householdSettings = new Map();
    this.mealEntries = []; // { id, household_id, meal_date, slot, title }
  }

  isHouseholdMember(householdId, userId) {
    if (!userId || !householdId) return false;
    return this.householdMembers.some(
      m => m.household_id === householdId && m.user_id === userId
    );
  }

  bootstrapHousehold(userId, householdName = 'कुटुंब भोजन') {
    if (!userId) throw new Error('authentication required');

    // 1. Existing membership check
    const existing = this.householdMembers
      .filter(m => m.user_id === userId)
      .sort((a, b) => a.created_at - b.created_at)[0];
    if (existing) {
      return existing.household_id;
    }

    // 2. Isolated creation (NO global name match)
    const householdId = crypto.randomUUID();
    this.households.set(householdId, { id: householdId, name: householdName });
    this.householdMembers.push({
      household_id: householdId,
      user_id: userId,
      role: 'owner',
      created_at: Date.now()
    });
    this.householdSettings.set(householdId, { household_id: householdId, display_name: householdName });
    return householdId;
  }

  createHouseholdInvite(userId, targetHousehold, expiresInHours = 48, maxUses = 5) {
    if (!userId) throw new Error('authentication required');
    if (!this.isHouseholdMember(targetHousehold, userId)) {
      throw new Error('unauthorized: caller is not a member of target household');
    }

    const rawToken = 'KB-' + crypto.randomBytes(2).toString('hex').toUpperCase() + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = Date.now() + expiresInHours * 3600 * 1000;

    const invite = {
      id: crypto.randomUUID(),
      household_id: targetHousehold,
      token_hash: tokenHash,
      created_by: userId,
      expires_at: expiresAt,
      max_uses: maxUses,
      use_count: 0,
      revoked: false
    };
    this.householdInvites.push(invite);

    return { token: rawToken, expires_at: expiresAt, max_uses: maxUses };
  }

  joinHousehold(userId, inviteToken) {
    if (!userId) throw new Error('authentication required');
    const normalized = (inviteToken || '').trim().toUpperCase();
    if (!normalized) throw new Error('invalid_or_expired_invite');

    const tokenHash = crypto.createHash('sha256').update(normalized).digest('hex');
    const now = Date.now();

    const invite = this.householdInvites.find(
      inv => inv.token_hash === tokenHash && !inv.revoked && inv.expires_at > now && inv.use_count < inv.max_uses
    );

    if (!invite) {
      throw new Error('invalid_or_expired_invite');
    }

    invite.use_count += 1;

    if (!this.isHouseholdMember(invite.household_id, userId)) {
      this.householdMembers.push({
        household_id: invite.household_id,
        user_id: userId,
        role: 'member',
        created_at: Date.now()
      });
    }

    return invite.household_id;
  }

  // RLS Simulation on meal_entries
  selectMealEntries(userId, targetHousehold) {
    if (!this.isHouseholdMember(targetHousehold, userId)) {
      // RLS filters out rows where is_household_member is false
      return [];
    }
    return this.mealEntries.filter(m => m.household_id === targetHousehold);
  }

  insertMealEntry(userId, entry) {
    // WITH CHECK (is_household_member(household_id))
    if (!this.isHouseholdMember(entry.household_id, userId)) {
      throw new Error('RLS check failure: is_household_member violation on INSERT');
    }
    this.mealEntries.push(entry);
    return entry;
  }

  mutateMealEntry(userId, entryId, newTitle) {
    const entry = this.mealEntries.find(m => m.id === entryId);
    if (!entry) return null;
    // USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id))
    if (!this.isHouseholdMember(entry.household_id, userId)) {
      throw new Error('RLS check failure: is_household_member violation on UPDATE');
    }
    entry.title = newTitle;
    return entry;
  }

  deleteMealEntry(userId, entryId) {
    const idx = this.mealEntries.findIndex(m => m.id === entryId);
    if (idx === -1) return false;
    const entry = this.mealEntries[idx];
    // USING (is_household_member(household_id))
    if (!this.isHouseholdMember(entry.household_id, userId)) {
      throw new Error('RLS check failure: is_household_member violation on DELETE');
    }
    this.mealEntries.splice(idx, 1);
    return true;
  }
}

test('SCENARIO A & B: independent anonymous identities A & B receive isolated distinct households', () => {
  const db = new MockDatabase();
  const identityA = crypto.randomUUID();
  const identityB = crypto.randomUUID();

  const householdA = db.bootstrapHousehold(identityA);
  const householdB = db.bootstrapHousehold(identityB);

  assert.ok(householdA, 'Household A must be created');
  assert.ok(householdB, 'Household B must be created');
  assert.notEqual(householdA, householdB, 'Anonymous A and Anonymous B MUST NOT share a household');

  // Calling bootstrap again returns their same assigned household
  assert.equal(db.bootstrapHousehold(identityA), householdA);
  assert.equal(db.bootstrapHousehold(identityB), householdB);
});

test('SCENARIO C: Identity A cannot read Identity B household data via RLS', () => {
  const db = new MockDatabase();
  const identityA = crypto.randomUUID();
  const identityB = crypto.randomUUID();

  const householdA = db.bootstrapHousehold(identityA);
  const householdB = db.bootstrapHousehold(identityB);

  // B creates meal entries
  db.insertMealEntry(identityB, {
    id: 'meal-b-1',
    household_id: householdB,
    meal_date: '2026-09-12',
    slot: 'Dinner',
    title: 'Secret Family Recipe'
  });

  // A attempts to SELECT B's meal entries
  const resultsForA = db.selectMealEntries(identityA, householdB);
  assert.equal(resultsForA.length, 0, 'Identity A must receive 0 rows when attempting to select B household data');

  // B can read their own entries
  const resultsForB = db.selectMealEntries(identityB, householdB);
  assert.equal(resultsForB.length, 1);
  assert.equal(resultsForB[0].title, 'Secret Family Recipe');
});

test('SCENARIO D & E: cross-household mutation (INSERT, UPDATE, DELETE) is blocked in both directions', () => {
  const db = new MockDatabase();
  const identityA = crypto.randomUUID();
  const identityB = crypto.randomUUID();

  const householdA = db.bootstrapHousehold(identityA);
  const householdB = db.bootstrapHousehold(identityB);

  const entryB = {
    id: 'meal-b-2',
    household_id: householdB,
    meal_date: '2026-09-12',
    slot: 'Lunch',
    title: 'Pithla Bhakri'
  };
  db.insertMealEntry(identityB, entryB);

  // D: A cannot insert into B
  assert.throws(
    () => db.insertMealEntry(identityA, { id: 'malicious-a', household_id: householdB, title: 'Injected' }),
    /RLS check failure/,
    'A cannot INSERT into household B'
  );

  // D: A cannot update B
  assert.throws(
    () => db.mutateMealEntry(identityA, 'meal-b-2', 'Tampered'),
    /RLS check failure/,
    'A cannot UPDATE household B'
  );

  // D: A cannot delete B
  assert.throws(
    () => db.deleteMealEntry(identityA, 'meal-b-2'),
    /RLS check failure/,
    'A cannot DELETE from household B'
  );

  // E: Symmetrical test: B cannot mutate A
  const entryA = {
    id: 'meal-a-1',
    household_id: householdA,
    meal_date: '2026-09-12',
    slot: 'Breakfast',
    title: 'Kande Pohe'
  };
  db.insertMealEntry(identityA, entryA);

  assert.throws(
    () => db.insertMealEntry(identityB, { id: 'malicious-b', household_id: householdA, title: 'Injected' }),
    /RLS check failure/,
    'B cannot INSERT into household A'
  );
  assert.throws(
    () => db.mutateMealEntry(identityB, 'meal-a-1', 'Tampered'),
    /RLS check failure/,
    'B cannot UPDATE household A'
  );
  assert.throws(
    () => db.deleteMealEntry(identityB, 'meal-a-1'),
    /RLS check failure/,
    'B cannot DELETE from household A'
  );
});

test('SCENARIO F: legitimate explicit family join succeeds via invite token', () => {
  const db = new MockDatabase();
  const identityA = crypto.randomUUID(); // Family device 1
  const identityB = crypto.randomUUID(); // Family device 2

  const householdA = db.bootstrapHousehold(identityA);

  // Device 1 creates an invite token
  const { token } = db.createHouseholdInvite(identityA, householdA, 48, 5);
  assert.ok(token.startsWith('KB-'), 'Invite token should have friendly prefix');

  // Device 2 joins using the token
  const joinedHousehold = db.joinHousehold(identityB, token);
  assert.equal(joinedHousehold, householdA, 'Device 2 should join Household A');

  // Device 2 is now an authorized member
  assert.ok(db.isHouseholdMember(householdA, identityB), 'Device 2 must now be member of Household A');

  // Device 2 can now read and write to Household A
  const entry = {
    id: 'meal-shared-1',
    household_id: householdA,
    meal_date: '2026-09-13',
    slot: 'Dinner',
    title: 'Shared Family Meal'
  };
  assert.doesNotThrow(() => db.insertMealEntry(identityB, entry));
  assert.equal(db.selectMealEntries(identityB, householdA).length, 1);
});

test('SCENARIO G: invalid, expired, revoked, or exhausted invite credentials fail safely', () => {
  const db = new MockDatabase();
  const identityA = crypto.randomUUID();
  const identityStranger = crypto.randomUUID();

  const householdA = db.bootstrapHousehold(identityA);

  // 1. Invalid token
  assert.throws(
    () => db.joinHousehold(identityStranger, 'KB-FAKE-CODE'),
    /invalid_or_expired_invite/,
    'Fake token must fail'
  );

  // 2. Expired token
  const inviteObj = db.createHouseholdInvite(identityA, householdA, 48, 2);
  const storedInvite = db.householdInvites.find(inv => inv.household_id === householdA);
  storedInvite.expires_at = Date.now() - 1000; // Force expired
  assert.throws(
    () => db.joinHousehold(identityStranger, inviteObj.token),
    /invalid_or_expired_invite/,
    'Expired token must fail'
  );

  // 3. Revoked token
  storedInvite.expires_at = Date.now() + 3600000;
  storedInvite.revoked = true;
  assert.throws(
    () => db.joinHousehold(identityStranger, inviteObj.token),
    /invalid_or_expired_invite/,
    'Revoked token must fail'
  );

  // 4. Max uses exhausted
  storedInvite.revoked = false;
  storedInvite.use_count = storedInvite.max_uses;
  assert.throws(
    () => db.joinHousehold(identityStranger, inviteObj.token),
    /invalid_or_expired_invite/,
    'Exhausted token must fail'
  );
});

test('SCENARIO H: target household ID alone cannot bypass authorization or create invites', () => {
  const db = new MockDatabase();
  const identityA = crypto.randomUUID();
  const identityAttacker = crypto.randomUUID();

  const householdA = db.bootstrapHousehold(identityA);

  // Attacker cannot create an invite for household A without being a member
  assert.throws(
    () => db.createHouseholdInvite(identityAttacker, householdA),
    /unauthorized/,
    'Attacker cannot create invite for household they do not belong to'
  );

  // Attacker cannot read or insert even if they know householdA UUID
  assert.equal(db.selectMealEntries(identityAttacker, householdA).length, 0);
  assert.throws(
    () => db.insertMealEntry(identityAttacker, { id: 'attack-1', household_id: householdA, title: 'Injected' }),
    /RLS check failure/
  );
});
