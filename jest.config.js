/**
 * Jest runs in CommonJS mode (not ESM). This matters: with `useESM: true` the
 * `jest` global is not injected into setup files and `jest.mock()` is not
 * hoisted above imports, which made every suite fail with
 * "ReferenceError: jest is not defined".
 */
export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          // The app's tsconfig sets verbatimModuleSyntax, which is incompatible
          // with the CommonJS emit ts-jest needs here.
          verbatimModuleSyntax: false,
          // The root tsconfig.json is solution-style (references only) and
          // carries no `paths`, so ts-jest cannot resolve "@/..." on its own.
          // moduleNameMapper handles resolution at runtime; this handles types.
          baseUrl: '.',
          paths: { '@/*': ['./src/*'] },
        },
      },
    ],
  },
  moduleNameMapper: {
    // Le stub DOIT précéder le catch-all '@/...' (sinon le vrai fichier,
    // qui contient import.meta.env, casse ts-jest CJS).
    '^@/lib/restConfig$': '<rootDir>/src/lib/__tests__/restConfig.stub.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  // lucide-react ships ESM only; let Babel/ts-jest transform it instead of
  // treating it as an opaque CommonJS dependency.
  transformIgnorePatterns: ['node_modules/(?!(lucide-react)/)'],
}
