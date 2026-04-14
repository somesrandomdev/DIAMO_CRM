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
