#!/bin/bash
# Test AI Clean Endpoint After One Phase Fix

echo "Testing AI Clean Endpoint..."
echo "============================"
echo ""

# Note: You'll need to get a valid session token from your browser
# Open DevTools -> Application -> Cookies -> auth.session_token

# Example test (replace with your session token)
SESSION_TOKEN="your_session_token_here"

# Test book data
TEST_BOOK='{
  "book": {
    "title": "Introduction to Algorithms",
    "author": "Thomas H. Cormen",
    "isbn13": "9780262033848",
    "publisher": "",
    "ddc": "",
    "lcc": "",
    "language": "",
    "subjects": ""
  },
  "mode": "fill_gaps"
}'

echo "Test Book Data:"
echo "$TEST_BOOK"
echo ""
echo "Sending request to production..."
echo ""

# Test production endpoint
curl -X POST https://rangkai.pages.dev/api/ai/clean \
  -H "Content-Type: application/json" \
  -H "Cookie: auth.session_token=$SESSION_TOKEN" \
  -d "$TEST_BOOK" \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "============================"
echo "Test complete!"
echo ""
echo "Expected Response:"
echo "- saved: true"
echo "- scan_id: <number>"
echo "- ddc: <estimated value>"
echo "- lcc: <estimated value>"
echo "- language: 'eng'"
echo "- ai_log: [array of changes]"
echo "- changes: [array of updates]"
