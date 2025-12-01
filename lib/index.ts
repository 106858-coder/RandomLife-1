/**
 * Modular Architecture - 六大功能模块统一导出
 *
 * 这是一个企业级的多功能 AI 服务平台模块化架构，支持：
 * - 🔐 认证管理模块 (Authentication)
 * - 💳 支付管理模块 (Payment)
 * - 🌍 地理路由模块 (Geo-routing)
 * - 💾 数据存储模块 (Database)
 * - ⚖️ 合规模块 (Compliance)
 * - ⚙️ 配置管理模块 (Configuration)
 */

// 核心类型定义
export * from './core/types';

// 1. 🔐 认证管理模块
export { getAuth, isAuthFeatureSupported, getAuthClient, auth } from './auth';

// 2. 💳 支付管理模块
export { paymentRouter } from './payment';
export { getPricingByMethod, getAmountByCurrency, getCurrencyByPaymentMethod, convertCurrency } from './payment';

// 3. 🌍 地理路由模块
export { geoRouter, detectUserLocation } from './geo';
export { getRegionFromCountryCode, isEuropeanCountry, getDefaultLanguage } from './geo/ip-detection';

// 4. 💾 数据存储模块
export { createDatabaseConnector, initDatabase } from './database';

// 5. ⚖️ 合规模块
export { isGDPRComplianceRequired, applyGDPRCompliance, createGDPRComplianceManager } from './compliance';
export { generatePrivacyPolicy, generatePrivacyPolicyHTML, generateTermsOfService } from './compliance';

// 6. ⚙️ 配置管理模块
export {
  deploymentConfig,
  isChinaDeployment,
  getAuthProvider,
  getDatabaseProvider,
  getPaymentProviders
} from './config';

// 工具函数
export * from './utils/error-handler';
export * from './utils/helpers';

// 便捷的工厂函数
export { createModularArchitecture } from './factory';

// 版本信息
export const VERSION = '1.0.0';

/**
 * 快速开始指南：
 *
 * ```typescript
 * import { createModularArchitecture } from '@company/modular-architecture';
 *
 * // 创建架构实例
 * const architecture = createModularArchitecture({
 *   region: 'CN', // 或 'INTL'
 *   database: { provider: 'cloudbase' },
 *   auth: { provider: 'cloudbase' },
 *   payment: { providers: ['wechat', 'alipay'] }
 * });
 *
 * // 使用各个模块
 * const user = await architecture.auth.signInWithEmail(email, password);
 * const location = await architecture.geo.detect(userIP);
 * const payment = await architecture.payment.process(order);
 * ```
 */