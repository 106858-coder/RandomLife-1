/**
 * 合规模块统一导出
 */

export * from './gdpr';
export * from './privacy-policy';

// 便捷导出
export {
  isGDPRComplianceRequired,
  applyGDPRCompliance,
  createGDPRComplianceManager
} from './gdpr';

export {
  generatePrivacyPolicy,
  generatePrivacyPolicyHTML,
  generateTermsOfService
} from './privacy-policy';