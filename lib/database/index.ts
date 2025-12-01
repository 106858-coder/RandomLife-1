/**
 * 数据存储模块统一导出
 */

export * from './adapter';
export * from './connectors';

// 便捷导出
export {
  createDatabaseConnector,
  initDatabase
} from './adapter';