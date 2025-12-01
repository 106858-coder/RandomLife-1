/**
 * 隐私政策生成模块
 */

import { isEuropeanCountry } from '../geo/ip-detection';

/**
 * 隐私政策内容接口
 */
export interface PrivacyPolicySection {
  title: string;
  content: string;
}

export interface PrivacyPolicyContent {
  title: string;
  sections: PrivacyPolicySection[];
  lastUpdated: string;
}

/**
 * 生成隐私政策内容
 */
export function generatePrivacyPolicy(
  language: 'en' | 'zh' = 'en',
  region?: string
): PrivacyPolicyContent {
  const isEU = region ? isEuropeanCountry(region) : false;

  const content = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "November 2024",
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
          content: `Under ${isEU ? 'GDPR' : 'applicable privacy laws'}, you have the right to access, rectify, erase, restrict processing, and data portability of your personal information.`
        },
        ...(isEU ? [{
          title: "GDPR Compliance",
          content: "We are committed to protecting your personal data in accordance with the General Data Protection Regulation (GDPR). You have the right to object to processing, request data deletion, and lodge complaints with supervisory authorities."
        }] : []),
        {
          title: "Data Retention",
          content: "We retain personal information for as long as necessary to fulfill the purposes outlined in this privacy policy, unless a longer retention period is required or permitted by law."
        },
        {
          title: "Contact Us",
          content: "If you have any questions about this Privacy Policy, please contact us at privacy@company.com"
        }
      ]
    },
    zh: {
      title: "隐私政策",
      lastUpdated: "2024年11月",
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
          content: `根据${isEU ? 'GDPR' : '适用的隐私法律'}，您有权访问、更正、删除、限制处理和数据携带您的个人信息。`
        },
        ...(isEU ? [{
          title: "GDPR合规",
          content: "我们致力于根据《通用数据保护条例》(GDPR)保护您的个人数据。您有权反对处理、请求删除数据，并向监管机构投诉。"
        }] : []),
        {
          title: "数据保留",
          content: "我们保留个人信息的时间不超过实现本隐私政策所述目的所需的时间，除非法律要求或允许更长的保留期限。"
        },
        {
          title: "联系我们",
          content: "如果您对本隐私政策有任何疑问，请通过 privacy@company.com 联系我们"
        }
      ]
    }
  };

  return content[language];
}

/**
 * 生成隐私政策HTML
 */
export function generatePrivacyPolicyHTML(
  language: 'en' | 'zh' = 'en',
  region?: string
): string {
  const policy = generatePrivacyPolicy(language, region);

  let html = `<div class="privacy-policy">`;
  html += `<h1>${policy.title}</h1>`;
  html += `<p class="last-updated">Last updated: ${policy.lastUpdated}</p>`;

  policy.sections.forEach(section => {
    html += `<h2>${section.title}</h2>`;
    html += `<p>${section.content}</p>`;
  });

  html += `</div>`;

  return html;
}

/**
 * 生成服务条款内容
 */
export function generateTermsOfService(language: 'en' | 'zh' = 'en'): string {
  const content = {
    en: {
      title: "Terms of Service",
      sections: [
        {
          title: "Acceptance of Terms",
          content: "By accessing and using our service, you accept and agree to be bound by the terms and provision of this agreement."
        },
        {
          title: "Use License",
          content: "Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only."
        },
        {
          title: "Disclaimer",
          content: "The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim all other warranties."
        }
      ]
    },
    zh: {
      title: "服务条款",
      sections: [
        {
          title: "接受条款",
          content: "通过访问和使用我们的服务，您接受并同意受本协议条款和条款的约束。"
        },
        {
          title: "使用许可",
          content: "授予临时下载我们网站上材料的一份副本的许可，仅供个人、非商业性临时查看。"
        },
        {
          title: "免责声明",
          content: "我们网站上的材料按\"原样\"提供。我们不作任何明示或暗示的保证，并在此免除所有其他保证。"
        }
      ]
    }
  };

  const terms = content[language];
  let html = `<div class="terms-of-service">`;
  html += `<h1>${terms.title}</h1>`;

  terms.sections.forEach(section => {
    html += `<h2>${section.title}</h2>`;
    html += `<p>${section.content}</p>`;
  });

  html += `</div>`;

  return html;
}