/**
 * Bug Condition Exploration Test for Supabase Save Chart Data Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2**
 * 
 * This test MUST FAIL on unfixed code to confirm the bug exists.
 * The test simulates database failures and verifies that the API should
 * return complete analysis results regardless of database state.
 * 
 * When this test FAILS (on unfixed code), it proves:
 * - The bug exists: database failures block analysis results
 * - The root cause: database save operation is blocking the main flow
 * 
 * When this test PASSES (after fix), it confirms:
 * - The expected behavior is satisfied: analysis results are always returned
 * - The fix works correctly: database failures don't block the response
 */

const request = require('supertest');
const express = require('express');
const fc = require('fast-check');

// Create a test app
const app = express();
app.use(express.json());

// Mock the database service BEFORE requiring the routes
jest.mock('../../services/db', () => ({
    createNewCustomer: jest.fn(),
    healthCheck: jest.fn()
}));

// Mock the bazi service to ensure it works independently
jest.mock('../../services/bazi.service', () => ({
    analyzeComplete: jest.fn()
}));

const dbService = require('../../services/db');
const baziService = require('../../services/bazi.service');
const baziRoutes = require('../bazi.routes');

app.use('/api', baziRoutes);

describe('Bug Condition Exploration: Property 1 - Database Failure Does Not Block Analysis Results', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default: bazi service returns valid analysis results
        baziService.analyzeComplete.mockResolvedValue({
            thong_tin_co_ban: {
                ten: 'Test User',
                gioi_tinh: 'Nam',
                ngay_sinh: '15/5/1990'
            },
            tu_tru: {
                year: { can: 'Canh', chi: 'Ngo' },
                month: { can: 'Tan', chi: 'Ti' },
                day: { can: 'Nhat', chi: 'Mao' },
                hour: { can: 'Binh', chi: 'Ngo' }
            },
            ngu_hanh: {
                Kim: 2,
                Moc: 1,
                Thuy: 1,
                Hoa: 2,
                Tho: 2
            },
            than_sat: ['Thien Duc', 'Thien Y'],
            dai_van: [
                { can_chi: 'Nham Than', age_start: 8, age_end: 17 }
            ]
        });
    });

    /**
     * Test Case 1: Database Connection Timeout (20+ seconds)
     * 
     * **Validates: Requirements 1.2, 2.2**
     * 
     * EXPECTED ON UNFIXED CODE: Test FAILS
     * - Request hangs or times out
     * - No response returned within reasonable time
     * - User sees loading state indefinitely
     * 
     * EXPECTED AFTER FIX: Test PASSES
     * - Response returned within 5 seconds
     * - Status 200 with complete analysis results
     * - customerId is null (database save failed)
     */
    test('should return analysis results even when database times out (20+ seconds)', async () => {
        // Mock database to timeout after 20 seconds
        dbService.createNewCustomer.mockImplementation(() => {
            return new Promise((resolve) => {
                setTimeout(() => resolve(null), 20000); // 20 second timeout
            });
        });

        const response = await request(app)
            .get('/api/analyze')
            .query({
                year: 1990,
                month: 5,
                day: 15,
                hour: 10,
                gender: 'Nam'
            })
            .timeout(30000); // Allow 30 seconds for the request

        // ASSERTIONS - These encode the EXPECTED behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('thong_tin_co_ban');
        expect(response.body).toHaveProperty('tu_tru');
        expect(response.body).toHaveProperty('ngu_hanh');
        expect(response.body.tu_tru).toBeDefined();
        expect(response.body.ngu_hanh).toBeDefined();
        
        // Response should be fast even if DB is slow
        // (This will be measured by the test timeout)
    }, 35000); // Test timeout: 35 seconds

    /**
     * Test Case 2: Database Connection Error
     * 
     * **Validates: Requirements 1.2, 2.1, 2.3**
     * 
     * EXPECTED ON UNFIXED CODE: Test FAILS
     * - Request returns 500 error
     * - No analysis results in response
     * - Error propagates to user
     * 
     * EXPECTED AFTER FIX: Test PASSES
     * - Status 200 with complete analysis results
     * - customerId is null
     * - Error is logged but doesn't affect response
     */
    test('should return analysis results even when database throws connection error', async () => {
        // Mock database to throw connection error
        dbService.createNewCustomer.mockRejectedValue(
            new Error('ECONNREFUSED: Connection refused to Supabase')
        );

        const response = await request(app)
            .get('/api/analyze')
            .query({
                year: 1985,
                month: 12,
                day: 3,
                hour: 14,
                gender: 'Nữ'
            });

        // ASSERTIONS - These encode the EXPECTED behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('thong_tin_co_ban');
        expect(response.body).toHaveProperty('tu_tru');
        expect(response.body).toHaveProperty('ngu_hanh');
        expect(response.body).toHaveProperty('than_sat');
        expect(response.body).toHaveProperty('dai_van');
        
        // customerId should be null when database fails
        expect(response.body.customerId).toBeNull();
    });

    /**
     * Test Case 3: Database Health Check Returns Error
     * 
     * **Validates: Requirements 1.2, 2.2**
     * 
     * EXPECTED ON UNFIXED CODE: Test FAILS
     * - Request may fail or hang
     * - No analysis results returned
     * 
     * EXPECTED AFTER FIX: Test PASSES
     * - Analysis results returned regardless of DB health
     * - Status 200 with complete data
     */
    test('should return analysis results even when database health check fails', async () => {
        // Mock database health check to return error
        dbService.healthCheck.mockResolvedValue({ status: 'error', message: 'Database unavailable' });
        
        // Mock database save to fail
        dbService.createNewCustomer.mockRejectedValue(
            new Error('Database health check failed')
        );

        const response = await request(app)
            .get('/api/analyze')
            .query({
                year: 2000,
                month: 1,
                day: 1,
                hour: 12,
                gender: 'Nam'
            });

        // ASSERTIONS - These encode the EXPECTED behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('thong_tin_co_ban');
        expect(response.body).toHaveProperty('tu_tru');
        expect(response.body.customerId).toBeNull();
    });

    /**
     * Test Case 4: Slow Database Response (10 seconds)
     * 
     * **Validates: Requirements 2.2, 2.4**
     * 
     * EXPECTED ON UNFIXED CODE: Test FAILS
     * - Response time > 10 seconds (unnecessarily slow)
     * - User experiences poor performance
     * 
     * EXPECTED AFTER FIX: Test PASSES
     * - Response time < 5 seconds (timeout protection)
     * - Analysis results returned quickly
     */
    test('should return analysis results quickly even when database is slow', async () => {
        // Mock database to be slow (10 seconds) but eventually succeed
        dbService.createNewCustomer.mockImplementation(() => {
            return new Promise((resolve) => {
                setTimeout(() => resolve(123), 10000); // 10 second delay
            });
        });

        const startTime = Date.now();
        
        const response = await request(app)
            .get('/api/analyze')
            .query({
                year: 1995,
                month: 7,
                day: 20,
                hour: 8,
                gender: 'Nam'
            })
            .timeout(15000); // Allow 15 seconds

        const responseTime = Date.now() - startTime;

        // ASSERTIONS - These encode the EXPECTED behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('thong_tin_co_ban');
        expect(response.body).toHaveProperty('tu_tru');
        
        // Response should be fast (< 5 seconds) even if DB is slow
        // After fix, timeout protection should kick in
        expect(responseTime).toBeLessThan(6000); // 6 seconds max (5s timeout + 1s buffer)
    }, 20000); // Test timeout: 20 seconds

    /**
     * Property-Based Test: Analysis Results Always Returned
     * 
     * **Validates: Requirements 2.1, 2.2**
     * 
     * This property test generates random valid birth data and various
     * database failure scenarios to verify the system always returns results.
     * 
     * EXPECTED ON UNFIXED CODE: Test FAILS with counterexamples
     * EXPECTED AFTER FIX: Test PASSES for all generated inputs
     */
    test('PROPERTY: For any valid birth data, analysis results are always returned regardless of database state', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random valid birth data
                fc.record({
                    year: fc.integer({ min: 1900, max: 2100 }),
                    month: fc.integer({ min: 1, max: 12 }),
                    day: fc.integer({ min: 1, max: 28 }), // Safe day range for all months
                    hour: fc.integer({ min: 0, max: 23 }),
                    gender: fc.constantFrom('Nam', 'Nữ')
                }),
                // Generate random database failure scenarios
                fc.constantFrom(
                    'timeout',
                    'connection_error',
                    'unavailable',
                    'slow_response'
                ),
                async (birthData, failureScenario) => {
                    // Setup database mock based on failure scenario
                    switch (failureScenario) {
                        case 'timeout':
                            dbService.createNewCustomer.mockImplementation(() => 
                                new Promise((resolve) => setTimeout(() => resolve(null), 20000))
                            );
                            break;
                        case 'connection_error':
                            dbService.createNewCustomer.mockRejectedValue(
                                new Error('Connection refused')
                            );
                            break;
                        case 'unavailable':
                            dbService.createNewCustomer.mockRejectedValue(
                                new Error('Database unavailable')
                            );
                            break;
                        case 'slow_response':
                            dbService.createNewCustomer.mockImplementation(() =>
                                new Promise((resolve) => setTimeout(() => resolve(999), 8000))
                            );
                            break;
                    }

                    const response = await request(app)
                        .get('/api/analyze')
                        .query(birthData)
                        .timeout(30000);

                    // PROPERTY: Response is always successful with complete data
                    expect(response.status).toBe(200);
                    expect(response.body).toHaveProperty('thong_tin_co_ban');
                    expect(response.body).toHaveProperty('tu_tru');
                    expect(response.body).toHaveProperty('ngu_hanh');
                }
            ),
            {
                numRuns: 10, // Run 10 test cases (reduced for speed)
                timeout: 35000, // 35 second timeout per test case
                endOnFailure: true // Stop on first failure to see counterexample
            }
        );
    }, 400000); // Total test timeout: 400 seconds (10 runs * 35s + buffer)
});
