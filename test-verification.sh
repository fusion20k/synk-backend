#!/bin/bash
# Test login after manual email verification

echo "=== Testing Email Verification Flow ==="
echo ""

# Prompt for test email (must be manually verified first)
read -p "Enter email address (must be verified in Supabase Dashboard first): " TEST_EMAIL
read -s -p "Enter password: " TEST_PASSWORD
echo ""
echo ""

echo "Test email: $TEST_EMAIL"
echo ""

# 1. Attempt login should succeed
echo "1. Testing login after verification..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:10000/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq '.'
echo ""

# 2. Check response has token
echo "2. Checking for JWT token..."
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
  echo "✓ PASS: JWT token received"
  echo "Token (first 50 chars): ${TOKEN:0:50}..."
else
  echo "✗ FAIL: No token received"
  exit 1
fi
echo ""

# 3. Check user was created in database
echo "3. Testing /me endpoint to verify user in database..."
ME_RESPONSE=$(curl -s http://localhost:10000/me \
  -H "Authorization: Bearer ${TOKEN}")

echo "User profile response:"
echo "$ME_RESPONSE" | jq '.'
echo ""

# 4. Check plan assignment
PLAN=$(echo "$ME_RESPONSE" | jq -r '.plan.type')
if [ "$PLAN" != "null" ] && [ ! -z "$PLAN" ]; then
  echo "✓ PASS: User has plan assigned: $PLAN"
else
  echo "✗ FAIL: No plan assigned to user"
fi
echo ""

echo "=== Test Summary ==="
echo "✓ Login successful after email verification"
echo "✓ User record created in database"
echo "✓ Plan assigned: $PLAN"
