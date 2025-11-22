#!/bin/bash
# Tier 3 Architecture Validation Script
# Validates UX polish, error handling, logging, and developer experience

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 TIER 3 ARCHITECTURE VALIDATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: UI Component Library
echo "✅ Checking UI component library..."
[ -d "src/lib/components/ui" ] && echo "   ✓ UI components directory exists" || echo "   ✗ UI directory missing"
[ -f "src/lib/components/ui/index.ts" ] && echo "   ✓ UI barrel export exists" || echo "   ✗ UI barrel missing"

if [ -f "src/lib/components/ui/Button.svelte" ]; then
  echo "   ✓ Button component exists"
  grep -q "variant" src/lib/components/ui/Button.svelte && echo "   ✓ Button has variants"
else
  echo "   ✗ Button component missing"
fi

if [ -f "src/lib/components/ui/Card.svelte" ]; then
  echo "   ✓ Card component exists"
  grep -q "interactive" src/lib/components/ui/Card.svelte && echo "   ✓ Card supports interactive mode"
else
  echo "   ✗ Card component missing"
fi

[ -f "src/lib/components/ui/Alert.svelte" ] && echo "   ✓ Alert component exists" || echo "   ✗ Alert missing"
[ -f "src/lib/components/ui/EmptyState.svelte" ] && echo "   ✓ EmptyState component exists" || echo "   ✗ EmptyState missing"
[ -f "src/lib/components/ui/Input.svelte" ] && echo "   ✓ Input component exists" || echo "   ✗ Input missing"
[ -f "src/lib/components/ui/Badge.svelte" ] && echo "   ✓ Badge component exists" || echo "   ✗ Badge missing"
[ -f "src/lib/components/ui/Skeleton.svelte" ] && echo "   ✓ Skeleton component exists" || echo "   ✗ Skeleton missing"
echo ""

# Check 2: Error Handling
echo "✅ Checking error handling..."
if [ -f "src/routes/+error.svelte" ]; then
  echo "   ✓ Global error page exists"
  grep -q "requestId" src/routes/+error.svelte && echo "   ✓ Error page includes request ID"
  grep -q "friendly" src/routes/+error.svelte && echo "   ✓ Error page has user-friendly messages"
else
  echo "   ✗ Global error page missing"
fi
echo ""

# Check 3: Logging System
echo "✅ Checking logging system..."
if [ -f "src/lib/server/log.ts" ]; then
  echo "   ✓ Logging module exists"
  grep -q "export const logger" src/lib/server/log.ts && echo "   ✓ Logger instance exists"
  grep -q "LogEvents" src/lib/server/log.ts && echo "   ✓ Log events enum exists"
  grep -q "sanitizeContext" src/lib/server/log.ts && echo "   ✓ Sensitive data sanitization exists"
  grep -q "generateRequestId" src/lib/server/log.ts && echo "   ✓ Request ID generation exists"
else
  echo "   ✗ Logging module missing"
fi

# Check if logging is used in server code
if grep -q "import.*logger.*from.*log" src/lib/server/auth.ts; then
  echo "   ✓ Auth uses structured logging"
else
  echo "   ⚠️  Auth not using structured logging"
fi

if grep -q "import.*logger.*from.*log" src/lib/server/metadata/sources/google-books.ts; then
  echo "   ✓ Google Books uses structured logging"
else
  echo "   ⚠️  Google Books not using structured logging"
fi

if grep -q "import.*logger.*from.*log" src/lib/server/metadata/sources/openlibrary.ts; then
  echo "   ✓ OpenLibrary uses structured logging"
else
  echo "   ⚠️  OpenLibrary not using structured logging"
fi
echo ""

# Check 4: UI Refactoring
echo "✅ Checking UI refactoring..."
if [ -f "src/routes/dashboard/+page.svelte" ]; then
  if grep -q "from '\$lib/components/ui'" src/routes/dashboard/+page.svelte; then
    echo "   ✓ Dashboard uses UI primitives"
  else
    echo "   ⚠️  Dashboard not fully refactored"
  fi
else
  echo "   ⚠️  Dashboard page not found"
fi

if [ -f "src/routes/history/+page.svelte" ]; then
  if grep -q "from '\$lib/components/ui'" src/routes/history/+page.svelte; then
    echo "   ✓ History uses UI primitives"
  else
    echo "   ⚠️  History not fully refactored"
  fi
else
  echo "   ⚠️  History page not found"
fi
echo ""

# Check 5: Developer Experience
echo "✅ Checking developer experience..."
[ -f "validate-all.sh" ] && echo "   ✓ Unified validation script exists"
[ -f "CONTRIBUTING.md" ] && echo "   ✓ Contributing guide exists"
[ -f ".eslintrc.json" ] && echo "   ✓ ESLint config exists"

if grep -q "\"validate\"" package.json; then
  echo "   ✓ npm run validate script exists"
else
  echo "   ⚠️  validate script not in package.json"
fi

if grep -q "\"lint\"" package.json; then
  echo "   ✓ npm run lint script exists"
else
  echo "   ⚠️  lint script not in package.json"
fi
echo ""

# Check 6: TypeScript strictness
echo "✅ Checking TypeScript configuration..."
if grep -q '"strict": true' tsconfig.json; then
  echo "   ✓ TypeScript strict mode enabled"
else
  echo "   ⚠️  TypeScript strict mode not enabled"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TIER 3 VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
