import { getEnvConfig, useEnv, validateEnv, getFeatureFlag } from '../env';

describe('env utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getEnvConfig', () => {
    it('should parse valid environment variables correctly', () => {
      process.env.MODE = 'production';
      process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
      process.env.VITE_APP_URL = 'https://example.com';

      const config = getEnvConfig();

      expect(config.supabaseUrl).toBe('https://example.supabase.co');
      expect(config.supabaseAnonKey).toBe('test-key');
      expect(config.appUrl).toBe('https://example.com');
      expect(config.nodeEnv).toBe('production');
      expect(config.isDevelopment).toBe(false);
      expect(config.isProduction).toBe(true);
      expect(config.isTest).toBe(false);
    });

    it('should use default values for missing optional variables', () => {
      process.env.MODE = undefined;
      process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
      process.env.VITE_APP_URL = 'https://example.com';

      const config = getEnvConfig();
      expect(config.nodeEnv).toBe('development');
    });

    it('should throw an error for missing required variables', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = undefined;

      expect(() => getEnvConfig()).toThrow('Missing required environment variable: VITE_SUPABASE_ANON_KEY');
    });

    it('should throw an error for invalid URLs', () => {
      process.env.VITE_SUPABASE_URL = 'invalid-url';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

      expect(() => getEnvConfig()).toThrow('Invalid URL for environment variable: VITE_SUPABASE_URL');
    });
  });

  describe('useEnv', () => {
    it('should return the same config instance', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
      process.env.VITE_APP_URL = 'https://example.com';

      const config1 = useEnv();
      const config2 = useEnv();

      expect(config1).toBe(config2);
    });
  });

  describe('validateEnv', () => {
    it('should not throw if environment is valid', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
      process.env.VITE_APP_URL = 'https://example.com';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should throw if environment is invalid', () => {
      process.env.VITE_SUPABASE_URL = undefined;
      process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

      expect(() => validateEnv()).toThrow('Missing required environment variable: VITE_SUPABASE_URL');
    });
  });

  describe('getFeatureFlag', () => {
    it('should return true if flag is set to "true"', () => {
      process.env.VITE_FEATURE_TEST_FLAG = 'true';
      expect(getFeatureFlag('test_flag')).toBe(true);
    });

    it('should return true if flag is set to "1"', () => {
      process.env.VITE_FEATURE_TEST_FLAG = '1';
      expect(getFeatureFlag('test_flag')).toBe(true);
    });

    it('should return default value if flag is not set', () => {
      process.env.VITE_FEATURE_TEST_FLAG = undefined;
      expect(getFeatureFlag('test_flag', true)).toBe(true);
      expect(getFeatureFlag('test_flag', false)).toBe(false);
    });
  });
});
