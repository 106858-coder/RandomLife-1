/**
 * 模块化架构工厂函数
 *
 * 提供统一的方式来创建和配置整个架构实例
 */

import { ArchitectureConfig, DeploymentRegion } from './core/types';
import { getAuth } from './auth';
import { GeoRouter } from './geo';
import { createDatabaseConnector } from './database';
import { PaymentRouter } from './payment';
import { applyGDPRCompliance } from './compliance';
import { createArchitectureConfig, validateEnvironmentVariables, configMode } from './config';

/**
 * 模块化架构实例
 */
export interface ModularArchitecture {
  config: ArchitectureConfig;
  auth: ReturnType<typeof getAuth>;
  geo: GeoRouter;
  database: ReturnType<typeof createDatabaseConnector>;
  payment: PaymentRouter;
  compliance?: ReturnType<typeof applyGDPRCompliance>;
}

/**
 * 架构创建选项
 */
export interface CreateArchitectureOptions {
  region?: DeploymentRegion;
  database?: {
    provider?: "supabase" | "cloudbase";
    connectionString?: string;
    envId?: string;
    url?: string;
    anonKey?: string;
  };
  auth?: {
    provider?: "cloudbase" | "supabase";
    features?: Record<string, boolean>;
  };
  payment?: {
    providers?: string[];
  };
  enableGDPR?: boolean;
  autoInitialize?: boolean;
}

/**
 * 创建模块化架构实例
 */
export function createModularArchitecture(options: CreateArchitectureOptions = {}): ModularArchitecture {
  // 设置默认值
  const defaultOptions: Required<CreateArchitectureOptions> = {
    region: DeploymentRegion.CN,
    database: {
      provider: "cloudbase",
    },
    auth: {
      provider: "cloudbase",
      features: {
        emailAuth: true,
        wechatAuth: true,
        googleAuth: false,
        githubAuth: false,
      },
    },
    payment: {
      providers: ["wechat", "alipay"],
    },
    enableGDPR: true,
    autoInitialize: true,
  };

  const finalOptions = { ...defaultOptions, ...options };

  // 根据区域设置默认值
  if (finalOptions.region === DeploymentRegion.CN) {
    finalOptions.database.provider = finalOptions.database.provider || "cloudbase";
    finalOptions.auth.provider = finalOptions.auth.provider || "cloudbase";
    finalOptions.payment.providers = finalOptions.payment.providers || ["wechat", "alipay"];
  } else {
    finalOptions.database.provider = finalOptions.database.provider || "supabase";
    finalOptions.auth.provider = finalOptions.auth.provider || "supabase";
    finalOptions.payment.providers = finalOptions.payment.providers || ["stripe", "paypal"];
  }

  // 创建配置
  const config = createArchitectureConfig(finalOptions.region, {
    database: {
      type: finalOptions.database.provider || "supabase",
      ...finalOptions.database,
    },
    auth: {
      provider: finalOptions.auth.provider || "supabase",
      features: finalOptions.auth.features || {},
    },
    payment: {
      providers: finalOptions.payment.providers || ["stripe", "paypal"],
    },
  });

  // 验证环境变量
  const validation = validateEnvironmentVariables();
  if (!validation.valid) {
    console.error("❌ Environment variable validation failed:", validation.errors);
    if (configMode.isProduction) {
      throw new Error("Invalid environment configuration");
    }
  }

  // 创建各个模块实例
  const auth = getAuth(config.region);
  const geo = new GeoRouter();
  const database = createDatabaseConnector(config.database.type, config.database);
  const payment = new PaymentRouter();

  // 初始化数据库连接（如果启用）
  if (finalOptions.autoInitialize) {
    database.initialize(config.database).catch(error => {
      console.error("❌ Failed to initialize database:", error);
    });
  }

  // 创建架构实例
  const architecture: ModularArchitecture = {
    config,
    auth,
    geo,
    database,
    payment,
  };

  // 应用GDPR合规性（如果启用）
  if (finalOptions.enableGDPR) {
    // 这里需要先检测用户位置，暂时使用占位符
    architecture.compliance = applyGDPRCompliance("DE", {
      enableUserConsent: true,
      dataRetentionPeriod: 365,
      cookieConsentRequired: true,
      anonymizationEnabled: true,
      rightToBeForgotten: true,
    });
  }

  console.log(`✅ Modular architecture created for ${config.region} region`);
  return architecture;
}

/**
 * 预设配置
 */
