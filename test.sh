#!/bin/bash
# Test runner script with proper Node.js configuration

export PATH="/opt/homebrew/bin:$PATH"

echo "=================================="
echo "Code Review Reader - Test Suite"
echo "=================================="
echo ""

# Check Node.js availability
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Run unit tests
echo "Running unit tests with Vitest..."
echo "----------------------------------"
npm test -- run
UNIT_TEST_EXIT=$?
echo ""

# Check if we should run E2E tests
if [ "$1" = "e2e" ] || [ "$1" = "all" ]; then
  echo "Running E2E tests with Playwright..."
  echo "-------------------------------------"
  npm run test:e2e
  E2E_TEST_EXIT=$?
  echo ""
fi

# Generate coverage report if requested
if [ "$1" = "coverage" ] || [ "$1" = "all" ]; then
  echo "Generating coverage report..."
  echo "-----------------------------"
  npm run test:coverage
  COVERAGE_EXIT=$?
  echo ""
fi

echo "=================================="
echo "Test Summary"
echo "=================================="
echo "Unit tests: $([ $UNIT_TEST_EXIT -eq 0 ] && echo '✓ PASSED' || echo '✗ FAILED')"
[ ! -z "$E2E_TEST_EXIT" ] && echo "E2E tests: $([ $E2E_TEST_EXIT -eq 0 ] && echo '✓ PASSED' || echo '✗ FAILED')"
[ ! -z "$COVERAGE_EXIT" ] && echo "Coverage: $([ $COVERAGE_EXIT -eq 0 ] && echo '✓ GENERATED' || echo '✗ FAILED')"
echo "=================================="

# Exit with error if any test failed
[ $UNIT_TEST_EXIT -ne 0 ] && exit $UNIT_TEST_EXIT
[ ! -z "$E2E_TEST_EXIT" ] && [ $E2E_TEST_EXIT -ne 0 ] && exit $E2E_TEST_EXIT
[ ! -z "$COVERAGE_EXIT" ] && [ $COVERAGE_EXIT -ne 0 ] && exit $COVERAGE_EXIT

exit 0
