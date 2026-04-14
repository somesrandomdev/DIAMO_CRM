import { getEnvConfig, useEnv, validateEnv, getFeatureFlag } from '../env'

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getEnvUrl', () => {
    it('should throw an error for an invalid URL', () => {
      process.env.VITE_SUPABASE_URL = 'invalid-url'
      process.env.VITE_SUPABASE_ANON_KEY = 'some-key'

      expect(() => {
        getEnvConfig()
      }).toThrow('Invalid URL for environment variable: VITE_SUPABASE_URL')
    })

    it('should return the URL if valid', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.com'
      process.env.VITE_SUPABASE_ANON_KEY = 'some-key'

      const config = getEnvConfig()
      expect(config.supabaseUrl).toBe('https://example.com')
    })
  })

  describe('getRequiredEnv', () => {
    it('should throw an error if a required environment variable is missing', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.com'
      delete process.env.VITE_SUPABASE_ANON_KEY

      expect(() => {
        getEnvConfig()
      }).toThrow('Missing required environment variable: VITE_SUPABASE_ANON_KEY')
    })
  })

  describe('validateEnv', () => {
    it('should pass and log success if environment is valid', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.com'
      process.env.VITE_SUPABASE_ANON_KEY = 'some-key'
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      validateEnv()

      expect(consoleSpy).toHaveBeenCalledWith('✓ Environment configuration validated')
      consoleSpy.mockRestore()
    })

    it('should fail and log error if environment is invalid', () => {
      process.env.VITE_SUPABASE_URL = 'invalid-url'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        validateEnv()
      }).toThrow('Invalid URL for environment variable: VITE_SUPABASE_URL')

      expect(consoleSpy).toHaveBeenCalledWith('✗ Environment configuration error:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('useEnv', () => {
    it('should lazy load the config', () => {
      process.env.VITE_SUPABASE_URL = 'https://example.com'
      process.env.VITE_SUPABASE_ANON_KEY = 'some-key'

      const config1 = useEnv()
      const config2 = useEnv()

      expect(config1).toBe(config2)
      expect(config1.supabaseUrl).toBe('https://example.com')
    })
  })

  describe('getFeatureFlag', () => {
    it('should return true if flag is true', () => {
      process.env.VITE_FEATURE_TEST_FLAG = 'true'
      expect(getFeatureFlag('test_flag')).toBe(true)
    })

    it('should return true if flag is 1', () => {
      process.env.VITE_FEATURE_TEST_FLAG = '1'
      expect(getFeatureFlag('test_flag')).toBe(true)
    })

    it('should return default value if flag is not set', () => {
      expect(getFeatureFlag('unset_flag', true)).toBe(true)
      expect(getFeatureFlag('unset_flag', false)).toBe(false)
    })
  })
})
import { getEnvConfig, useEnv, validateEnv } from '../env';

describe('env utils', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('getEnvConfig', () => {
    it('returns config when required vars are present', () => {
      const config = getEnvConfig();
      expect(config.supabaseUrl).toBe('https://example.supabase.co');
      expect(config.supabaseAnonKey).toBe('test-anon-key');
      expect(config.nodeEnv).toBe('test');
    });
  });

  describe('useEnv', () => {
    it('returns the same config on multiple calls', () => {
      const config1 = useEnv();
      const config2 = useEnv();
      expect(config1).toBe(config2);
    });
  });

  describe('validateEnv', () => {
    it('logs success when env is valid', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      validateEnv();
      expect(consoleSpy).toHaveBeenCalledWith('✓ Environment configuration validated');
      consoleSpy.mockRestore();
    });
  });
});
