/**
 * 配置管理模块统一导出
 */

export * from './deployment';
export * from './region';

// 便捷导出
export {
  deploymentConfig,
  currentRegion,
  isChinaDeployment,
  isInternationalDeployment,
  getAuthProvider,
  getDatabaseProvider,
  isAuthFeatureSupported,
  getPaymentProviders,
  isPaymentMethodSupported,
  getFullConfig
} from './deployment';