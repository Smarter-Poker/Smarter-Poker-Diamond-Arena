export default {
    testEnvironment: 'node',
    transform: {},
    moduleFileExtensions: ['js', 'mjs'],
    testMatch: ['**/__tests__/**/*.test.js'],
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    // Lower thresholds since services are mocked (RPC integration tests)
    coverageThreshold: {
        global: {
            branches: 30,
            functions: 30,
            lines: 30,
            statements: 30
        },
        // DiamondMintEngine requires high coverage (pure logic)
        './src/engines/DiamondMintEngine.js': {
            branches: 80,
            functions: 90,
            lines: 90,
            statements: 90
        },
        // StreakBonusEngine has RPC calls, lower threshold
        './src/engines/StreakBonusEngine.js': {
            branches: 40,
            functions: 60,
            lines: 50,
            statements: 50
        }
    }
};
