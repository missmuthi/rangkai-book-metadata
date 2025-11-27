# Quick Fix Reference: Menu Navigation

**Problem:** Menu items don't work in production  
**Solution:** Z-index fix (3 lines)  
**Time to fix:** 5 minutes

---

## 🔧 The Fix

### src/routes/+layout.svelte

**Line ~58: Backdrop**

```diff
- <button class="fixed inset-0 z-40" onclick={closeUserMenu}>
+ <div class="fixed inset-0 z-20" onclick={closeUserMenu} role="button" tabindex="-1">
```

**Line ~68: Header**

```diff
- <header class="... z-30 ...">
+ <header class="... z-50 ...">
```

**Line ~114: Dropdown**

```diff
- <div class="... z-50">
+ <div class="... z-[100]">
```

---

## 📊 Z-Index Hierarchy

```
100 → Dropdown menu (clicks work here)
 50 → Header
 20 → Backdrop (only catches outside clicks)
```

---

## ✅ Verify Fix

1. Build: `npm run build`
2. Test locally:
   - Click avatar → menu opens
   - Click "Dashboard" → navigates to /dashboard ✅
   - Click "History" → navigates to /history ✅
   - Click "Sign Out" → logs out ✅

---

## 📦 Deploy

```bash
git add src/routes/+layout.svelte
git commit -m "fix: menu navigation z-index (MENU-NAV-PROD-001)"
git push origin main
```

---

## 🎯 Quick Test (Production)

1. Login
2. Click your name
3. Click "Dashboard" → Should navigate ✅
4. If still broken → Rollback immediately

---

## 🚨 Rollback (if needed)

```bash
git revert HEAD
git push origin main
```

**Or in Cloudflare dashboard:**  
Deployments → Previous deployment → Rollback

---

## 📚 Full Docs

- `PRODUCTION_MENU_FIX.md` - Complete analysis
- `MENU_FIX_VISUAL.md` - Visual diagrams
- `DEPLOYMENT_CHECKLIST_MENU_FIX.md` - Full checklist
- `PRODUCTION_BUG_FIX_SUMMARY.md` - Executive summary
