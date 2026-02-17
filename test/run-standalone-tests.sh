#!/bin/bash
# Test runner for standalone tests
# These tests don't require Playwright installation and use Node.js built-in modules

echo "======================================"
echo "Running Standalone Test Suite"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

total_passed=0
total_failed=0

# Run I18n tests
echo -e "${CYAN}Running I18n JSON Tests...${NC}"
if node test/i18n-standalone.test.js; then
    echo -e "${GREEN}I18n tests PASSED${NC}"
    total_passed=$((total_passed + 1))
else
    echo -e "${RED}I18n tests FAILED${NC}"
    total_failed=$((total_failed + 1))
fi

echo ""
echo "======================================"
echo ""

# Run HTML tests
echo -e "${CYAN}Running HTML Tests...${NC}"
if node test/html-standalone.test.js; then
    echo -e "${GREEN}HTML tests PASSED${NC}"
    total_passed=$((total_passed + 1))
else
    echo -e "${RED}HTML tests FAILED${NC}"
    total_failed=$((total_failed + 1))
fi

echo ""
echo "======================================"
echo "Overall Test Suite Results"
echo "======================================"
echo "Test Suites Passed: ${total_passed}"
echo "Test Suites Failed: ${total_failed}"
echo ""

if [ $total_failed -eq 0 ]; then
    echo -e "${GREEN}All test suites passed!${NC}"
    exit 0
else
    echo -e "${RED}Some test suites failed!${NC}"
    exit 1
fi