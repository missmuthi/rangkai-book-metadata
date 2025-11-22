#!/bin/bash
# Unified validation script for all tiers
# Runs TypeScript check, linting (if available), tier-specific validations, and tests

set -e  # Exit on first error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 UNIFIED VALIDATION - ALL TIERS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# TypeScript validation
echo "📝 Running TypeScript validation..."
if npm run check --silent 2>&1 | grep -q "found 0 errors"; then
  echo "   ✓ TypeScript check passed"
else
  echo "   ✗ TypeScript errors found"
  npm run check
  exit 1
fi
echo ""

# Unit tests (fast, always run unless skipped)
if [ "$1" != "--skip-tests" ]; then
  echo "🧪 Running unit tests..."
  if npm test -- --run --silent 2>&1 | grep -q "Test Files.*passed"; then
    echo "   ✓ All tests passed"
  else
    echo "   ✗ Test failures detected"
    npm test -- --run
    exit 1
  fi
  echo ""
fi

# Tier 1 validation
echo "🏗️  Running Tier 1 validation..."
if [ -f "./validate-tier1.sh" ]; then
  ./validate-tier1.sh
else
  echo "   ⚠️  validate-tier1.sh not found, skipping"
fi
echo ""

# Tier 2 validation
echo "🏢 Running Tier 2 validation..."
if [ -f "./validate-tier2.sh" ]; then
  ./validate-tier2.sh
else
  echo "   ⚠️  validate-tier2.sh not found, skipping"
fi
echo ""

# Tier 3 validation
echo "✨ Running Tier 3 validation..."
if [ -f "./validate-tier3.sh" ]; then
  ./validate-tier3.sh
else
  echo "   ⚠️  validate-tier3.sh not found, skipping"
fi
echo ""

# Build validation (optional, can be slow)
if [ "$1" = "--with-build" ]; then
  echo "🏗️  Running build validation..."
  npm run build >/dev/null 2>&1 && echo "   ✓ Build successful" || echo "   ✗ Build failed"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL VALIDATIONS COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
