/**
 * Supabase 连接器单元测试
 */

import { SupabaseConnector } from '../supabase-connector';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('SupabaseConnector', () => {
  let connector: SupabaseConnector;
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabaseClient);

    connector = new SupabaseConnector({
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    it('应该正确初始化配置', () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      const newConnector = new SupabaseConnector(config);
      expect(newConnector).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('应该成功初始化 Supabase 客户端', async () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      await connector.initialize(config);

      const { createClient } = require('@supabase/supabase-js');
      expect(createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
      expect(console.log).toHaveBeenCalledWith('✅ Supabase database initialized');
    });

    it('应该使用环境变量作为默认配置', async () => {
      const originalEnv = process.env;
      process.env = {
        SUPABASE_URL: 'https://env.supabase.co',
        SUPABASE_ANON_KEY: 'env-anon-key',
      };

      const envConnector = new SupabaseConnector({});
      await envConnector.initialize({});

      const { createClient } = require('@supabase/supabase-js');
      expect(createClient).toHaveBeenCalledWith('https://env.supabase.co', 'env-anon-key');

      process.env = originalEnv;
    });

    it('应该优先使用传入的配置而非环境变量', async () => {
      const originalEnv = process.env;
      process.env = {
        SUPABASE_URL: 'https://env.supabase.co',
        SUPABASE_ANON_KEY: 'env-anon-key',
      };

      const config = {
        url: 'https://override.supabase.co',
        anonKey: 'override-anon-key',
      };

      await connector.initialize(config);

      const { createClient } = require('@supabase/supabase-js');
      expect(createClient).toHaveBeenCalledWith('https://override.supabase.co', 'override-anon-key');

      process.env = originalEnv;
    });

    it('应该处理初始化失败', async () => {
      const { createClient } = require('@supabase/supabase-js');
      createClient.mockImplementation(() => {
        throw new Error('Supabase initialization failed');
      });

      const config = {
        url: 'https://invalid.supabase.co',
        anonKey: 'invalid-key',
      };

      await expect(connector.initialize(config)).rejects.toThrow('Supabase initialization failed');
      expect(console.error).toHaveBeenCalledWith('❌ Failed to initialize Supabase:', expect.any(Error));
    });

    it('应该处理模块导入失败', async () => {
      // Mock require to throw error for Supabase module
      const originalRequire = require;
      jest.doMock('@supabase/supabase-js', () => {
        throw new Error('Module not found');
      });

      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      await expect(connector.initialize(config)).rejects.toThrow('Module not found');

      // Restore mock
      jest.resetModules();
    });
  });

  describe('getClient', () => {
    it('应该在初始化后返回客户端实例', async () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      await connector.initialize(config);
      const client = connector.getClient();

      expect(client).toBe(mockSupabaseClient);
    });

    it('应该在未初始化时抛出错误', () => {
      expect(() => {
        connector.getClient();
      }).toThrow('Supabase client not initialized. Call initialize() first.');
    });
  });

  describe('testConnection', () => {
    beforeEach(async () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };
      await connector.initialize(config);
    });

    it('应该在连接正常时返回 true', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await connector.testConnection();

      expect(result).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('_health_check');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('count');
      expect(mockSupabaseClient.from().select().limit).toHaveBeenCalledWith(1);
    });

    it('应该在连接失败时返回 false', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Connection failed' } }),
        }),
      });

      const result = await connector.testConnection();

      expect(result).toBe(false);
    });

    it('应该在客户端未初始化时返回 false', async () => {
      const uninitializedConnector = new SupabaseConnector({});
      const result = await uninitializedConnector.testConnection();

      expect(result).toBe(false);
    });

    it('应该处理网络错误', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Network error')),
        }),
      });

      const result = await connector.testConnection();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Supabase connection test failed:', expect.any(Error));
    });
  });

  describe('close', () => {
    it('应该成功关闭连接', async () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      await connector.initialize(config);
      await connector.close();

      expect(console.log).toHaveBeenCalledWith('✅ Supabase connection closed');

      // 确保客户端已被清空
      expect(() => {
        connector.getClient();
      }).toThrow('Supabase client not initialized. Call initialize() first.');
    });

    it('应该在未初始化时也能调用 close', async () => {
      const uninitializedConnector = new SupabaseConnector({});

      await expect(uninitializedConnector.close()).resolves.not.toThrow();
      expect(console.log).toHaveBeenCalledWith('✅ Supabase connection closed');
    });
  });

  describe('集成测试', () => {
    it('应该支持完整的连接生命周期', async () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      // 初始化
      await connector.initialize(config);
      expect(connector.getClient()).toBeDefined();

      // 测试连接
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      const isHealthy = await connector.testConnection();
      expect(isHealthy).toBe(true);

      // 关闭连接
      await connector.close();
      expect(() => connector.getClient()).toThrow();
    });
  });

  describe('错误恢复', () => {
    it('应该能从初始化失败中恢复', async () => {
      const { createClient } = require('@supabase/supabase-js');

      // 第一次初始化失败
      createClient.mockImplementationOnce(() => {
        throw new Error('First initialization failed');
      });

      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      await expect(connector.initialize(config)).rejects.toThrow('First initialization failed');

      // 第二次初始化成功
      createClient.mockImplementationOnce(() => mockSupabaseClient);
      await expect(connector.initialize(config)).resolves.not.toThrow();

      expect(connector.getClient()).toBe(mockSupabaseClient);
    });
  });

  describe('并发处理', () => {
    it('应该能处理并发的连接测试', async () => {
      const config = {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      };

      await connector.initialize(config);

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      // 创建多个并发连接测试
      const promises = Array(10).fill(null).map(() => connector.testConnection());
      const results = await Promise.all(promises);

      // 所有测试都应该成功
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });
});