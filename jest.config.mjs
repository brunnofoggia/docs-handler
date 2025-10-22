export default {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    modulePaths: ['<rootDir>'],
    testRegex: '\\.spec\\.ts$',
    moduleNameMapper: {
        '@test/(.*)': '<rootDir>/../test/$1',
        // esm config
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    globalTeardown: '<rootDir>/../test/setup/down.ts',
    /* presets: https://kulshekhar.github.io/ts-jest/docs/next/getting-started/presets */
    preset: 'ts-jest/presets/js-with-babel',
    transform: {
        '^.+node_modules/uuid/.+\\.js$': [
            'babel-jest',
            {
                presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
                sourceType: 'unambiguous',
            },
        ],
        '^.+\\.jsx?$': [
            'babel-jest',
            {
                tsconfig: {
                    allowSyntheticDefaultImports: true,
                    declaration: true,
                    esModuleInterop: true,
                    lib: ['esnext'],
                    module: 'commonjs',
                    moduleResolution: 'node',
                    outDir: 'build',
                    sourceMap: true,
                    target: 'es6',
                    strictNullChecks: false,
                    noImplicitAny: false,
                },
            },
        ],
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: {
                    allowSyntheticDefaultImports: true,
                    declaration: true,
                    esModuleInterop: true,
                    lib: ['esnext'],
                    module: 'es2020',
                    moduleResolution: 'node',
                    outDir: 'dist',
                    sourceMap: true,
                    strictNullChecks: true,
                    target: 'ES2020',
                    strictNullChecks: false,
                    noImplicitAny: false,
                },
            },
        ],
    },
};