export const presets = {
  /**
   * 中国区域配置
   */
  china: (): CreateArchitectureOptions => ({
    region: DeploymentRegion.CN,
    database: { provider: "cloudbase" },
    auth: {
      provider: "cloudbase",
      features: {
        emailAuth: true,
        wechatAuth: true,
        googleAuth: false,
        githubAuth: false,
      },
    },
    payment: { providers: ["wechat", "alipay"] },
    enableGDPR: false,
  }),

  /**
   * 国际区域配置
   */
  international: (): CreateArchitectureOptions => ({
    region: DeploymentRegion.INTL,
    database: { provider: "supabase" },
    auth: {
      provider: "supabase",
      features: {
        emailAuth: true,
        wechatAuth: false,
        googleAuth: true,
        githubAuth: true,
      },
    },
    payment: { providers: ["stripe", "paypal"] },
    enableGDPR: true,
  }),

  /**
   * 欧洲区域配置（GDPR严格模式）
   */
  europe: (): CreateArchitectureOptions => ({
    region: DeploymentRegion.INTL,
    database: { provider: "supabase" },
    auth: {
      provider: "supabase",
      features: {
        emailAuth: true,
        wechatAuth: false,
        googleAuth: false,
        githubAuth: false,
      },
    },
    payment: { providers: [] }, // GDPR合规，禁用支付
    enableGDPR: true,
  }),

  /**
   * 开发环境配置
   */
  development: (): CreateArchitectureOptions => ({
    region: DeploymentRegion.CN,
    database: { provider: "cloudbase" },
    auth: {
      provider: "cloudbase",
      features: {
        emailAuth: true,
        wechatAuth: true,
        googleAuth: true,
        githubAuth: true,
      },
    },
    payment: { providers: ["wechat", "alipay", "stripe", "paypal"] }, // 开发环境支持所有支付方式
    enableGDPR: false,
    autoInitialize: false,
  }),
};

/**
 * 快速创建函数
 */
export const quickStart = {
  /**
   * 创建中国区域架构
   */
  china: () => createModularArchitecture(presets.china()),

  /**
   * 创建国际区域架构
   */
  international: () => createModularArchitecture(presets.international()),

  /**
   * 创建欧洲区域架构
   */
  europe: () => createModularArchitecture(presets.europe()),

  /**
   * 创建开发环境架构
   */
  development: () => createModularArchitecture(presets.development()),
};

/**
 * 架构健康检查
 */
export async function healthCheck(architecture: ModularArchitecture): Promise<{
  healthy: boolean;
  checks: Array<{ name: string; status: 'pass' | 'fail'; error?: string }>;
}> {
  const checks = [];

  // 检查数据库连接
  try {
    const dbHealthy = await architecture.database.testConnection();
    checks.push({
      name: 'database',
      status: dbHealthy ? ('pass' as const) : ('fail' as const),
    });
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'fail' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 检查地理路由
  try {
    const geoResult = await architecture.geo.detect('8.8.8.8'); // 测试IP
    checks.push({
      name: 'geo-router',
      status: geoResult ? ('pass' as const) : ('fail' as const),
    });
  } catch (error) {
    checks.push({
      name: 'geo-router',
      status: 'fail' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 检查认证状态
  try {
    const isAuth = await architecture.auth.isAuthenticated();
    checks.push({
      name: 'auth',
      status: 'pass' as const, // 认证检查总是通过，只是检查服务是否可用
    });
  } catch (error) {
    checks.push({
      name: 'auth',
      status: 'fail' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const healthy = checks.every(check => check.status === 'pass');

  return {
    healthy,
    checks,
  };
}

/**
 * 迁移工具
 */
export const migration = {
  /**
   * 从旧配置迁移到新架构
   */
  fromLegacyConfig: (legacyConfig: any): CreateArchitectureOptions => {
    // 这里实现从旧配置格式的迁移逻辑
    return {
      region: legacyConfig.region === 'china' ? DeploymentRegion.CN : DeploymentRegion.INTL,
      // ... 其他配置映射
    };
  },

  /**
   * 验证配置兼容性
   */
  validateCompatibility: (config: CreateArchitectureOptions): { valid: boolean; warnings: string[] } => {
    const warnings: string[] = [];

    // 检查配置兼容性
    if (config.region === DeploymentRegion.CN && config.auth?.provider === 'supabase') {
      warnings.push("Using Supabase in China region may have performance issues");
    }

    if (config.region === DeploymentRegion.INTL && config.auth?.provider === 'cloudbase') {
      warnings.push("Using CloudBase internationally may have compliance issues");
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  },
};