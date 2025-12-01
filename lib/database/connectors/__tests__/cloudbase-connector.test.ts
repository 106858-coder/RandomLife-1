/**
 * CloudBase 连接器单元测试
 */

import { CloudBaseConnector } from '../cloudbase-connector';

// Mock CloudBase SDK
jest.mock('@cloudbase/node-sdk', () => ({
  init: jest.fn(),
}));

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('CloudBaseConnector', () => {
  let connector: CloudBaseConnector;
  let mockCloudBaseApp: any;
  let mockDatabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();

    mockDatabase = {
      collection: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    };

    mockCloudBaseApp = {
      database: jest.fn().mockReturnValue(mockDatabase),
    };

    const cloudbase = require('@cloudbase/node-sdk');
    cloudbase.init.mockReturnValue(mockCloudBaseApp);

    connector = new CloudBaseConnector({
      envId: 'test-env-id',
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    it('应该正确初始化配置', () => {
      const config = {
        envId: 'test-env-id',
      };

      const newConnector = new CloudBaseConnector(config);
      expect(newConnector).toBeDefined();
    });
  });

  describe('initialize', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('应该成功初始化 CloudBase 客户端', async () => {
      const config = {
        envId: 'test-env-id',
      };

      await connector.initialize(config);

      const cloudbase = require('@cloudbase/node-sdk');
      expect(cloudbase.init).toHaveBeenCalledWith({
        env: 'test-env-id',
        secretId: undefined,
        secretKey: undefined,
      });
      expect(console.log).toHaveBeenCalledWith('✅ CloudBase database initialized');
    });

    it('应该使用环境变量作为默认配置', async () => {
      process.env = {
        WECHAT_CLOUDBASE_ID: 'env-test-id',
        CLOUDBASE_SECRET_ID: 'env-secret-id',
        CLOUDBASE_SECRET_KEY: 'env-secret-key',
      };

      const envConnector = new CloudBaseConnector({});
      await envConnector.initialize({});

      const cloudbase = require('@cloudbase/node-sdk');
      expect(cloudbase.init).toHaveBeenCalledWith({
        env: 'env-test-id',
        secretId: 'env-secret-id',
        secretKey: 'env-secret-key',
      });
    });

    it('应该优先使用传入的配置而非环境变量', async () => {
      process.env = {
        WECHAT_CLOUDBASE_ID: 'env-test-id',
        CLOUDBASE_SECRET_ID: 'env-secret-id',
        CLOUDBASE_SECRET_KEY: 'env-secret-key',
      };

      const config = {
        envId: 'override-test-id',
      };

      await connector.initialize(config);

      const cloudbase = require('@cloudbase/node-sdk');
      expect(cloudbase.init).toHaveBeenCalledWith({
        env: 'override-test-id',
        secretId: 'env-secret-id', // 环境变量仍然会被使用
        secretKey: 'env-secret-key',
      });
    });

    it('应该处理初始化失败', async () => {
      const cloudbase = require('@cloudbase/node-sdk');
      cloudbase.init.mockImplementation(() => {
        throw new Error('CloudBase initialization failed');
      });

      const config = {
        envId: 'invalid-env-id',
      };

      await expect(connector.initialize(config)).rejects.toThrow('CloudBase initialization failed');
      expect(console.error).toHaveBeenCalledWith('❌ Failed to initialize CloudBase:', expect.any(Error));
    });

    it('应该处理模块导入失败', async () => {
      // Mock require to throw error for CloudBase module
      jest.doMock('@cloudbase/node-sdk', () => {
        throw new Error('Module not found');
      });

      const config = {
        envId: 'test-env-id',
      };

      await expect(connector.initialize(config)).rejects.toThrow('Module not found');

      // Restore mock
      jest.resetModules();
    });
  });

  describe('getClient', () => {
    beforeEach(async () => {
      const config = {
        envId: 'test-env-id',
      };
      await connector.initialize(config);
    });

    it('应该在初始化后返回数据库实例', () => {
      const db = connector.getClient();

      expect(db).toBe(mockDatabase);
      expect(mockCloudBaseApp.database).toHaveBeenCalled();
    });

    it('应该在未初始化时抛出错误', () => {
      const uninitializedConnector = new CloudBaseConnector({});

      expect(() => {
        uninitializedConnector.getClient();
      }).toThrow('CloudBase client not initialized. Call initialize() first.');
    });

    it('应该每次调用都返回新的数据库实例', () => {
      const db1 = connector.getClient();
      const db2 = connector.getClient();

      expect(mockCloudBaseApp.database).toHaveBeenCalledTimes(2);
      expect(db1).toBe(mockDatabase);
      expect(db2).toBe(mockDatabase);
    });
  });

  describe('testConnection', () => {
    beforeEach(async () => {
      const config = {
        envId: 'test-env-id',
      };
      await connector.initialize(config);
    });

    it('应该在连接正常时返回 true', async () => {
      const result = await connector.testConnection();

      expect(result).toBe(true);
      expect(mockCloudBaseApp.database).toHaveBeenCalled();
      expect(mockDatabase.collection).toHaveBeenCalledWith('test');
      expect(mockDatabase.collection().limit).toHaveBeenCalled();
      expect(mockDatabase.collection().limit().get).toHaveBeenCalled();
    });

    it('应该在客户端未初始化时返回 false', async () => {
      const uninitializedConnector = new CloudBaseConnector({});
      const result = await uninitializedConnector.testConnection();

      expect(result).toBe(false);
    });

    it('应该处理数据库查询错误', async () => {
      mockDatabase.collection.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      });

      const result = await connector.testConnection();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('CloudBase connection test failed:', expect.any(Error));
    });

    it('应该处理权限错误', async () => {
      mockDatabase.collection.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValue(new Error('Permission denied')),
        }),
      });

      const result = await connector.testConnection();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('CloudBase connection test failed:', expect.any(Error));
    });
  });

  describe('close', () => {
    it('应该成功关闭连接', async () => {
      const config = {
        envId: 'test-env-id',
      };

      await connector.initialize(config);
      await connector.close();

      expect(console.log).toHaveBeenCalledWith('✅ CloudBase connection closed');

      // 确保客户端已被清空
      expect(() => {
        connector.getClient();
      }).toThrow('CloudBase client not initialized. Call initialize() first.');
    });

    it('应该在未初始化时也能调用 close', async () => {
      const uninitializedConnector = new CloudBaseConnector({});

      await expect(uninitializedConnector.close()).resolves.not.toThrow();
      expect(console.log).toHaveBeenCalledWith('✅ CloudBase connection closed');
    });
  });

  describe('集成测试', () => {
    it('应该支持完整的连接生命周期', async () => {
      const config = {
        envId: 'test-env-id',
      };

      // 初始化
      await connector.initialize(config);
      expect(connector.getClient()).toBeDefined();

      // 测试连接
      const isHealthy = await connector.testConnection();
      expect(isHealthy).toBe(true);

      // 获取数据库实例
      const db = connector.getClient();
      expect(db).toBe(mockDatabase);

      // 关闭连接
      await connector.close();
      expect(() => connector.getClient()).toThrow();
    });

    it('应该支持多次初始化和关闭', async () => {
      const config = {
        envId: 'test-env-id',
      };

      // 第一次初始化
      await connector.initialize(config);
      await connector.close();

      // 第二次初始化
      await connector.initialize(config);
      const db = connector.getClient();
      expect(db).toBeDefined();

      await connector.close();
    });
  });

  describe('错误恢复', () => {
    it('应该能从初始化失败中恢复', async () => {
      const cloudbase = require('@cloudbase/node-sdk');

      // 第一次初始化失败
      cloudbase.init.mockImplementationOnce(() => {
        throw new Error('First initialization failed');
      });

      const config = {
        envId: 'test-env-id',
      };

      await expect(connector.initialize(config)).rejects.toThrow('First initialization failed');

      // 第二次初始化成功
      cloudbase.init.mockImplementationOnce(() => mockCloudBaseApp);
      await expect(connector.initialize(config)).resolves.not.toThrow();

      expect(connector.getClient()).toBe(mockDatabase);
    });

    it('应该能从连接测试失败中恢复', async () => {
      const config = {
        envId: 'test-env-id',
      };

      await connector.initialize(config);

      // 第一次连接测试失败
      mockDatabase.collection.mockReturnValueOnce({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValueOnce(new Error('Temporary network error')),
        }),
      });

      const result1 = await connector.testConnection();
      expect(result1).toBe(false);

      // 第二次连接测试成功
      mockDatabase.collection.mockReturnValueOnce({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValueOnce({ data: [] }),
        }),
      });

      const result2 = await connector.testConnection();
      expect(result2).toBe(true);
    });
  });

  describe('并发处理', () => {
    it('应该能处理并发的连接测试', async () => {
      const config = {
        envId: 'test-env-id',
      };

      await connector.initialize(config);

      // 创建多个并发连接测试
      const promises = Array(10).fill(null).map(() => connector.testConnection());
      const results = await Promise.all(promises);

      // 所有测试都应该成功
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });

    it('应该能处理并发的数据库实例获取', async () => {
      const config = {
        envId: 'test-env-id',
      };

      await connector.initialize(config);

      // 创建多个并发数据库实例获取
      const promises = Array(10).fill(null).map(() => connector.getClient());
      const databases = await Promise.all(promises);

      // 所有获取都应该成功
      databases.forEach(db => {
        expect(db).toBe(mockDatabase);
      });

      expect(mockCloudBaseApp.database).toHaveBeenCalledTimes(10);
    });
  });

  describe('配置验证', () => {
    it('应该处理缺失的环境变量配置', async () => {
      const originalEnv = process.env;
      process.env = {}; // 清空环境变量

      const config = {}; // 不提供任何配置

      await expect(connector.initialize(config)).resolves.not.toThrow();
      // CloudBase SDK 会处理缺失的配置

      process.env = originalEnv;
    });

    it('应该处理无效的环境ID格式', async () => {
      const config = {
        envId: 'invalid-env-id-format',
      };

      // CloudBase SDK 应该在连接测试时检测到问题
      await connector.initialize(config);

      mockDatabase.collection.mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValue(new Error('Invalid environment ID')),
        }),
      });

      const result = await connector.testConnection();
      expect(result).toBe(false);
    });
  });
});