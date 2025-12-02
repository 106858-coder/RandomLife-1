/**
 * 部署配置管理模块
 *
 * 集中管理所有部署相关的配置，支持多地区部署
 */

import { DeploymentRegion, DeploymentConfig, ArchitectureConfig } from '../core/types';

/**
 * 根据部署区域生成配置
 */
function generateConfig(region: DeploymentRegion): DeploymentConfig {
  const isChinaRegion = region === DeploymentRegion.CN;

  return {
    region,
    appName: "Multi-Region Platform",
    version: "1.0.0",

    auth: {
      provider: isChinaRegion ? "cloudbase" : "supabase",
      features: {
        emailAuth: true, // 全地区支持
        wechatAuth: isChinaRegion, // 仅中国支��
        googleAuth: !isChinaRegion, // 仅国际支持
        githubAuth: !isChinaRegion, // 仅国际支持
      },
    },

    database: {
      provider: isChinaRegion ? "cloudbase" : "supabase",
    },

    payment: {
      // 中国支持：微信支付、支付宝
      // 国际支持：Stripe、PayPal
      providers: isChinaRegion ? ["wechat", "alipay"] : ["stripe", "paypal"],
    },

    apis: {
      authCallbackPath: "/auth/callback",
    },

    logging: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      enableConsole: process.env.NODE_ENV !== "production",
    },
  };
}

/**
 * 获取部署区域（从环境变量）
 */
function getDeploymentRegion(): DeploymentRegion {
  // 环境变量 NEXT_PUBLIC_DEPLOYMENT_REGION：
  // - 未设置或其他值：默认为中国版 (CN)
  // - "INTL"：国际版
  return process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "INTL" ? DeploymentRegion.INTL : DeploymentRegion.CN;
}

/**
 * 当前部署配置
 */
const DEPLOYMENT_REGION: DeploymentRegion = getDeploymentRegion();

// 在运行时验证区域设置
if (typeof window === "undefined") {
  // 只在服务器端打印
  console.log(
    `🌍 部署区域已确认: ${DEPLOYMENT_REGION} (使用 ${
      DEPLOYMENT_REGION === DeploymentRegion.INTL ? "Supabase" : "CloudBase"
    })`
  );
}

/**
 * 导出当前配置
 */
export const deploymentConfig: DeploymentConfig = generateConfig(DEPLOYMENT_REGION);

/**
 * 导出部署区域
 */
export const currentRegion: DeploymentRegion = DEPLOYMENT_REGION;

/**
 * 判断是否为中国区域
 */
export function isChinaDeployment(): boolean {
  return deploymentConfig.region === DeploymentRegion.CN;
}

/**
 * 判断是否为国际区域
 */
export function isInternationalDeployment(): boolean {
  return deploymentConfig.region === DeploymentRegion.INTL;
}

/**
 * 获取认证提供商
 */
export function getAuthProvider(): "cloudbase" | "supabase" {
  return deploymentConfig.auth.provider;
}

/**
 * 获取数据库提供商
 */
export function getDatabaseProvider(): "cloudbase" | "supabase" {
  return deploymentConfig.database.provider;
}

/**
 * 检查是否支持某个认证功能
 */
export function isAuthFeatureSupported(
  feature: keyof typeof deploymentConfig.auth.features
): boolean {
  return deploymentConfig.auth.features[feature];
}

/**
 * 获取支持的支付提供商列表
 */
export function getPaymentProviders(): DeploymentConfig["payment"]["providers"] {
  return deploymentConfig.payment.providers;
}

/**
 * 检查是否支持某个支付方式
 */
export function isPaymentMethodSupported(
  method: DeploymentConfig["payment"]["providers"][number]
): boolean {
  return deploymentConfig.payment.providers.includes(method);
}

/**
 * 导出完整配置（用于调试）
 */
export function getFullConfig(): DeploymentConfig {
  return deploymentConfig;
}

/**
 * 创建架构配置
 */
export function createArchitectureConfig(
  region: DeploymentRegion,
  customConfig?: Partial<ArchitectureConfig>
): ArchitectureConfig {
  const baseConfig = generateConfig(region);

  return {
    region,
    database: {
      type: baseConfig.database.provider,
      // 从环境变量获取具体配置
      ...(baseConfig.database.provider === "supabase" && {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
      }),
      ...(baseConfig.database.provider === "cloudbase" && {
        envId: process.env.WECHAT_CLOUDBASE_ID,
      }),
    },
    auth: {
      provider: baseConfig.auth.provider,
      features: baseConfig.auth.features as Record<string, boolean>,
    },
    payment: {
      providers: baseConfig.payment.providers,
    },
    ...customConfig,
  };
}

/**
 * 环境变量验证
 */
export function validateEnvironmentVariables(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = deploymentConfig;

  // 验证数据库配置
  if (config.database.provider === "supabase") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      errors.push("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is required for Supabase database");
    }
    if (!supabaseAnonKey) {
      errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required for Supabase database");
    }
  } else if (config.database.provider === "cloudbase") {
    if (!process.env.WECHAT_CLOUDBASE_ID) {
      errors.push("WECHAT_CLOUDBASE_ID is required for CloudBase database");
    }
  }

  // 验证支付配置
  config.payment.providers.forEach(provider => {
    switch (provider) {
      case "stripe":
        if (!process.env.STRIPE_SECRET_KEY) {
          errors.push("STRIPE_SECRET_KEY is required for Stripe payments");
        }
        if (!process.env.STRIPE_PUBLIC_KEY) {
          errors.push("STRIPE_PUBLIC_KEY is required for Stripe payments");
        }
        break;
      case "paypal":
        if (!process.env.PAYPAL_CLIENT_ID) {
          errors.push("PAYPAL_CLIENT_ID is required for PayPal payments");
        }
        break;
      case "alipay":
        if (!process.env.ALIPAY_APP_ID) {
          errors.push("ALIPAY_APP_ID is required for Alipay payments");
        }
        break;
      case "wechat":
        if (!process.env.WECHAT_APP_ID) {
          errors.push("WECHAT_APP_ID is required for WeChat payments");
        }
        break;
    }
  });

  // 验证认证配置
  if (config.auth.features.wechatAuth && !process.env.WECHAT_APP_SECRET) {
    errors.push("WECHAT_APP_SECRET is required for WeChat authentication");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 配置更新事件监听器
 */
type ConfigUpdateListener = (newConfig: DeploymentConfig) => void;

class ConfigManager {
  private listeners: ConfigUpdateListener[] = [];

  addListener(listener: ConfigUpdateListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: ConfigUpdateListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  updateConfig(newConfig: Partial<DeploymentConfig>): void {
    const updatedConfig = { ...deploymentConfig, ...newConfig };

    // 更新配置（注意：这里只是示例，实际应用中需要更复杂的更新逻辑）
    Object.assign(deploymentConfig, newConfig);

    // 通知监听器
    this.listeners.forEach(listener => listener(updatedConfig));
  }
}

export const configManager = new ConfigManager();

/**
 * 配置模式（开发/生产）
 */
export const configMode = {
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
};

/**
 * 功能开关
 */
export const featureFlags = {
  // 是否启用调试模式
  debugMode: configMode.isDevelopment,

  // 是否启用性能监控
  performanceMonitoring: configMode.isProduction,

  // 是否启用错误报告
  errorReporting: configMode.isProduction,

  // 是否启用分析功能
  analytics: true,

  // 是否启用A/B测试
  abTesting: false,
};