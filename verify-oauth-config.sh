#!/bin/bash

# OAuth Redirect URI Verification Script
# This script shows what redirect URI will be generated based on BETTER_AUTH_URL

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 OAuth Redirect URI Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check .env file
if [ -f .env ]; then
    echo "📄 Local .env configuration:"
    BETTER_AUTH_URL=$(grep "^BETTER_AUTH_URL=" .env | cut -d'"' -f2)
    echo "   BETTER_AUTH_URL = \"$BETTER_AUTH_URL\""
    
    # Normalize URL (remove trailing slashes)
    NORMALIZED_URL=$(echo "$BETTER_AUTH_URL" | sed 's:/*$::')
    
    # Build redirect URI
    REDIRECT_URI="$NORMALIZED_URL/api/auth/callback/google"
    
    echo ""
    echo "🎯 Computed redirect URI:"
    echo "   $REDIRECT_URI"
    echo ""
    
    # Check for issues
    if [[ "$BETTER_AUTH_URL" == */ ]]; then
        echo "⚠️  WARNING: BETTER_AUTH_URL has trailing slash!"
        echo "   This could cause double-slash issues."
        echo "   The normalizeBaseUrl() function will fix this."
    fi
    
    # Check for double slashes (but not in http:// or https://)
    DOUBLE_SLASH_CHECK=$(echo "$REDIRECT_URI" | sed 's|https\?://||' | grep '//')
    if [ -n "$DOUBLE_SLASH_CHECK" ]; then
        echo "❌ ERROR: Redirect URI contains double slashes!"
        echo "   Found: $DOUBLE_SLASH_CHECK"
        echo "   Check your BETTER_AUTH_URL configuration."
    else
        echo "✅ No double slashes detected"
    fi
    
    if [[ "$BETTER_AUTH_URL" == "http://localhost"* ]]; then
        echo "✅ Using localhost for local development"
    elif [[ "$BETTER_AUTH_URL" == "https://rangkai-book-metadata.pages.dev"* ]]; then
        echo "⚠️  WARNING: Using production URL in .env"
        echo "   This is fine for production, but local dev should use http://localhost:5173"
    fi
else
    echo "❌ .env file not found"
    echo "   Create one from .env.example"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Google Cloud Console Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ensure these redirect URIs are authorized in Google Cloud Console:"
echo ""
echo "Development:"
echo "   http://localhost:5173/api/auth/callback/google"
echo ""
echo "Production:"
echo "   https://rangkai-book-metadata.pages.dev/api/auth/callback/google"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
