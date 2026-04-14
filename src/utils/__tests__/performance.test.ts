import {
  debounce,
  throttle,
  memoize,
  formatFileSize,
  calculateVirtualScroll,
  Cache,
  measurePerformance,
  rafThrottle,
  batchDOMUpdates,
  isMobile,
  isTouchDevice,
  getNetworkInfo,
  optimizeImageForNetwork
} from '../performance';

describe('Performance Utilities', () => {
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution until after wait milliseconds', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset the delay if called again within the wait time', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);

      debouncedFn(); // Resets timer
      jest.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled(); // 100ms total elapsed, but only 50ms since last call

      jest.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1); // 100ms since last call
    });

    it('should pass the latest arguments to the debounced function', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn(1, 'a');
      debouncedFn(2, 'b');

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith(2, 'b');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should execute the function immediately on the first call', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should prevent execution if called within the wait time', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      throttledFn();
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(99);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1); // Total 100ms
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to the throttled function', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn(1, 'a');
      expect(mockFn).toHaveBeenCalledWith(1, 'a');

      // These won't be called
      throttledFn(2, 'b');

      jest.advanceTimersByTime(100);

      throttledFn(3, 'c');
      expect(mockFn).toHaveBeenCalledWith(3, 'c');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoize', () => {
    it('should cache results based on arguments', () => {
      const mockFn = jest.fn((a: number, b: number) => a + b);
      const memoizedFn = memoize(mockFn);

      expect(memoizedFn(1, 2)).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(1);

      expect(memoizedFn(1, 2)).toBe(3);
      expect(mockFn).toHaveBeenCalledTimes(1); // Not called again

      expect(memoizedFn(2, 3)).toBe(5);
      expect(mockFn).toHaveBeenCalledTimes(2); // Called with new args
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes to appropriate units', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1500)).toBe('1.46 KB'); // Rounds to 2 decimal places
    });
  });

  describe('calculateVirtualScroll', () => {
    it('should calculate visible start and end indices correctly', () => {
      const options = {
        itemCount: 1000,
        itemHeight: 50,
        containerHeight: 500,
        scrollTop: 200,
      };

      const result = calculateVirtualScroll(options);

      // scrollTop (200) / itemHeight (50) = 4
      expect(result.visibleStartIndex).toBe(4);

      // visibleStartIndex (4) + ceil(containerHeight (500) / itemHeight (50)) (10) + 1 = 15
      expect(result.visibleEndIndex).toBe(15);

      // visibleStartIndex (4) * itemHeight (50) = 200
      expect(result.offsetY).toBe(200);
    });

    it('should bound visibleEndIndex by itemCount', () => {
      const options = {
        itemCount: 10,
        itemHeight: 50,
        containerHeight: 500,
        scrollTop: 200,
      };

      const result = calculateVirtualScroll(options);

      // visibleStartIndex (4) + ceil(500/50) (10) + 1 = 15, bounded by 10
      expect(result.visibleEndIndex).toBe(10);
    });
  });

  describe('Cache', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should store and retrieve values', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new Cache<string>();
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return null and delete item if TTL expires', () => {
      const cache = new Cache<string>(100);
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');

      jest.advanceTimersByTime(101);

      expect(cache.get('key1')).toBeNull();
      expect(cache.has('key1')).toBe(false); // Also deleted internally
    });

    it('should support custom TTL for specific items', () => {
      const cache = new Cache<string>(100);
      cache.set('key1', 'value1', 200); // Override default TTL

      jest.advanceTimersByTime(150);

      expect(cache.get('key1')).toBe('value1'); // Still valid

      jest.advanceTimersByTime(51);

      expect(cache.get('key1')).toBeNull(); // Expired
    });

    it('should delete items', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all items', () => {
      const cache = new Cache<string>();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should cleanup expired items', () => {
      const cache = new Cache<string>(100);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2', 200);

      jest.advanceTimersByTime(150);

      cache.cleanup();

      // We can't easily check the private Map size directly without reflection or exposing it,
      // but we can verify the behavior.
      expect(cache.has('key1')).toBe(false); // Cleaned up
      expect(cache.has('key2')).toBe(true);  // Still valid
    });
  });

  describe('measurePerformance', () => {
    let consoleSpy: jest.SpyInstance;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.useFakeTimers();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      jest.useRealTimers();
      process.env.NODE_ENV = originalEnv;
    });

    it('should return the result of the function', async () => {
      process.env.NODE_ENV = 'development';
      const fn = jest.fn().mockResolvedValue('result');
      const result = await measurePerformance('test', fn);
      expect(result).toBe('result');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should throw if the function throws', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('test error');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(measurePerformance('test', fn)).rejects.toThrow('test error');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('rafThrottle', () => {
    beforeEach(() => {
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        cb(0);
        return 1;
      });
      jest.spyOn(window, 'cancelAnimationFrame').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should execute the callback via requestAnimationFrame', () => {
      const mockFn = jest.fn();
      const throttledFn = rafThrottle(mockFn);

      throttledFn();
      expect(window.requestAnimationFrame).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous frame if called multiple times', () => {
      // Need a custom mock to simulate the frame not firing immediately
      let nextFrameId = 1;
      let pendingCallback: FrameRequestCallback | null = null;

      jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        pendingCallback = cb;
        return nextFrameId++;
      });

      const mockFn = jest.fn();
      const throttledFn = rafThrottle(mockFn);

      throttledFn();
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);

      throttledFn();
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1); // First frame ID
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);

      // Simulate frame firing
      if (pendingCallback) pendingCallback(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('batchDOMUpdates', () => {
    beforeEach(() => {
      jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        cb(0);
        return 1;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should execute all updates in a single animation frame', () => {
      const update1 = jest.fn();
      const update2 = jest.fn();

      batchDOMUpdates([update1, update2]);

      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(update1).toHaveBeenCalledTimes(1);
      expect(update2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Device & Network Helpers', () => {
    let originalUserAgent: string;
    let originalTouchPoints: number;

    beforeEach(() => {
      originalUserAgent = navigator.userAgent;
      originalTouchPoints = navigator.maxTouchPoints;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: originalTouchPoints,
        configurable: true,
      });
      // Clean up connection mock if it was set
      if ((navigator as any).connection) {
        delete (navigator as any).connection;
      }
    });

    describe('isMobile', () => {
      it('should return true for mobile user agents', () => {
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
          configurable: true,
        });
        expect(isMobile()).toBe(true);
      });

      it('should return false for desktop user agents', () => {
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          configurable: true,
        });
        expect(isMobile()).toBe(false);
      });
    });

    describe('isTouchDevice', () => {
      it('should return true if maxTouchPoints > 0', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
          value: 1,
          configurable: true,
        });
        expect(isTouchDevice()).toBe(true);
      });
    });

    describe('getNetworkInfo', () => {
      it('should return network info if available', () => {
        (navigator as any).connection = {
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false,
        };

        expect(getNetworkInfo()).toEqual({
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false,
        });
      });

      it('should return null if not available', () => {
        expect(getNetworkInfo()).toBeNull();
      });
    });

    describe('optimizeImageForNetwork', () => {
      it('should return original src if no network info', () => {
        expect(optimizeImageForNetwork('image.jpg')).toBe('image.jpg');
      });

      it('should append quality params for slow connections on supported CDNs', () => {
        (navigator as any).connection = {
          effectiveType: '2g',
          saveData: true,
        };

        expect(optimizeImageForNetwork('https://res.cloudinary.com/image.jpg')).toBe('https://res.cloudinary.com/image.jpg?q=50&w=400');
        expect(optimizeImageForNetwork('https://imgix.net/image.jpg?existing=param')).toBe('https://imgix.net/image.jpg?existing=param&q=50&w=400');
      });

      it('should not append params for fast connections', () => {
        (navigator as any).connection = {
          effectiveType: '4g',
          saveData: false,
        };

        expect(optimizeImageForNetwork('https://res.cloudinary.com/image.jpg')).toBe('https://res.cloudinary.com/image.jpg');
      });
    });
  });
});
