#!/bin/bash
# Tier 1 Architecture Validation Script

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TIER 1 ARCHITECTURE VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Auth helpers exist
echo "✅ Checking auth helpers..."
if [ -f "src/lib/server/auth.ts" ]; then
  grep -q "requireSession" src/lib/server/auth.ts && echo "   ✓ requireSession exists"
  grep -q "getSession" src/lib/server/auth.ts && echo "   ✓ getSession exists"
  grep -q "requireOwnership" src/lib/server/auth.ts && echo "   ✓ requireOwnership exists"
else
  echo "   ✗ auth.ts not found"
fi
echo ""

# Check 2: DB helpers exist
echo "✅ Checking database helpers..."
if [ -f "src/lib/server/db.ts" ]; then
  grep -q "getUserScans" src/lib/server/db.ts && echo "   ✓ getUserScans exists"
  grep -q "createScan" src/lib/server/db.ts && echo "   ✓ createScan exists"
  grep -q "getDB" src/lib/server/db.ts && echo "   ✓ getDB exists"
else
  echo "   ✗ db.ts not found"
fi
echo ""

# Check 3: Cache helpers exist
echo "✅ Checking cache helpers..."
if [ -f "src/lib/server/cache.ts" ]; then
  grep -q "cacheGet" src/lib/server/cache.ts && echo "   ✓ cacheGet exists"
  grep -q "cacheSet" src/lib/server/cache.ts && echo "   ✓ cacheSet exists"
  grep -q "CacheKeys" src/lib/server/cache.ts && echo "   ✓ CacheKeys exists"
else
  echo "   ✗ cache.ts not found"
fi
echo ""

# Check 4: Metadata engine exists
echo "✅ Checking metadata engine..."
if [ -f "src/lib/server/metadata/index.ts" ]; then
  grep -q "fetchBookByIsbn" src/lib/server/metadata/index.ts && echo "   ✓ fetchBookByIsbn exists"
  grep -q "searchBooksByTitle" src/lib/server/metadata/index.ts && echo "   ✓ searchBooksByTitle exists"
else
  echo "   ✗ metadata/index.ts not found"
fi
echo ""

# Check 5: Routes use helpers
echo "✅ Checking routes use helpers (not inline SQL)..."
if grep -q "requireSession" src/routes/history/+page.server.ts; then
  echo "   ✓ history uses requireSession"
else
  echo "   ✗ history doesn't use requireSession"
fi

if grep -q "getUserScans" src/routes/history/+page.server.ts; then
  echo "   ✓ history uses getUserScans"
else
  echo "   ✗ history uses inline SQL"
fi

if grep -q "requireSession" src/routes/dashboard/+page.server.ts; then
  echo "   ✓ dashboard uses requireSession"
else
  echo "   ✗ dashboard doesn't use requireSession"
fi
echo ""

# Check 6: TypeScript check
echo "✅ Running TypeScript validation..."
npm run check 2>&1 | grep -q "found 0 errors" && echo "   ✓ TypeScript check passed" || echo "   ✗ TypeScript errors found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TIER 1 VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
