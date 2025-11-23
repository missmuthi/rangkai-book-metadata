#!/bin/bash
set -e

echo "🚀 Starting documentation migration..."

# Move to /docs
echo "📁 Moving core documentation..."
git mv ANALYTICS_TELEMETRY.md docs/
git mv PERFORMANCE_ANALYSIS.md docs/PERFORMANCE.md

# Move to /docs/meta
echo "🤖 Moving meta documentation..."
git mv copilot-instruction.md docs/meta/COPILOT_INSTRUCTIONS.md

# Archive to /docs/legacy
echo "📚 Archiving historical documentation..."
git mv OAUTH_FIX_SUMMARY.md docs/legacy/
git mv OAUTH_FIX_QUICK_REF.md docs/legacy/
git mv OAUTH_REDIRECT_FIX.md docs/legacy/
git mv OPENLIBRARY_FIX.md docs/legacy/
git mv PRODUCTION_BUG_FIX_SUMMARY.md docs/legacy/
git mv PRODUCTION_MENU_FIX.md docs/legacy/
git mv MENU_FIX_VISUAL.md docs/legacy/
git mv BEFORE_AFTER_UX_FIXES.md docs/legacy/
git mv UX_NAVIGATION_FIXES.md docs/legacy/
git mv DEPLOYMENT_CHECKLIST_MENU_FIX.md docs/legacy/
git mv DEPLOYMENT_CHECKLIST_v2.0.md docs/legacy/
git mv DEPLOYMENT_SUMMARY_v1.3.0.md docs/legacy/
git mv PRE_FLIGHT_SUMMARY.md docs/legacy/
git mv IMPLEMENTATION_COMPLETE.md docs/legacy/
git mv PHASE_5_COMPLETION_SUMMARY.md docs/legacy/
git mv TIER1_SUMMARY.md docs/legacy/
git mv TIER1_REFACTOR_SUMMARY.md docs/legacy/
git mv TIER2_IMPLEMENTATION.md docs/legacy/
git mv TIER3_IMPLEMENTATION.md docs/legacy/
git mv MOBILE_QA_CHECKLIST.md docs/legacy/

echo "✅ Phase 1 migration complete!"
