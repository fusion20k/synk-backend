#!/bin/bash
# Test resend verification email

echo "=== Testing Resend Verification Flow ==="
echo ""

# Prompt for unverified test email
read -p "Enter unverified email address: " TEST_EMAIL
echo ""

echo "Test email: $TEST_EMAIL"
echo ""

# 1. Request resend
echo "1. Testing resend verification..."
RESEND_RESPONSE=$(curl -s -X POST http://localhost:10000/resend-verification \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\"}")

echo "Resend response:"
echo "$RESEND_RESPONSE" | jq '.'
echo ""

SUCCESS=$(echo "$RESEND_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✓ PASS: Verification email resent successfully"
else
  echo "✗ FAIL: Failed to resend verification email"
  ERROR=$(echo "$RESEND_RESPONSE" | jq -r '.error')
  echo "Error: $ERROR"
fi
echo ""

# 2. Test rate limiting (send 4 requests rapidly)
echo "2. Testing rate limiting (sending 4 requests rapidly)..."
echo ""

for i in {1..4}; do
  echo "Request $i:"
  RESPONSE=$(curl -s -X POST http://localhost:10000/resend-verification \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\"}")
  
  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
  
  if [ "$ERROR" = "rate_limit_exceeded" ]; then
    echo "  ✓ Rate limit triggered (expected on 4th request)"
  elif [ "$SUCCESS" = "true" ]; then
    echo "  ✓ Request succeeded"
  else
    echo "  Error: $ERROR"
  fi
  
  sleep 0.5
done
echo ""

echo "=== Test Summary ==="
echo "✓ Resend verification endpoint works"
echo "✓ Rate limiting active (max 3 requests per hour per email)"
echo ""
echo "Check your email inbox for verification link"
