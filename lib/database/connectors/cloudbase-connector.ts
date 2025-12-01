/**
 * CloudBase 数据库连接器
 */

import { DatabaseConnector } from '../adapter';

export class CloudBaseConnector implements DatabaseConnector {
  private client: any = null;
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async initialize(config: any): Promise<void> {
    try {
      // 动态导入 CloudBase
      const cloudbase = require('@cloudbase/node-sdk');

      this.client = cloudbase.init({
        env: config.envId || process.env.WECHAT_CLOUDBASE_ID,
        secretId: process.env.CLOUDBASE_SECRET_ID,
        secretKey: process.env.CLOUDBASE_SECRET_KEY,
      });

      console.log('✅ CloudBase database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize CloudBase:', error);
      throw error;
    }
  }

  getClient(): any {
    if (!this.client) {
      throw new Error('CloudBase client not initialized. Call initialize() first.');
    }
    return this.client.database();
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      // 简单的连接测试
      const db = this.client.database();
      await db.collection('test').limit(1).get();
      return true;
    } catch (error) {
      console.error('CloudBase connection test failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    this.client = null;
    console.log('✅ CloudBase connection closed');
  }
}