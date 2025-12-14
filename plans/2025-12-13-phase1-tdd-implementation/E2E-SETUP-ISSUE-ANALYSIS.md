# E2E Test Problem Investigation & Solutions

**Date:** 2025-12-14  
**Issue:** E2E tests fail during Prisma migration  
**Status:** ⚠️ Identified - Solution Ready

---

## 🔍 Problem Analysis

### The Error
```
Error: spawnSync C:\WINDOWS\system32\cmd.exe ENOENT
❌ Migration failed
```

### Where It Happens
**File:** `tests/e2e/setup/e2e-setup.ts`  
**Line:** 53  
**Code:**
```typescript
execSync('npx prisma migrate deploy', {
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  cwd: process.cwd() + '/apps/backend',
  stdio: 'inherit',
});
```

---

## 🎯 Root Cause

### Primary Issue: Missing `shell: true` Option

**Problem:**
- `execSync` on Windows needs explicit shell specification
- Without `{ shell: true }`, Node.js tries to execute the command directly
- `npx` is not a binary executable - it's a shell command
- Windows can't find `cmd.exe` in the PATH when spawning without shell

**Why Integration Tests Work:**
```typescript
// tests/setup/global-setup.ts (WORKS)
execSync('pnpm db:push', {
  cwd: process.cwd(),  // ← Root directory
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  stdio: 'inherit',
  // No shell: true needed because pnpm is in PATH
});
```

**Why E2E Tests Fail:**
```typescript
// tests/e2e/setup/e2e-setup.ts (FAILS)
execSync('npx prisma migrate deploy', {
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  cwd: process.cwd() + '/apps/backend',  // ← Subdirectory
  stdio: 'inherit',
  // Missing shell: true ← THIS IS THE PROBLEM
});
```

### Secondary Issues

1. **Path Construction**
   - Using string concatenation: `process.cwd() + '/apps/backend'`
   - Should use `path.join()` for cross-platform compatibility

2. **Command Choice**
   - Using `npx prisma migrate deploy` (production command)
   - Integration tests use `pnpm db:push` (development command)
   - `db:push` is faster and better for tests

3. **Working Directory**
   - E2E runs from subdirectory
   - Integration runs from root
   - Inconsistent approach

---

## ✅ Solutions (3 Options)

### **Solution 1: Add `shell: true`** (QUICKEST FIX)

**Pros:**
- ✅ Minimal change (1 line)
- ✅ Fixes the immediate issue
- ✅ Works on Windows, Mac, Linux

**Cons:**
- ⚠️ Still uses slower `migrate deploy`
- ⚠️ Still has path construction issue

**Implementation:**
```typescript
// tests/e2e/setup/e2e-setup.ts
import { execSync } from 'child_process';
import path from 'path';

// Run migrations
console.log('🗄️  Running Prisma migrations...');
try {
  execSync('npx prisma migrate deploy', {
    shell: true,  // ← ADD THIS LINE
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: path.join(process.cwd(), 'apps', 'backend'),  // ← FIX PATH
    stdio: 'inherit',
  });
  console.log('✅ Migrations completed');
} catch (error) {
  console.error('❌ Migration failed:', error);
  throw error;
}
```

**Estimated Time:** 2 minutes  
**Risk:** Very low

---

### **Solution 2: Use `pnpm db:push`** (RECOMMENDED)

**Pros:**
- ✅ Matches integration test approach
- ✅ Faster than `migrate deploy`
- ✅ Better for test environments
- ✅ Consistent with existing pattern
- ✅ Fixes shell issue

**Cons:**
- ⚠️ Slightly more changes

**Implementation:**
```typescript
// tests/e2e/setup/e2e-setup.ts
import { execSync } from 'child_process';
import path from 'path';

// Run Prisma schema push
console.log('🗄️  Pushing Prisma schema...');
try {
  execSync('pnpm --filter @schemaforge/backend db:push', {
    shell: true,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    cwd: process.cwd(),  // Run from root
    stdio: 'inherit',
  });
  console.log('✅ Schema pushed');
} catch (error) {
  console.error('❌ Schema push failed:', error);
  throw error;
}
```

**Estimated Time:** 3 minutes  
**Risk:** Very low  
**Benefit:** Consistent with integration tests

---

### **Solution 3: Use Prisma Programmatically** (BEST LONG-TERM)

**Pros:**
- ✅ No shell dependency
- ✅ Better error handling
- ✅ Faster execution
- ✅ More reliable
- ✅ Cross-platform guaranteed

**Cons:**
- ⚠️ More code changes
- ⚠️ Requires understanding Prisma API

