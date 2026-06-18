#!/bin/bash

# PM-PLUS API Integration Test Script
# Tests the Collector and Resource Balancer agent endpoints

BASE_URL="http://localhost:3000"
SESSION_ID="test_session_$(date +%s)"

echo "=========================================="
echo "PM-PLUS API Integration Test"
echo "=========================================="
echo "Session ID: $SESSION_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -e "${YELLOW}Testing: $name${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "$body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# 1. Health Check
echo "=========================================="
echo "1. Health Check"
echo "=========================================="
test_endpoint "Health Check" "GET" "/health"

# 2. Collector Agent Tests
echo "=========================================="
echo "2. Collector Agent Tests"
echo "=========================================="

test_endpoint "Collector Check-in" "POST" "/collector/check-in" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "status": "active",
  "metadata": {
    "test": true
  }
}'

test_endpoint "Submit Collected Data - Update" "POST" "/collector/data" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "sourceType": "status-report",
  "source": "test-suite",
  "category": "update",
  "priority": "medium",
  "content": {
    "taskId": "TASK-001",
    "status": "in-progress",
    "progress": 75
  }
}'

test_endpoint "Submit Collected Data - Risk" "POST" "/collector/data" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "sourceType": "risk-alert",
  "source": "automated-scan",
  "category": "risk",
  "priority": "high",
  "content": {
    "description": "Test risk alert",
    "severity": "high"
  }
}'

test_endpoint "Get Collected Data" "GET" "/collector/data?sessionId=$SESSION_ID"

# 3. Resource Balancer Tests
echo "=========================================="
echo "3. Resource Balancer Agent Tests"
echo "=========================================="

test_endpoint "Resource Balancer Check-in" "POST" "/resource-balancer/check-in" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "status": "active"
}'

test_endpoint "Register Resource - Developer" "POST" "/resource-balancer/resources" \
'{
  "name": "Test Developer",
  "type": "human",
  "capacity": 10,
  "availability": "available",
  "skills": ["typescript", "nodejs"]
}'

# Store resource ID for later use
RESOURCE_RESPONSE=$(curl -s -X POST "$BASE_URL/resource-balancer/resources" \
    -H "Content-Type: application/json" \
    -d '{
  "name": "Test CI/CD Pipeline",
  "type": "infrastructure",
  "capacity": 5,
  "availability": "available"
}')
RESOURCE_ID=$(echo "$RESOURCE_RESPONSE" | jq -r '.resourceId')

test_endpoint "List Resources" "GET" "/resource-balancer/resources"

test_endpoint "Create Resource Allocation" "POST" "/resource-balancer/allocations" \
'{
  "resourceId": "'"$RESOURCE_ID"'",
  "sessionId": "'"$SESSION_ID"'",
  "taskId": "TASK-001",
  "priority": "high",
  "estimatedDuration": 3600
}'

test_endpoint "Get Allocations" "GET" "/resource-balancer/allocations?sessionId=$SESSION_ID"

test_endpoint "Submit Recommendation" "POST" "/resource-balancer/recommendations" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "type": "load_balancing",
  "severity": "warning",
  "description": "Test recommendation for load balancing",
  "affectedResources": ["'"$RESOURCE_ID"'"],
  "suggestedActions": ["Monitor resource usage", "Consider scaling"],
  "requiresApproval": false
}'

test_endpoint "Get Recommendations" "GET" "/resource-balancer/recommendations?sessionId=$SESSION_ID"

test_endpoint "Get Project Metrics" "GET" "/resource-balancer/metrics?sessionId=$SESSION_ID"

# 4. State Management Tests
echo "=========================================="
echo "4. State Management Tests"
echo "=========================================="

test_endpoint "Get Session State" "GET" "/state?sessionId=$SESSION_ID"

test_endpoint "Record State Event" "POST" "/state/event" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "agentId": "test-agent",
  "eventType": "test_event",
  "payload": {
    "message": "Integration test event"
  }
}'

# 5. Human-in-the-Loop Tests
echo "=========================================="
echo "5. Human-in-the-Loop Tests"
echo "=========================================="

test_endpoint "Create Approval Request" "POST" "/human/approval-request" \
'{
  "sessionId": "'"$SESSION_ID"'",
  "agentId": "resource_balancer",
  "action": "reallocate_resources",
  "context": {
    "description": "Test approval request",
    "impact": "medium"
  }
}'

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

# Made with Bob
