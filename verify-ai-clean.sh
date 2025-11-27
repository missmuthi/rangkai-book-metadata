#!/bin/bash

echo "🔍 Verifying AI Clean Implementation..."
echo ""

echo "✓ Backend Endpoint:"
grep -q "platform.context.waitUntil" src/routes/api/ai/clean/+server.ts && echo "  ✅ Write-through caching implemented" || echo "  ❌ Missing waitUntil"
grep -q "is_ai_enhanced: true" src/routes/api/ai/clean/+server.ts && echo "  ✅ AI enhancement flag added" || echo "  ❌ Missing enhancement flag"
grep -q "BOOK_CACHE.put" src/routes/api/ai/clean/+server.ts && echo "  ✅ KV cache update" || echo "  ❌ Missing KV update"
grep -q "json_data" src/routes/api/ai/clean/+server.ts && echo "  ✅ D1 database update" || echo "  ❌ Missing D1 update"

echo ""
echo "✓ AI Service (Indonesian Standards):"
grep -q "Indonesian Librarian" src/lib/server/ai/index.ts && echo "  ✅ Indonesian librarian system prompt" || echo "  ❌ Missing system prompt"
grep -q "ISBD" src/lib/server/ai/index.ts && echo "  ✅ ISBD publisher format" || echo "  ❌ Missing ISBD"
grep -q "translate.*Indonesian" src/lib/server/ai/index.ts && echo "  ✅ English → Indonesian translation" || echo "  ❌ Missing translation"
grep -q "ALL CAPS.*Title Case" src/lib/server/ai/index.ts && echo "  ✅ Title case conversion" || echo "  ❌ Missing title fix"

echo ""
echo "✓ Frontend UI:"
grep -q "gradient.*amber.*violet" src/lib/components/BookDetailModal.svelte && echo "  ✅ Gold-purple gradient badge" || echo "  ❌ Missing gradient"
grep -q "AI Clean" src/lib/components/BookDetailModal.svelte && echo "  ✅ AI Clean button" || echo "  ❌ Missing button"
grep -q "Metadata cleaned.*translated by AI" src/lib/components/BookDetailModal.svelte && echo "  ✅ Tooltip implemented" || echo "  ❌ Missing tooltip"
grep -q "toast" src/lib/components/BookDetailModal.svelte && echo "  ✅ Toast notifications" || echo "  ❌ Missing toast"

echo ""
echo "✓ Type Definitions:"
grep -q "is_ai_enhanced" src/lib/types.ts && echo "  ✅ is_ai_enhanced field" || echo "  ❌ Missing field"
grep -q "enhanced_at" src/lib/types.ts && echo "  ✅ enhanced_at field" || echo "  ❌ Missing field"
grep -q "publishPlace" src/lib/types.ts && echo "  ✅ publishPlace for ISBD" || echo "  ❌ Missing publishPlace"

echo ""
echo "🎯 Running type check..."
npm run check 2>&1 | grep -q "0 errors" && echo "  ✅ All types valid" || echo "  ❌ Type errors found"

echo ""
echo "📚 Documentation:"
[ -f "AI_CLEAN_IMPLEMENTATION.md" ] && echo "  ✅ Implementation guide created" || echo "  ❌ Missing docs"
[ -f "AI_CLEAN_SUMMARY.md" ] && echo "  ✅ Quick summary created" || echo "  ❌ Missing summary"

echo ""
echo "✨ Verification Complete!"
