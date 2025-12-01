/**
 * Supabase 数据库连接器
 */

import { DatabaseConnector } from '../adapter';

export class SupabaseConnector implements DatabaseConnector {
  private client: any = null;
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  async initialize(config: any): Promise<void> {
    try {
      // 动态导入 Supabase
      const { createClient } = require('@supabase/supabase-js');

      this.client = createClient(
        config.url || process.env.SUPABASE_URL,
        config.anonKey || process.env.SUPABASE_ANON_KEY
      );

      console.log('✅ Supabase database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      throw error;
    }
  }

  getClient(): any {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      // 简单的连接测试
      const { data, error } = await this.client.from('_health_check').select('count').limit(1);
      return !error;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    this.client = null;
    console.log('✅ Supabase connection closed');
  }
}