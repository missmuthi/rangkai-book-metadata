#!/bin/bash
# Tier 2 Architecture Validation Script

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TIER 2 ARCHITECTURE VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: Module structure exists
echo "✅ Checking module structure..."
[ -d "src/modules/scan" ] && echo "   ✓ scan module exists"
[ -d "src/modules/dashboard" ] && echo "   ✓ dashboard module exists"
[ -d "src/modules/auth" ] && echo "   ✓ auth module exists"
[ -f "src/modules/index.ts" ] && echo "   ✓ modules barrel export exists"
echo ""

# Check 2: Scan module functions
echo "✅ Checking scan module..."
if [ -f "src/modules/scan/service.ts" ]; then
  grep -q "createBookScan" src/modules/scan/service.ts && echo "   ✓ createBookScan exists"
  grep -q "getScanHistory" src/modules/scan/service.ts && echo "   ✓ getScanHistory exists"
  grep -q "validateISBN" src/modules/scan/service.ts && echo "   ✓ validateISBN exists"
  grep -q "batchCreateScans" src/modules/scan/service.ts && echo "   ✓ batchCreateScans exists"
else
  echo "   ✗ scan/service.ts not found"
fi
echo ""

# Check 3: Dashboard module functions
echo "✅ Checking dashboard module..."
if [ -f "src/modules/dashboard/service.ts" ]; then
  grep -q "getDashboardData" src/modules/dashboard/service.ts && echo "   ✓ getDashboardData exists"
  grep -q "getActivitySummary" src/modules/dashboard/service.ts && echo "   ✓ getActivitySummary exists"
  grep -q "getScanTrends" src/modules/dashboard/service.ts && echo "   ✓ getScanTrends exists"
else
  echo "   ✗ dashboard/service.ts not found"
fi
echo ""

# Check 4: Auth module functions
echo "✅ Checking auth module..."
if [ -f "src/modules/auth/service.ts" ]; then
  grep -q "requireAdmin" src/modules/auth/service.ts && echo "   ✓ requireAdmin exists"
  grep -q "getSessionOptional" src/modules/auth/service.ts && echo "   ✓ getSessionOptional exists"
  grep -q "isAuthenticated" src/modules/auth/service.ts && echo "   ✓ isAuthenticated exists"
else
  echo "   ✗ auth/service.ts not found"
fi
echo ""

# Check 5: Routes use modules
echo "✅ Checking routes use modules..."
if grep -q "from '\$modules" src/routes/dashboard/+page.server.ts; then
  echo "   ✓ dashboard uses modules"
else
  echo "   ✗ dashboard doesn't use modules"
fi

if grep -q "from '\$modules" src/routes/history/+page.server.ts; then
  echo "   ✓ history uses modules"
else
  echo "   ✗ history doesn't use modules"
fi
echo ""

# Check 6: New API endpoints
echo "✅ Checking new API endpoints..."
[ -f "src/routes/api/scan/+server.ts" ] && echo "   ✓ /api/scan endpoint exists"
[ -f "src/routes/api/dashboard/stats/+server.ts" ] && echo "   ✓ /api/dashboard/stats endpoint exists"
echo ""

# Check 7: Path aliases configured
echo "✅ Checking path aliases..."
if grep -q "\$modules" svelte.config.js; then
  echo "   ✓ \$modules alias configured"
else
  echo "   ✗ \$modules alias not found"
fi
echo ""

# Check 8: TypeScript check
echo "✅ Running TypeScript validation..."
npm run check 2>&1 | grep -q "found 0 errors" && echo "   ✓ TypeScript check passed" || echo "   ✗ TypeScript errors found"
echo ""

# Check 9: Build check
echo "✅ Running build validation..."
npm run build >/dev/null 2>&1 && echo "   ✓ Build successful" || echo "   ✗ Build failed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TIER 2 VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
