#!/bin/bash
# Test new user signup creates auth user but not database user

echo "=== Testing Signup Flow ==="
echo ""

# Generate unique test email
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@example.com"
TEST_PASSWORD="testpass123"

echo "Test email: $TEST_EMAIL"
echo ""

# 1. Sign up new user
echo "1. Testing signup..."
RESPONSE=$(curl -s -X POST http://localhost:10000/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

echo "Signup response:"
echo "$RESPONSE" | jq '.'
echo ""

# 2. Check response has requiresEmailVerification
echo "2. Checking requiresEmailVerification flag..."
REQUIRES_VERIFICATION=$(echo "$RESPONSE" | jq -r '.requiresEmailVerification')
if [ "$REQUIRES_VERIFICATION" = "true" ]; then
  echo "✓ PASS: requiresEmailVerification is true"
else
  echo "✗ FAIL: requiresEmailVerification is not true (got: $REQUIRES_VERIFICATION)"
fi
echo ""

# 3. Check response does NOT have token
echo "3. Checking that no token was returned..."
TOKEN=$(echo "$RESPONSE" | jq -r '.token')
if [ "$TOKEN" = "null" ]; then
  echo "✓ PASS: No token returned (as expected)"
else
  echo "✗ FAIL: Token was returned (should not be): $TOKEN"
fi
echo ""

# 4. Attempt login should fail with email_not_verified
echo "4. Testing login before verification..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:10000/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq '.'
echo ""

ERROR=$(echo "$LOGIN_RESPONSE" | jq -r '.error')
if [ "$ERROR" = "email_not_verified" ]; then
  echo "✓ PASS: Login rejected with email_not_verified error"
else
  echo "✗ FAIL: Expected email_not_verified error, got: $ERROR"
fi
echo ""

echo "=== Test Summary ==="
echo "Test email created: $TEST_EMAIL"
echo "To verify email, check Supabase Dashboard → Authentication → Users"
echo "Then manually verify the email and test login again"
