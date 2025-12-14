# Task 1.1: Debug 500 Errors - COMPLETE ✅

**Date:** 2025-12-14  
**Status:** ✅ Root cause identified  
**Time Spent:** 30 minutes

---

## 🔍 Investigation Summary

### **What We Did**
1. Added comprehensive logging to upload route
2. Wrapped entire route in try-catch
3. Ran single E2E test to capture logs
4. Analyzed error output

---

## 💥 Root Cause Found

### **The Error**
```
❌ File save error: Error: EEXIST: file already exists, open
'D:\tmp\uploads\806a497a4ccd4e94106959af3851f231'
```

### **What's Happening**
1. **Test 1 runs:** Uploads `test.pdf` → MD5: `806a...` → Saves file → Creates DB record ✅
2. **Test 2 runs:** Uploads same `test.pdf` → MD5: `806a...` (same hash)
3. **Database check:** No duplicate found ✅ (test cleanup cleared DB)
4. **File save:** **FAILS** ❌ (file still exists on disk from test 1)
5. **Result:** 500 error returned

### **Why This Happens**
- E2E tests use the same PDF fixture file
- Each test generates the same MD5 hash
- Test cleanup clears database but **NOT the upload directory**
- File exists on disk but not in database
- `writeFile` with `wx` flag fails on existing files

---

## 📊 Detailed Flow

### **Expected Flow (First Upload)**
```
Upload PDF
  ↓
Calculate MD5: 806a...
  ↓
Check DB: Not found ✅
  ↓
Save file: /tmp/uploads/806a... ✅
  ↓
Create DB record ✅
  ↓
Return 201 ✅
```

### **Actual Flow (Second Upload - Same File)**
```
Upload PDF
  ↓
Calculate MD5: 806a... (same)
  ↓
Check DB: Not found ✅ (DB was cleared)
  ↓
Save file: /tmp/uploads/806a... ❌ EEXIST!
  ↓
Return 500 ❌
```

---

## 🎯 Issues Identified

### **Issue 1: File Cleanup Not Happening**
**Problem:** Test cleanup clears database but not upload directory  
**Impact:** Files persist between tests  
**Severity:** 🔴 Critical

### **Issue 2: EEXIST Handling is Wrong**
**Problem:** Code returns 500 for EEXIST, treating it as "hash collision"  
**Reality:** It's a normal case when file exists but DB record doesn't  
**Severity:** 🟡 High

### **Issue 3: No File Cleanup on DB Failure**
**Problem:** If DB insert fails, file cleanup happens  
**Problem:** If file save fails, no cleanup needed (file doesn't exist yet)  
**But:** If file exists and DB doesn't, we have orphaned files  
**Severity:** 🟢 Medium

---

## 🔧 Solutions Required

### **Solution 1: Fix File Save Logic** (Immediate)
**Change the `wx` flag behavior:**

**Current Code:**
```typescript
await writeFile(filePath, buffer, { flag: 'wx' }); // Fails if exists
```

**Better Approach:**
```typescript
// Check if file exists first
const fileExists = await access(filePath).then(() => true).catch(() => false);

if (fileExists) {
  // File exists but not in DB - orphaned file
  // Option A: Reuse it (if MD5 matches, it's the same file)
  console.log('⚠️ Reusing existing file (orphaned)');
} else {
  // Save new file
  await writeFile(filePath, buffer);
}
```

**Or simpler:**
```typescript
// Just overwrite - if MD5 is same, content is same
await writeFile(filePath, buffer); // No 'wx' flag
```

### **Solution 2: Add File Cleanup to E2E Setup** (Better long-term)
**Add to `tests/e2e/setup/e2e-setup.ts`:**

```typescript
export async function teardownE2E() {
  // Clean up upload directory
  const uploadDir = process.env.UPLOAD_DIR || '/tmp/uploads';
  await rm(uploadDir, { recursive: true, force: true });
  
  // Stop containers
  await postgresContainer.stop();
  await redisContainer.stop();
}
```

### **Solution 3: Use Unique Upload Dir Per Test** (Best)
**Set unique upload dir in E2E setup:**

```typescript
process.env.UPLOAD_DIR = `/tmp/e2e-uploads-${Date.now()}`;
```

Then cleanup after all tests.

---

## 📝 Logging Output Analysis

### **Successful Steps** ✅
```
📤 Upload request received
📄 File details: { filename: 'test.pdf', mimeType: 'application/pdf', size: 42811 }
✅ Format detected: pdf
🔐 Calculating MD5 hash...
✅ MD5 hash: 806a497a4ccd4e94106959af3851f231
🔍 Checking for duplicates...
(No duplicate found)
🛣️ Processing lane: heavy
💾 Saving file to disk: \tmp\uploads\806a497a4ccd4e94106959af3851f231
```

### **Failure Point** ❌
```
❌ File save error: Error: EEXIST: file already exists
```

### **What Didn't Run**
- ❌ Document creation
- ❌ Queue addition
- ❌ Success response

---

## 🎯 Recommended Fix (Immediate)

### **Quick Fix: Remove 'wx' Flag**

**File:** `apps/backend/src/routes/documents/upload-route.ts`  
**Line:** ~98

**Change:**
```typescript
// OLD:
await writeFile(filePath, buffer, { flag: 'wx' }); // Fails if exists

// NEW:
await writeFile(filePath, buffer); // Overwrite if exists
```

**Rationale:**
- If MD5 hash is the same, file content is identical
- Safe to overwrite
- Handles orphaned files gracefully
- Simpler code

**Remove the EEXIST error handling:**
```typescript
// REMOVE THIS:
if (error.code === 'EEXIST') {
  return reply.status(500).send({
    error: 'STORAGE_ERROR',
    message: 'File already exists on disk (hash collision)',
  });
}
```

---

## ✅ Task 1.1 Complete

### **Achievements**
- ✅ Added comprehensive logging
- ✅ Identified root cause (EEXIST error)
- ✅ Understood the flow
- ✅ Proposed solutions

### **Next Steps**
- ⏳ Task 1.2: Implement the fix
- ⏳ Task 1.3: Add file cleanup to E2E setup
- ⏳ Task 1.4: Test the fix

---

**Status:** ✅ **COMPLETE**  
**Root Cause:** File exists on disk but not in DB (orphaned from previous test)  
**Solution:** Remove 'wx' flag, allow file overwrite  
**Time:** 30 minutes  
**Next:** Implement fix in Task 1.2
