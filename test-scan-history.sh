#!/bin/bash

# Test script to verify scan history functionality
# Usage: ./test-scan-history.sh

echo "================================"
echo "🔍 Scan History Setup Checker"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Wrangler installed
echo "1. Checking Wrangler installation..."
if command -v wrangler &> /dev/null; then
    echo -e "${GREEN}✓${NC} Wrangler is installed"
else
    echo -e "${RED}✗${NC} Wrangler is NOT installed"
    echo "   Install with: npm install -g wrangler"
    exit 1
fi

# Check 2: D1 database configuration
echo ""
echo "2. Checking D1 database configuration..."
if grep -q "d1_databases" wrangler.toml; then
    echo -e "${GREEN}✓${NC} D1 database configured in wrangler.toml"
    grep -A 3 "d1_databases" wrangler.toml | sed 's/^/   /'
else
    echo -e "${RED}✗${NC} D1 database NOT configured"
    exit 1
fi

# Check 3: Schema file exists
echo ""
echo "3. Checking database schema..."
if [ -f "schema.sql" ]; then
    echo -e "${GREEN}✓${NC} schema.sql exists"
    
    # Check for required tables
    if grep -q "CREATE TABLE.*scans" schema.sql; then
        echo -e "${GREEN}✓${NC} 'scans' table defined"
    else
        echo -e "${RED}✗${NC} 'scans' table NOT found in schema"
    fi
    
    if grep -q "CREATE TABLE.*user" schema.sql; then
        echo -e "${GREEN}✓${NC} 'user' table defined"
    else
        echo -e "${RED}✗${NC} 'user' table NOT found in schema"
    fi
    
    if grep -q "CREATE TABLE.*session" schema.sql; then
        echo -e "${GREEN}✓${NC} 'session' table defined"
    else
        echo -e "${RED}✗${NC} 'session' table NOT found in schema"
    fi
else
    echo -e "${RED}✗${NC} schema.sql NOT found"
    exit 1
fi

# Check 4: Build artifacts
echo ""
echo "4. Checking build artifacts..."
if [ -d ".svelte-kit/cloudflare" ]; then
    echo -e "${GREEN}✓${NC} Build artifacts exist"
else
    echo -e "${YELLOW}!${NC} Build artifacts NOT found"
    echo "   Run: npm run build"
fi

# Check 5: Environment variables
echo ""
echo "5. Checking environment configuration..."
if [ -f ".dev.vars" ]; then
    echo -e "${GREEN}✓${NC} .dev.vars exists"
    
    required_vars=("GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET" "BETTER_AUTH_URL")
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" .dev.vars; then
            echo -e "${GREEN}✓${NC} $var is set"
        else
            echo -e "${YELLOW}!${NC} $var is NOT set in .dev.vars"
        fi
    done
else
    echo -e "${YELLOW}!${NC} .dev.vars NOT found (optional for local dev)"
fi

# Check 6: Development scripts
echo ""
echo "6. Checking package.json scripts..."
if grep -q '"dev:wrangler"' package.json; then
    echo -e "${GREEN}✓${NC} dev:wrangler script exists"
else
    echo -e "${RED}✗${NC} dev:wrangler script NOT found"
    echo "   Add to package.json scripts:"
    echo '   "dev:wrangler": "wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-01-01 --d1=DB --kv=BOOK_CACHE --port=8788"'
fi

# Summary
echo ""
echo "================================"
echo "📋 Setup Summary"
echo "================================"
echo ""
echo "To run the app with history saving:"
echo ""
echo -e "${GREEN}1.${NC} Build the app:"
echo "   npm run build"
echo ""
echo -e "${GREEN}2.${NC} Initialize D1 database (first time only):"
echo "   wrangler d1 execute DB --local --file=schema.sql"
echo ""
echo -e "${GREEN}3.${NC} Start development server:"
echo "   npm run dev:wrangler"
echo ""
echo -e "${GREEN}4.${NC} Open browser:"
echo "   http://localhost:8788"
echo ""
echo "================================"

# Optional: Check if port 8788 is available
echo ""
echo "7. Checking port availability..."
if lsof -Pi :8788 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}!${NC} Port 8788 is in use"
    echo "   Stop the process or use a different port"
else
    echo -e "${GREEN}✓${NC} Port 8788 is available"
fi

echo ""
echo "✅ Setup check complete!"
