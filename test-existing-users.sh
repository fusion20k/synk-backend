#!/bin/bash
# Test existing users can still log in

echo "=== Testing Existing User Login ==="
echo ""

# Prompt for existing user credentials
read -p "Enter existing user email: " TEST_EMAIL
read -s -p "Enter password: " TEST_PASSWORD
echo ""
echo ""

echo "Testing login for: $TEST_EMAIL"
echo ""

# 1. Login with existing user account
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:10000/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq '.'
echo ""

# 2. Check login succeeds despite email_verified: false
SUCCESS=$(echo "$LOGIN_RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✓ PASS: Login successful"
else
  echo "✗ FAIL: Login failed"
  ERROR=$(echo "$LOGIN_RESPONSE" | jq -r '.error')
  echo "Error: $ERROR"
  exit 1
fi
echo ""

# 3. Check token is present
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
if [ "$TOKEN" != "null" ] && [ ! -z "$TOKEN" ]; then
  echo "✓ PASS: JWT token received"
  echo "Token (first 50 chars): ${TOKEN:0:50}..."
else
  echo "✗ FAIL: No token received"
  exit 1
fi
echo ""

# 4. Verify user can access /me endpoint
echo "2. Testing /me endpoint access..."
ME_RESPONSE=$(curl -s http://localhost:10000/me \
  -H "Authorization: Bearer ${TOKEN}")

echo "User profile response:"
echo "$ME_RESPONSE" | jq '.'
echo ""

ME_SUCCESS=$(echo "$ME_RESPONSE" | jq -r '.success')
if [ "$ME_SUCCESS" = "true" ]; then
  echo "✓ PASS: User can access protected endpoints"
else
  echo "✗ FAIL: User cannot access protected endpoints"
  exit 1
fi
echo ""

echo "=== Test Summary ==="
echo "✓ Existing user can log in successfully"
echo "✓ Existing user can access protected endpoints"
echo "✓ Backward compatibility maintained"
