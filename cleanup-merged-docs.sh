#!/bin/bash
# Cleanup script for merged documentation files
# Run AFTER merging content into target docs

set -e

echo "🧹 Removing merged documentation files..."

# API Integration merges
git rm API_DOCUMENTATION.md
git rm LOC_INTEGRATION_GUIDE.md

# Architecture merges  
git rm AUTHENTICATION_SETUP.md
git rm SERVERLESS_ARCHITECTURE.md
git rm MODULE_REFERENCE.md

# Deployment merges
git rm IMAGE_SECURITY.md
git rm IMAGE_PROXY_SECURITY.md

# Quick Reference merges
git rm QUICK_COMMANDS.md
git rm QUICK_FIX_REFERENCE.md

# Mobile Scanner consolidation
git rm MOBILE_FIELD_AGENT.md
git rm MOBILE_SCANNER_IMPROVEMENTS.md
git rm MOBILE_SCANNER_STABILITY_PASS.md
git rm MOBILE_SCAN_VISUAL_ENHANCEMENTS.md

echo "✅ Cleanup complete!"
echo ""
echo "Remaining root .md files:"
find . -maxdepth 1 -name "*.md" -type f | sort