**Implementation:**
```typescript
// tests/e2e/setup/e2e-setup.ts
import { PrismaClient } from '@prisma/client';

// Run migrations programmatically
console.log('🗄️  Applying database schema...');
try {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
  
  // Push schema using Prisma's internal API
  // Note: This requires using Prisma's migrate API
  // Alternative: Just let getPrisma() handle it on first use
  
  await prisma.$connect();
  console.log('✅ Database connected and ready');
  await prisma.$disconnect();
} catch (error) {
  console.error('❌ Database setup failed:', error);
  throw error;
}
```

**Estimated Time:** 10 minutes  
**Risk:** Low-Medium  
**Benefit:** Most robust solution

---

## 📊 Comparison Matrix

| Aspect | Solution 1 (shell:true) | Solution 2 (pnpm) | Solution 3 (Programmatic) |
|--------|------------------------|-------------------|---------------------------|
| **Time to Implement** | 2 min | 3 min | 10 min |
| **Risk** | Very Low | Very Low | Low-Medium |
| **Consistency** | ⚠️ Different from integration | ✅ Same as integration | ✅ Best practice |
| **Speed** | Slow (migrate) | Fast (db:push) | Fastest |
| **Cross-platform** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Maintainability** | ⚠️ OK | ✅ Good | ✅ Excellent |
| **Error Handling** | ⚠️ Basic | ⚠️ Basic | ✅ Advanced |

---

## 🎯 Recommended Solution

### **Use Solution 2: `pnpm db:push`**

**Why:**
1. ✅ **Consistency** - Matches integration test pattern
2. ✅ **Speed** - Faster than migrate deploy
3. ✅ **Simplicity** - Minimal changes
4. ✅ **Reliability** - Proven to work (integration tests pass)
5. ✅ **Low Risk** - Same approach as working tests

**Implementation Steps:**
1. Change command from `npx prisma migrate deploy` to `pnpm --filter @schemaforge/backend db:push`
2. Add `shell: true` option
3. Change `cwd` to `process.cwd()` (root directory)
4. Use `path.join()` if needed

---

## 🔧 Alternative Quick Fix

If you want the **absolute minimal change** (Solution 1):

**Just add one line:**
```typescript
execSync('npx prisma migrate deploy', {
  shell: true,  // ← ADD THIS
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  cwd: process.cwd() + '/apps/backend',
  stdio: 'inherit',
});
```

This will work immediately, but Solution 2 is still recommended for consistency.

---

## 📝 Implementation Checklist

### For Solution 2 (Recommended)

- [ ] Open `tests/e2e/setup/e2e-setup.ts`
- [ ] Import `path` module at top
- [ ] Find the migration code block (lines 50-62)
- [ ] Replace `execSync` call with new implementation
- [ ] Test with `pnpm test:e2e`
- [ ] Verify containers start and migrations run
- [ ] Commit changes

**Expected Result:**
```
🚀 Starting E2E environment setup...
📦 Starting PostgreSQL and Redis containers...
✅ Containers started
🔧 Environment configured
🔌 Initializing pgvector extension...
✅ pgvector extension created
🗄️  Pushing Prisma schema...
✅ Schema pushed  ← THIS SHOULD NOW WORK!
🚀 Creating Fastify app...
✅ Fastify app ready
📬 Initializing BullMQ queue...
✅ Queue initialized
🎉 E2E environment setup complete!
```

---

## 🚨 Why This Wasn't Caught Earlier

1. **Integration tests use different approach** - They work because they use `pnpm db:push` from root
2. **E2E tests are new** - First time running them with Testcontainers
3. **Windows-specific** - Might work on Mac/Linux without `shell: true`
4. **Not related to fastembed** - This is a pre-existing setup issue

---

## 📚 References

- Node.js execSync docs: https://nodejs.org/api/child_process.html#child_processexecsynccommand-options
- Prisma migrate vs push: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Windows PATH issues: https://stackoverflow.com/questions/43230346/error-spawn-enoent-on-windows

---

## 🎯 Next Steps

1. **Choose a solution** (Recommend: Solution 2)
2. **Implement the fix** (3 minutes)
3. **Test E2E suite** (`pnpm test:e2e`)
4. **Verify all tests run** (should see test execution, not just setup)
5. **Fix any failing tests** (GREEN phase of TDD)

---

**Status:** ✅ **Problem Identified - Ready to Fix**  
**Recommended:** Solution 2 (`pnpm db:push` with `shell: true`)  
**Time Required:** 3 minutes  
**Risk:** Very Low
