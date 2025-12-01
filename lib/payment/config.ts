/**
 * 支付配置模块 - 统一的支付配置管理
 */

import { BillingCycle, PaymentMethod } from '../core/types';

/**
 * 定价表（唯一的价格定义来源）
 */
const PRICING_DATA = {
  CNY: {
    monthly: 0.01,
    yearly: 0.01,
  },
  USD: {
    monthly: 9.99,
    yearly: 99.99,
  },
} as const;

/**
 * 导出定价表供前端显示
 */
export const PRICING_TABLE = PRICING_DATA;

/**
 * 根据支付方式获取定价信息
 * @param method 支付方式
 * @returns 定价配置（货币和金额）
 */
export function getPricingByMethod(method: PaymentMethod) {
  // 支付宝和微信使用人民币，其他使用美元
  const currency = method === "alipay" || method === "wechat" ? "CNY" : "USD";

  return {
    currency,
    monthly: PRICING_DATA[currency].monthly,
    yearly: PRICING_DATA[currency].yearly,
  };
}

/**
 * 根据货币类型和账单周期获取金额
 * @param currency 货币类型
 * @param billingCycle 账单周期
 * @returns 金额
 */
export function getAmountByCurrency(
  currency: string,
  billingCycle: BillingCycle
): number {
  const prices = PRICING_DATA[currency as keyof typeof PRICING_DATA];
  return prices ? prices[billingCycle] : 0;
}

/**
 * 定义会员天数
 */
export function getDaysByBillingCycle(billingCycle: BillingCycle): number {
  return billingCycle === "monthly" ? 30 : 365;
}

/**
 * 汇率配置
 */
export const EXCHANGE_RATES = {
  USD_TO_CNY: 7.2, // 1 USD = 7.2 CNY
} as const;

/**
 * 货币转换
 * @param amount 原始金额
 * @param fromCurrency 原始货币
 * @param toCurrency 目标货币
 * @returns 转换后的金额
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // USD 转 CNY
  if (fromCurrency === "USD" && toCurrency === "CNY") {
    return amount * EXCHANGE_RATES.USD_TO_CNY;
  }

  // CNY 转 USD
  if (fromCurrency === "CNY" && toCurrency === "USD") {
    return amount / EXCHANGE_RATES.USD_TO_CNY;
  }

  // 不支持的货币转换
  throw new Error(
    `Unsupported currency conversion: ${fromCurrency} to ${toCurrency}`
  );
}

/**
 * 根据支付方式确定货币
 * @param method 支付方式
 * @returns 货币类型
 */
export function getCurrencyByPaymentMethod(method: PaymentMethod): string {
  switch (method) {
    case "alipay":
    case "wechat":
      return "CNY";
    case "stripe":
    case "paypal":
      return "USD";
    default:
      return "USD";
  }
}

/**
 * 检查支付方式是否在指定区域可用
 * @param method 支付方式
 * @param region 区域
 * @returns 是否可用
 */
export function isPaymentMethodAvailable(
  method: PaymentMethod,
  region: "CN" | "INTL" | "EUROPE"
): boolean {
  const availability: Record<string, PaymentMethod[]> = {
    CN: ["alipay", "wechat"],
    INTL: ["stripe", "paypal"],
    EUROPE: [], // GDPR合规，禁用支付
  };

  return availability[region]?.includes(method) || false;
}

/**
 * 格式化金额（转换为最小货币单位）
 * @param amount 金额
 * @param currency 货币类型
 * @returns 格式化后的金额
 */
export function formatAmount(amount: number, currency: string): number {
  // 对于人民币和美元，通常需要转换为分
  if (currency === "CNY" || currency === "USD") {
    return Math.round(amount * 100);
  }
  return amount;
}

/**
 * 支付提供商配置接口
 */
export interface PaymentProviderConfig {
  stripe?: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    successUrl: string;
    cancelUrl: string;
  };
  paypal?: {
    clientId: string;
    clientSecret: string;
    sandbox: boolean;
  };
  alipay?: {
    appId: string;
    privateKey: string;
    publicKey: string;
    notifyUrl: string;
    sandbox: boolean;
  };
  wechat?: {
    appId: string;
    mchId: string;
    privateKey: string;
    notifyUrl: string;
    sandbox: boolean;
  };
}