/**
 * GDPR合规性管理模块
 *
 * 提供欧洲地区GDPR合规性检查和处理功能
 */

import { isEuropeanCountry } from '../geo/ip-detection';

export interface GDPRComplianceConfig {
  enableUserConsent: boolean;
  dataRetentionPeriod: number; // 天数
  cookieConsentRequired: boolean;
  anonymizationEnabled: boolean;
  rightToBeForgotten: boolean;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  purposes: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
  };
  version: string;
}

export interface DataSubjectRequest {
  id: string;
  userId: string;
  type: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestData: any;
  response?: any;
  createdAt: Date;
  processedAt?: Date;
  notes?: string;
}

/**
 * GDPR合规性管理器
 */
export class GDPRComplianceManager {
  private config: GDPRComplianceConfig;

  constructor(config: GDPRComplianceConfig) {
    this.config = config;
  }

  /**
   * 检查用户是否在GDPR管辖范围内
   */
  isUserInGDPRJurisdiction(countryCode: string): boolean {
    return isEuropeanCountry(countryCode);
  }

  /**
   * 生成隐私政策同意书HTML
   */
  generateConsentModal(language: 'en' | 'zh' = 'en'): string {
    const content = {
      en: {
        title: "Privacy & Cookie Consent",
        description: "We use cookies and similar technologies to help personalize content, tailor and measure ads, and provide a better experience. By clicking accept, you agree to this, as outlined in our Cookie Policy.",
        necessary: "Essential cookies",
        functional: "Functional cookies",
        analytics: "Analytics cookies",
        marketing: "Marketing cookies",
        acceptAll: "Accept All",
        acceptNecessary: "Accept Necessary",
        customize: "Customize",
        learnMore: "Learn More",
      },
      zh: {
        title: "隐私与Cookie同意",
        description: "我们使用Cookie和类似技术来个性化内容、定制和衡量广告，并提供更好的体验。点击接受即表示您同意我们的Cookie政策中概述的内容。",
        necessary: "必要Cookie",
        functional: "功能Cookie",
        analytics: "分析Cookie",
        marketing: "营销Cookie",
        acceptAll: "接受全部",
        acceptNecessary: "仅接受必要",
        customize: "自定义",
        learnMore: "了解更多",
      },
    };

    const text = content[language];

    return `
      <div id="gdpr-consent-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto p-6">
          <h2 class="text-2xl font-bold mb-4">${text.title}</h2>
          <p class="text-gray-600 mb-6">${text.description}</p>

          <div class="space-y-4 mb-6">
            <label class="flex items-center">
              <input type="checkbox" checked disabled class="mr-3">
              <span>${text.necessary}</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="consent-functional" class="mr-3">
              <span>${text.functional}</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="consent-analytics" class="mr-3">
              <span>${text.analytics}</span>
            </label>
            <label class="flex items-center">
              <input type="checkbox" name="consent-marketing" class="mr-3">
              <span>${text.marketing}</span>
            </label>
          </div>

          <div class="flex space-x-4">
            <button id="gdpr-accept-all" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
              ${text.acceptAll}
            </button>
            <button id="gdpr-accept-necessary" class="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400">
              ${text.acceptNecessary}
            </button>
            <button id="gdpr-customize" class="text-blue-600 underline">
              ${text.customize}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 保存用户同意记录
   */
  async saveConsentRecord(consent: Omit<ConsentRecord, 'id' | 'timestamp' | 'version'>): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      ...consent,
      id: this.generateId(),
      timestamp: new Date(),
      version: "1.0",
    };

    // 在实际应用中，这里应该保存到数据库
    console.log("Saving GDPR consent record:", record);

    return record;
  }

  /**
   * 创建数据主体请求
   */
  async createDataSubjectRequest(
    userId: string,
    type: DataSubjectRequest['type'],
    requestData?: any
  ): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: this.generateId(),
      userId,
      type,
      status: 'pending',
      requestData: requestData || {},
      createdAt: new Date(),
    };

    // 在实际应用中，这里应该保存到数据库
    console.log("Creating GDPR data subject request:", request);

    return request;
  }

  /**
   * 处理数据删除请求（被遗忘权）
   */
  async processErasureRequest(userId: string): Promise<void> {
    if (!this.config.rightToBeForgotten) {
      throw new Error("Right to be forgotten is not enabled");
    }

    console.log(`Processing erasure request for user: ${userId}`);

    // 在实际应用中，这里应该：
    // 1. 软删除用户资料
    // 2. 匿名化用户数据
    // 3. 删除不必要的个人数据
    // 4. 保留法律要求的数据（如支付记录）
  }

  /**
   * 匿名化用户数据
   */
  anonymizeUserData(data: Record<string, any>): Record<string, any> {
    if (!this.config.anonymizationEnabled) {
      return data;
    }

    const anonymized = { ...data };

    // 匿名化个人身份信息
    const sensitiveFields = ['email', 'name', 'phone', 'address', 'ipAddress'];
    sensitiveFields.forEach(field => {
      if (anonymized[field]) {
        anonymized[field] = this.anonymizeString(anonymized[field]);
      }
    });

    return anonymized;
  }

  /**
   * 匿名化字符串
   */
  private anonymizeString(str: string): string {
    if (!str || typeof str !== 'string') return str;

    // 保留部分信息用于识别，但隐藏敏感部分
    if (str.length <= 4) {
      return '*'.repeat(str.length);
    }

    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `gdpr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成隐私政策内容
   */
  generatePrivacyPolicy(language: 'en' | 'zh' = 'en'): string {
    const content = {
      en: {
        title: "Privacy Policy",
        sections: [
          {
            title: "Data Collection",
            content: "We collect information you provide directly to us, such as when you create an account, use our services, or contact us for support."
          },
          {
            title: "Data Usage",
            content: "We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you."
          },
          {
            title: "Your Rights",
            content: "Under GDPR, you have the right to access, rectify, erase, restrict processing, and data portability of your personal information."
          },
          {
            title: "Data Retention",
            content: `We retain personal information for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required or permitted by law (${this.config.dataRetentionPeriod} days).`
          },
        ],
      },
      zh: {
        title: "隐私政策",
        sections: [
          {
            title: "数据收集",
            content: "我们收集您直接提供给我们的信息，例如您创建账户、使用我们的服务或联系我们寻求支持时。"
          },
          {
            title: "数据使用",
            content: "我们使用收集的信息来提供、维护和改进我们的服务、处理交易以及与您沟通。"
          },
          {
            title: "您的权利",
            content: "根据GDPR，您有权访问、更正、删除、限制处理和数据携带您的个人信息。"
          },
          {
            title: "数据保留",
            content: `我们保留个人信息的时间不超过实现本隐私政策所述目的所需的时间，除非法律要求或允许更长的保留期限（${this.config.dataRetentionPeriod}天）。`
          },
        ],
      },
    };

    const policy = content[language];

    let html = `<div class="privacy-policy">`;
    html += `<h1>${policy.title}</h1>`;

    policy.sections.forEach(section => {
      html += `<h2>${section.title}</h2>`;
      html += `<p>${section.content}</p>`;
    });

    html += `</div>`;

    return html;
  }
}

/**
 * 默认GDPR配置
 */
export const defaultGDPRConfig: GDPRComplianceConfig = {
  enableUserConsent: true,
  dataRetentionPeriod: 365, // 1年
  cookieConsentRequired: true,
  anonymizationEnabled: true,
  rightToBeForgotten: true,
};

/**
 * 创建GDPR合规性管理器
 */
export function createGDPRComplianceManager(config: GDPRComplianceConfig = defaultGDPRConfig): GDPRComplianceManager {
  return new GDPRComplianceManager(config);
}

/**
 * 便捷函数：检查是否需要GDPR合规
 */
export function isGDPRComplianceRequired(countryCode: string): boolean {
  return isEuropeanCountry(countryCode);
}

/**
 * 应用GDPR合规性设置
 */
export function applyGDPRCompliance(countryCode: string, config: GDPRComplianceConfig): GDPRComplianceManager | null {
  if (isGDPRComplianceRequired(countryCode)) {
    console.log("🇪🇺 Applying GDPR compliance for European user");
    return createGDPRComplianceManager(config);
  }

  return null;
}