/**
 * IP 地理位置检测与国家分类库
 *
 * 功能：
 * 1. 定义欧洲国家列表（EU + EEA + UK + CH）
 * 2. 定义主流市场国家
 * 3. 区域分类函数
 * 4. GDPR合规性检查
 */

// 欧洲国家代码列表（EU + EEA + UK + CH）
export const EUROPEAN_COUNTRIES = [
  // EU 成员国 (27个)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA 非 EU 成员
  "IS", "LI", "NO",
  // 英国（脱欧后仍需遵守部分GDPR）
  "GB",
  // 瑞士（虽非EU但数据保护法类似）
  "CH",
];

// 主流市场国家
export const TARGET_MARKETS = {
  CHINA: "CN",
  USA: "US",
  INDIA: "IN",
  SINGAPORE: "SG",
} as const;

// 区域分类类型
export type Region = "china" | "usa" | "india" | "singapore" | "europe" | "other";

// 语言类型
export type Language = "zh" | "en";

/**
 * 根据国家代码获取区域分类
 */
export function getRegionFromCountryCode(countryCode: string): Region {
  if (countryCode === TARGET_MARKETS.CHINA) return "china";
  if (countryCode === TARGET_MARKETS.USA) return "usa";
  if (countryCode === TARGET_MARKETS.INDIA) return "india";
  if (countryCode === TARGET_MARKETS.SINGAPORE) return "singapore";
  if (EUROPEAN_COUNTRIES.includes(countryCode)) return "europe";
  return "other";
}

/**
 * 根据区域获取默认语言
 */
export function getDefaultLanguage(region: Region): Language {
  if (region === "china") return "zh";
  return "en";
}

/**
 * 检查是否为欧洲国家
 */
export function isEuropeanCountry(countryCode: string): boolean {
  return EUROPEAN_COUNTRIES.includes(countryCode);
}

/**
 * 检查是否为中国
 */
export function isChinaCountry(countryCode: string): boolean {
  return countryCode === TARGET_MARKETS.CHINA;
}

/**
 * 检查是否为美国
 */
export function isUSACountry(countryCode: string): boolean {
  return countryCode === TARGET_MARKETS.USA;
}

/**
 * 根据区域获取支付方式
 */
export function getPaymentMethodsByRegion(region: Region): string[] {
  switch (region) {
    case "china":
      return ["wechat", "alipay"];
    case "europe":
      return []; // GDPR合规，禁用支付
    case "usa":
    case "india":
    case "singapore":
    case "other":
      return ["stripe", "paypal"];
    default:
      return [];
  }
}

/**
 * 根据区域获取货币
 */
export function getCurrencyByRegion(region: Region): string {
  switch (region) {
    case "china":
      return "CNY";
    case "europe":
      return "EUR";
    case "usa":
    case "india":
    case "singapore":
    case "other":
      return "USD";
    default:
      return "USD";
  }
}

/**
 * 根据区域获取数据库提供商
 */
export function getDatabaseByRegion(region: Region): "cloudbase" | "supabase" {
  switch (region) {
    case "china":
      return "cloudbase";
    case "europe":
    case "usa":
    case "india":
    case "singapore":
    case "other":
      return "supabase";
    default:
      return "supabase";
  }
}

/**
 * 根据区域获取部署平台
 */
export function getDeploymentByRegion(region: Region): "tencent" | "vercel" {
  switch (region) {
    case "china":
      return "tencent";
    case "europe":
    case "usa":
    case "india":
    case "singapore":
    case "other":
      return "vercel";
    default:
      return "vercel";
  }
}

/**
 * 检查区域是否支持特定认证方式
 */
export function getAuthMethodsByRegion(region: Region): string[] {
  switch (region) {
    case "china":
      return ["wechat", "email"];
    case "europe":
      return ["email"]; // 欧洲地区GDPR合规
    case "usa":
    case "india":
    case "singapore":
    case "other":
      return ["google", "github", "email"];
    default:
      return [];
  }
}

/**
 * 获取区域配置信息
 */
export function getRegionConfig(countryCode: string) {
  const region = getRegionFromCountryCode(countryCode);

  return {
    region,
    countryCode,
    currency: getCurrencyByRegion(region),
    paymentMethods: getPaymentMethodsByRegion(region),
    authMethods: getAuthMethodsByRegion(region),
    database: getDatabaseByRegion(region),
    deployment: getDeploymentByRegion(region),
    language: getDefaultLanguage(region),
    gdprCompliant: isEuropeanCountry(countryCode),
  };
}

/**
 * IP地址验证和清理
 */
export function sanitizeIP(ip: string): string {
  if (!ip) return "";

  // 移除端口号（如果有）
  if (ip.includes(":") && !ip.startsWith("[")) {
    ip = ip.split(":")[0];
  }

  // 处理IPv6地址
  if (ip.startsWith("[") && ip.endsWith("]")) {
    ip = ip.slice(1, -1);
  }

  return ip.trim();
}

/**
 * 检查IP地址是否有效
 */
export function isValidIP(ip: string): boolean {
  if (!ip) return false;

  // IPv4 正则表达式
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 正则表达式（简化版）
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * 检查是否为内网IP
 */
export function isPrivateIP(ip: string): boolean {
  if (!isValidIP(ip)) return true; // 无效IP视为内网

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;

  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

/**
 * 获取客户端真实IP地址（考虑代理和CDN）
 */
export function getClientIP(request?: any): string {
  if (!request) return "";

  // 检查各种可能的头部字段
  const headers = [
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "cf-connecting-ip",
    "x-cloudfoundry-client-ip",
    "true-client-ip",
    "x-cluster-client-ip",
    "x-forwarded",
    "forwarded-for",
    "forwarded",
  ];

  for (const header of headers) {
    const ip = request.headers?.[header];
    if (ip) {
      // X-Forwarded-For 可能包含多个IP，取第一个
      const ips = ip.split(",").map((i: string) => i.trim());
      const firstIP = sanitizeIP(ips[0]);
      if (firstIP && isValidIP(firstIP)) {
        return firstIP;
      }
    }
  }

  // 回退到连接的远程地址
  const remoteAddress = request.connection?.remoteAddress ||
                        request.socket?.remoteAddress ||
                        request.info?.remoteAddress;

  return sanitizeIP(remoteAddress) || "";
}

/**
 * GDPR合规性检查配置
 */
export const GDPR_CONFIG = {
  // 需要用户同意的Cookie类别
  cookieConsent: {
    necessary: true,    // 必要Cookie
    functional: false,  // 功能Cookie
    analytics: false,   // 分析Cookie
    marketing: false,   // 营销Cookie
  },

  // 数据保留期限（天）
  dataRetention: {
    userProfiles: 365,      // 用户资料
    analytics: 90,          // 分析数据
    supportTickets: 1095,   // 支持工单
    paymentRecords: 1825,   // 支付记录（5年，法律要求）
  },

  // 用户数据权利
  userRights: [
    "access",           // 访问权
    "rectification",    // 更正权
    "erasure",          // 删除权
    "restriction",      // 限制处理权
    "portability",      // 数据携带权
    "objection",        // 反对权
  ],
};