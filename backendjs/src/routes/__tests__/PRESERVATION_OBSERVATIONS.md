# Preservation Property Tests - Observations on UNFIXED Code

**Date**: Task 2 Execution
**Status**: ✅ All tests PASS on UNFIXED code
**Purpose**: Document baseline behavior to preserve after implementing the fix

## Test Results Summary

All 8 preservation tests passed successfully on the UNFIXED code:

1. ✅ should save customer data to database when Supabase is healthy (45 ms)
2. ✅ should preserve /api/chart endpoint behavior (5 ms)
3. ✅ should preserve /api/elements endpoint behavior (4 ms)
4. ✅ should preserve /api/stars endpoint behavior (3 ms)
5. ✅ should handle multiple concurrent requests with healthy database (16 ms)
6. ✅ PROPERTY: For any valid birth data with healthy database, customer data is saved correctly (81 ms)
7. ✅ PROPERTY: Other endpoints work correctly regardless of /api/analyze changes (32 ms)
8. ✅ PROPERTY: Response time is fast when database is healthy (1089 ms)

**Total Time**: 1.849 seconds

## Observed Behaviors (Baseline to Preserve)

### 1. Normal Database Save Behavior (Requirement 3.1)

**Observation**: When Supabase connection is healthy:
- `dbService.createNewCustomer()` is called with correct parameters
- Customer data is saved to database successfully
- `customerId` is returned and included in response
- Analysis results are complete and correct
- Console logs show: `[DB] New customer #<id> created`

**Evidence**: Test passed with mock customer ID 12345 returned in response

### 2. Other API Endpoints Unchanged (Requirement 3.2)

**Observation**: Other endpoints work independently:
- `/api/chart` returns chart data without database operations
- `/api/elements` returns element analysis without database operations
- `/api/stars` returns star analysis without database operations
- `dbService.createNewCustomer()` is NOT called for these endpoints
- All endpoints return 200 status with expected data structure

**Evidence**: All 3 endpoint tests passed (5ms, 4ms, 3ms respectively)

### 3. Concurrent Request Handling (Requirement 3.5)

**Observation**: Multiple concurrent requests are handled correctly:
- 5 concurrent requests all succeed
- Each request gets a unique `customerId`
- Database is called 5 times (once per request)
- All responses have status 200 with complete data
- No connection pool issues observed

**Evidence**: Test passed with 5 concurrent requests in 16ms

### 4. Property-Based Test Observations

#### Property 1: Normal Database Save (20 test cases)
**Observation**: For all randomly generated valid birth data:
- Database save is called with correct parameters matching input
- Response status is always 200
- Response contains all required fields (thong_tin_co_ban, tu_tru, ngu_hanh)
- `customerId` is always included in response when database succeeds
- Console logs show customer creation for each test case

**Evidence**: 20 test cases passed in 81ms

#### Property 2: Other Endpoints Unchanged (15 test cases)
**Observation**: For all randomly generated inputs and endpoints:
- All endpoints return 200 status
- Response structure matches expected format for each endpoint
- Database save is NEVER called for non-analyze endpoints
- No interference between endpoints

**Evidence**: 15 test cases passed in 32ms

#### Property 3: Fast Response Time (10 test cases)
**Observation**: When database responds quickly (< 1 second):
- Overall response time is fast (< 3 seconds)
- No unnecessary overhead in the request flow
- Database operation completes successfully
- Response includes complete analysis data

**Evidence**: 10 test cases passed in 1089ms (average ~109ms per test)

## Baseline Behavior Summary

The UNFIXED code exhibits the following baseline behavior when Supabase is healthy:

1. **Database Integration**: Customer data is saved to database on every `/api/analyze` request
2. **Response Format**: Response includes `customerId` when database save succeeds
3. **Endpoint Isolation**: Other endpoints do not interact with database save operations
4. **Performance**: Response time is fast when database is healthy (< 3 seconds)
5. **Concurrency**: Multiple concurrent requests are handled correctly
6. **Error Handling**: Database operations complete successfully in normal conditions

## Preservation Requirements

After implementing the fix for the bug condition (database failures blocking analysis results), these behaviors MUST be preserved:

- ✅ Customer data MUST still be saved when Supabase is healthy
- ✅ `customerId` MUST be included in response when save succeeds
- ✅ Other endpoints MUST remain completely unaffected
- ✅ Response time MUST remain fast when database is healthy
- ✅ Concurrent requests MUST be handled correctly
- ✅ Database connection pool MUST maintain configured parameters

## Next Steps

1. Implement the fix for bug condition (Task 3)
2. Re-run these preservation tests after the fix
3. Verify all tests still PASS (no regressions)
4. Document any differences in behavior (should be none for non-buggy inputs)

## Notes

- All tests use mocked database and bazi services for isolation
- Tests are deterministic and repeatable
- Property-based tests provide strong guarantees across input space
- Fast execution time (< 2 seconds) allows for frequent regression testing
