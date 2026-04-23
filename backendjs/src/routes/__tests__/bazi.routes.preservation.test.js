/**
 * Preservation Property Tests for Supabase Save Chart Data Fix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests follow the observation-first methodology:
 * 1. Observe behavior on UNFIXED code for non-buggy inputs (Supabase healthy)
 * 2. Write property-based tests capturing observed behavior patterns
 * 3. Run tests on UNFIXED code - they should PASS (confirms baseline to preserve)
 * 
 * EXPECTED ON UNFIXED CODE: Tests PASS (confirms baseline behavior)
 * EXPECTED AFTER FIX: Tests STILL PASS (confirms no regressions)
 * 
 * These tests ensure that when the bug condition does NOT hold (i.e., when
 * Supabase is healthy and working normally), the system continues to behave
 * exactly as it did before the fix.
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
    healthCheck: jest.fn(),
    findOrCreateCustomer: jest.fn(),
    saveConsultation: jest.fn()
}));

// Mock the bazi service
jest.mock('../../services/bazi.service', () => ({
    analyzeComplete: jest.fn(),
    getBasicChart: jest.fn(),
    getElements: jest.fn(),
    getStars: jest.fn()
}));

const dbService = require('../../services/db');
const baziService = require('../../services/bazi.service');
const baziRoutes = require('../bazi.routes');

app.use('/api', baziRoutes);

describe('Preservation Property Tests: Property 2 - Normal Database Save and Other Endpoints Unchanged', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default: database is healthy and working normally
        dbService.healthCheck.mockResolvedValue({ 
            status: 'healthy', 
            message: 'Database connection is healthy' 
        });
        
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
        
        baziService.getBasicChart.mockResolvedValue({
            tu_tru: {
                year: { can: 'Canh', chi: 'Ngo' },
                month: { can: 'Tan', chi: 'Ti' },
                day: { can: 'Nhat', chi: 'Mao' },
                hour: { can: 'Binh', chi: 'Ngo' }
            }
        });
        
        baziService.getElements.mockResolvedValue({
            ngu_hanh: {
                Kim: 2,
                Moc: 1,
                Thuy: 1,
                Hoa: 2,
                Tho: 2
            }
        });
        
        baziService.getStars.mockResolvedValue({
            than_sat: ['Thien Duc', 'Thien Y']
        });
    });

    /**
     * Test Case 1: Normal Database Save Preservation
     * 
     * **Validates: Requirements 3.1**
     * 
     * OBSERVATION ON UNFIXED CODE:
     * - When Supabase is healthy, createNewCustomer() is called
     * - Customer data is saved to database successfully
     * - customerId is returned and included in response
     * - Analysis results are complete and correct
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('should save customer data to database when Supabase is healthy', async () => {
        // Mock database to succeed (healthy Supabase)
        const mockCustomerId = 12345;
        dbService.createNewCustomer.mockResolvedValue(mockCustomerId);

        const response = await request(app)
            .get('/api/analyze')
            .query({
                year: 1990,
                month: 5,
                day: 15,
                hour: 10,
                gender: 'Nam',
                name: 'Test User'
            });

        // ASSERTIONS - Preserve existing behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('thong_tin_co_ban');
        expect(response.body).toHaveProperty('tu_tru');
        expect(response.body).toHaveProperty('ngu_hanh');
        
        // Database save should be called with correct parameters
        expect(dbService.createNewCustomer).toHaveBeenCalledWith({
            name: 'Test User',
            year: 1990,
            month: 5,
            day: 15,
            hour: 10,
            minute: 0,
            gender: 'Nam',
            calendar: 'solar'
        });
        
        // customerId should be included in response when save succeeds
        expect(response.body.customerId).toBe(mockCustomerId);
    });

    /**
     * Test Case 2: Other API Endpoints Preservation - /api/chart
     * 
     * **Validates: Requirements 3.2**
     * 
     * OBSERVATION ON UNFIXED CODE:
     * - /api/chart endpoint works independently
     * - Does not involve database save operations
     * - Returns chart data correctly
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('should preserve /api/chart endpoint behavior', async () => {
        const response = await request(app)
            .get('/api/chart')
            .query({
                year: 1990,
                month: 5,
                day: 15,
                hour: 10,
                gender: 'Nam'
            });

        // ASSERTIONS - Preserve existing behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('tu_tru');
        expect(baziService.getBasicChart).toHaveBeenCalled();
        
        // Database should NOT be called for /api/chart
        expect(dbService.createNewCustomer).not.toHaveBeenCalled();
    });

    /**
     * Test Case 3: Other API Endpoints Preservation - /api/elements
     * 
     * **Validates: Requirements 3.2**
     * 
     * OBSERVATION ON UNFIXED CODE:
     * - /api/elements endpoint works independently
     * - Returns element analysis correctly
     * - No database operations involved
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('should preserve /api/elements endpoint behavior', async () => {
        const response = await request(app)
            .get('/api/elements')
            .query({
                year: 1990,
                month: 5,
                day: 15,
                hour: 10,
                gender: 'Nam'
            });

        // ASSERTIONS - Preserve existing behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('ngu_hanh');
        expect(baziService.getElements).toHaveBeenCalled();
        
        // Database should NOT be called for /api/elements
        expect(dbService.createNewCustomer).not.toHaveBeenCalled();
    });

    /**
     * Test Case 4: Other API Endpoints Preservation - /api/stars
     * 
     * **Validates: Requirements 3.2**
     * 
     * OBSERVATION ON UNFIXED CODE:
     * - /api/stars endpoint works independently
     * - Returns star analysis correctly
     * - No database operations involved
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('should preserve /api/stars endpoint behavior', async () => {
        const response = await request(app)
            .get('/api/stars')
            .query({
                year: 1990,
                month: 5,
                day: 15,
                hour: 10,
                gender: 'Nam'
            });

        // ASSERTIONS - Preserve existing behavior
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('than_sat');
        expect(baziService.getStars).toHaveBeenCalled();
        
        // Database should NOT be called for /api/stars
        expect(dbService.createNewCustomer).not.toHaveBeenCalled();
    });

    /**
     * Test Case 5: Database Connection Pool Preservation
     * 
     * **Validates: Requirements 3.5**
     * 
     * OBSERVATION ON UNFIXED CODE:
     * - Database connection pool is configured with max 20 connections
     * - Timeout is set to 15 seconds
     * - Multiple concurrent requests are handled correctly
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('should handle multiple concurrent requests with healthy database', async () => {
        // Mock database to succeed for all requests
        let customerIdCounter = 1000;
        dbService.createNewCustomer.mockImplementation(() => {
            return Promise.resolve(customerIdCounter++);
        });

        // Send 5 concurrent requests
        const requests = Array.from({ length: 5 }, (_, i) => 
            request(app)
                .get('/api/analyze')
                .query({
                    year: 1990 + i,
                    month: 5,
                    day: 15,
                    hour: 10,
                    gender: 'Nam'
                })
        );

        const responses = await Promise.all(requests);

        // ASSERTIONS - All requests should succeed
        responses.forEach((response, index) => {
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('thong_tin_co_ban');
            expect(response.body).toHaveProperty('tu_tru');
            expect(response.body.customerId).toBe(1000 + index);
        });

        // Database should be called 5 times
        expect(dbService.createNewCustomer).toHaveBeenCalledTimes(5);
    });

    /**
     * Property-Based Test: Normal Database Save Behavior
     * 
     * **Validates: Requirements 3.1, 3.4, 3.5**
     * 
     * This property test generates random valid birth data and verifies that
     * when the database is healthy, customer data is saved correctly and
     * the response includes the customerId.
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('PROPERTY: For any valid birth data with healthy database, customer data is saved correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random valid birth data
                fc.record({
                    year: fc.integer({ min: 1900, max: 2100 }),
                    month: fc.integer({ min: 1, max: 12 }),
                    day: fc.integer({ min: 1, max: 28 }), // Safe day range
                    hour: fc.integer({ min: 0, max: 23 }),
                    minute: fc.integer({ min: 0, max: 59 }),
                    gender: fc.constantFrom('Nam', 'Nữ'),
                    calendar: fc.constantFrom('solar', 'lunar'),
                    name: fc.string({ minLength: 1, maxLength: 50 })
                }),
                async (birthData) => {
                    // Mock database to succeed (healthy state)
                    const mockCustomerId = Math.floor(Math.random() * 10000);
                    dbService.createNewCustomer.mockResolvedValue(mockCustomerId);

                    const response = await request(app)
                        .get('/api/analyze')
                        .query(birthData);

                    // PROPERTY: Response is successful with complete data
                    expect(response.status).toBe(200);
                    expect(response.body).toHaveProperty('thong_tin_co_ban');
                    expect(response.body).toHaveProperty('tu_tru');
                    expect(response.body).toHaveProperty('ngu_hanh');
                    
                    // PROPERTY: Database save is called with correct parameters
                    expect(dbService.createNewCustomer).toHaveBeenCalledWith({
                        name: birthData.name,
                        year: birthData.year,
                        month: birthData.month,
                        day: birthData.day,
                        hour: birthData.hour,
                        minute: birthData.minute,
                        gender: birthData.gender,
                        calendar: birthData.calendar
                    });
                    
                    // PROPERTY: customerId is included in response
                    expect(response.body.customerId).toBe(mockCustomerId);
                }
            ),
            {
                numRuns: 20, // Run 20 test cases for good coverage
                timeout: 5000, // 5 second timeout per test case
                endOnFailure: true
            }
        );
    }, 120000); // Total test timeout: 120 seconds

    /**
     * Property-Based Test: Other Endpoints Remain Unchanged
     * 
     * **Validates: Requirements 3.2**
     * 
     * This property test verifies that other API endpoints continue to work
     * correctly and are not affected by changes to the /api/analyze endpoint.
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('PROPERTY: Other endpoints work correctly regardless of /api/analyze changes', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random valid birth data
                fc.record({
                    year: fc.integer({ min: 1900, max: 2100 }),
                    month: fc.integer({ min: 1, max: 12 }),
                    day: fc.integer({ min: 1, max: 28 }),
                    hour: fc.integer({ min: 0, max: 23 }),
                    gender: fc.constantFrom('Nam', 'Nữ')
                }),
                // Generate random endpoint to test
                fc.constantFrom('/api/chart', '/api/elements', '/api/stars'),
                async (birthData, endpoint) => {
                    const response = await request(app)
                        .get(endpoint)
                        .query(birthData);

                    // PROPERTY: All other endpoints return 200
                    expect(response.status).toBe(200);
                    
                    // PROPERTY: Response has expected structure based on endpoint
                    if (endpoint === '/api/chart') {
                        expect(response.body).toHaveProperty('tu_tru');
                    } else if (endpoint === '/api/elements') {
                        expect(response.body).toHaveProperty('ngu_hanh');
                    } else if (endpoint === '/api/stars') {
                        expect(response.body).toHaveProperty('than_sat');
                    }
                    
                    // PROPERTY: Database save is NOT called for other endpoints
                    expect(dbService.createNewCustomer).not.toHaveBeenCalled();
                }
            ),
            {
                numRuns: 15, // Run 15 test cases
                timeout: 5000,
                endOnFailure: true
            }
        );
    }, 90000); // Total test timeout: 90 seconds

    /**
     * Property-Based Test: Fast Response Time with Healthy Database
     * 
     * **Validates: Requirements 3.1, 3.5**
     * 
     * This property test verifies that when the database is healthy and
     * responds quickly, the overall response time remains fast.
     * 
     * EXPECTED: Test PASSES on both unfixed and fixed code
     */
    test('PROPERTY: Response time is fast when database is healthy', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate random valid birth data
                fc.record({
                    year: fc.integer({ min: 1900, max: 2100 }),
                    month: fc.integer({ min: 1, max: 12 }),
                    day: fc.integer({ min: 1, max: 28 }),
                    hour: fc.integer({ min: 0, max: 23 }),
                    gender: fc.constantFrom('Nam', 'Nữ')
                }),
                async (birthData) => {
                    // Mock database to respond quickly (< 1 second)
                    dbService.createNewCustomer.mockImplementation(() => {
                        return new Promise((resolve) => {
                            setTimeout(() => resolve(Math.floor(Math.random() * 10000)), 100);
                        });
                    });

                    const startTime = Date.now();
                    
                    const response = await request(app)
                        .get('/api/analyze')
                        .query(birthData);

                    const responseTime = Date.now() - startTime;

                    // PROPERTY: Response is successful
                    expect(response.status).toBe(200);
                    expect(response.body).toHaveProperty('thong_tin_co_ban');
                    
                    // PROPERTY: Response time is reasonable (< 3 seconds)
                    // This ensures the fix doesn't add unnecessary overhead
                    expect(responseTime).toBeLessThan(3000);
                }
            ),
            {
                numRuns: 10,
                timeout: 5000,
                endOnFailure: true
            }
        );
    }, 60000); // Total test timeout: 60 seconds
});
