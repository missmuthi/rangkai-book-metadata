#!/bin/bash

# AI Feature Monitoring Script
# Usage: ./monitor-ai-production.sh

set -e

echo "================================================"
echo "AI Feature Production Monitoring"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI not found${NC}"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

echo "📊 Fetching deployment info..."
echo ""

# Get latest deployment
echo "=== Latest Deployment ==="
wrangler pages deployment list --project-name=rangkai-book-metadata | head -n 5
echo ""

# Check KV cache stats
echo "=== KV Cache Status ==="
echo "Checking BOOK_CACHE namespace..."
wrangler kv:key list --namespace-id=0844494af5e74ac1b28600f686a060c2 --limit=5
echo ""

# Check D1 database
echo "=== D1 Database Status ==="
echo "Checking rangkai-scans database..."
wrangler d1 execute rangkai-scans --command="SELECT COUNT(*) as scan_count FROM scans"
echo ""

# Show recent logs
echo "=== Recent Logs (last 10 minutes) ==="
echo "Tailing deployment logs for 30 seconds..."
timeout 30s wrangler pages deployment tail --project-name=rangkai-book-metadata || true
echo ""

echo "================================================"
echo "Monitoring Complete"
echo "================================================"
echo ""
echo "To manually check Google AI usage:"
echo "1. Visit https://aistudio.google.com/"
echo "2. Go to 'Get API key' → View usage"
echo ""
echo "To set up alerts:"
echo "1. Cloudflare Dashboard → Your Pages project"
echo "2. Navigate to Analytics"
echo "3. Set up notifications for errors"
echo ""
