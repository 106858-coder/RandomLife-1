/**
 * 地理路由模块 - IP地理位置检测和智能路由
 */

import { RegionType, GeoResult } from '../core/types';
import { getRegionFromCountryCode, isEuropeanCountry } from './ip-detection';

export interface GeoDetectionOptions {
  timeout?: number;
  maxRetries?: number;
  cacheTTL?: number;
}

export class GeoRouter {
  private cache = new Map<string, { result: GeoResult; timestamp: number }>();
  private pendingRequests = new Map<string, Promise<GeoResult>>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1小时缓存
  private readonly REQUEST_TIMEOUT = 5000; // 5秒超时
  private readonly MAX_RETRIES = 2;

  /**
   * 检测IP并返回完整的地理路由配置
   */
  async detect(ip: string, options: GeoDetectionOptions = {}): Promise<GeoResult> {
    const timeout = options.timeout || this.REQUEST_TIMEOUT;
    const cacheTTL = options.cacheTTL || this.CACHE_TTL;

    // 检查缓存
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.result;
    }

    // 检查是否有正在进行的请求
    const pending = this.pendingRequests.get(ip);
    if (pending) {
      return pending;
    }

    // 创建新的请求
    const requestPromise = this.performDetection(ip, timeout);
    this.pendingRequests.set(ip, requestPromise);

    try {
      const result = await requestPromise;

      // 缓存结果
      this.cache.set(ip, { result, timestamp: Date.now() });

      return result;
    } catch (error) {
      console.error("Geo detection failed with all fallbacks:", error);

      // 返回默认配置作为最后的降级
      const defaultResult = this.getDefaultGeoResult();
      // 缓存默认结果（短期）
      this.cache.set(ip, { result: defaultResult, timestamp: Date.now() });
      return defaultResult;
    } finally {
      // 清理待处理的请求
      this.pendingRequests.delete(ip);
    }
  }

  private async performDetection(ip: string, timeout: number): Promise<GeoResult> {
    // 按优先级尝试不同的检测服务
    const detectionMethods = [
      () => this.detectWithPrimaryService(ip, timeout),
      () => this.detectWithFallbackService(ip, timeout),
      () => this.detectWithThirdFallback(ip, timeout),
      () => this.detectLocally(ip),
    ];

    for (const method of detectionMethods) {
      try {
        const result = await method();
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn("Detection method failed:", error);
        continue;
      }
    }

    throw new Error("All geo detection methods failed");
  }

  /**
   * 使用主IP检测服务 (ipapi.co)
   */
  private async detectWithPrimaryService(ip: string, timeout: number): Promise<GeoResult> {
    if (!ip || ip === "" || ip === "::1" || ip === "127.0.0.1") {
      return this.detectLocally(ip);
    }

    const response = await this.fetchWithTimeout(
      `https://ipapi.co/${ip}/json/`,
      {},
      timeout
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`IP detection failed: ${data.reason || data.error}`);
    }

    if (!data.country_code || !data.country_name) {
      throw new Error("Invalid response: missing country_code or country_name");
    }

    return this.buildGeoResult(data.country_code);
  }

  /**
   * 使用备用IP检测服务 (ip-api.com)
   */
  private async detectWithFallbackService(ip: string, timeout: number): Promise<GeoResult> {
    if (!ip || ip === "" || ip === "::1" || ip === "127.0.0.1") {
      return this.detectLocally(ip);
    }

    const response = await this.fetchWithTimeout(
      `http://ip-api.com/json/${ip}`,
      {},
      timeout
    );

    if (!response.ok) {
      throw new Error(`Fallback service HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "fail") {
      throw new Error(`Fallback IP detection failed: ${data.message}`);
    }

    if (!data.countryCode) {
      throw new Error("Invalid fallback response: missing countryCode");
    }

    return this.buildGeoResult(data.countryCode);
  }

  /**
   * 使用第三个备用IP检测服务 (ipinfo.io)
   */
  private async detectWithThirdFallback(ip: string, timeout: number): Promise<GeoResult> {
    if (!ip || ip === "" || ip === "::1" || ip === "127.0.0.1") {
      return this.detectLocally(ip);
    }

    const response = await this.fetchWithTimeout(
      `https://ipinfo.io/${ip}/json`,
      {},
      timeout
    );

    if (!response.ok) {
      throw new Error(`Third fallback service HTTP ${response.status}`);
    }

    const data = await response.json();

    const countryCode = data.country;
    if (!countryCode) {
      throw new Error("Invalid third fallback response: missing country");
    }

    return this.buildGeoResult(countryCode);
  }

  /**
   * 本地检测（最后的降级策略）
   */
  private detectLocally(ip: string): GeoResult {
    if (this.isPrivateIP(ip)) {
      // 内网IP，默认为中国（开发环境）
      return this.buildGeoResult("CN");
    }

    // 默认海外
    return this.buildGeoResult("US");
  }

  /**
   * 构建地理结果
   */
  private buildGeoResult(countryCode: string): GeoResult {
    const region = this.mapToRegionType(getRegionFromCountryCode(countryCode));

    return {
      region,
      countryCode,
      currency: this.getCurrencyByRegion(region),
      paymentMethods: this.getPaymentMethodsByRegion(region),
      authMethods: this.getAuthMethods(region),
      database: region === RegionType.CHINA ? "cloudbase" : "supabase",
      deployment: region === RegionType.CHINA ? "tencent" : "vercel",
      gdprCompliant: isEuropeanCountry(countryCode),
    };
  }

  /**
   * 根据区域获取货币
   */
  private getCurrencyByRegion(region: RegionType): string {
    switch (region) {
      case RegionType.CHINA:
        return "CNY";
      case RegionType.EUROPE:
        return "EUR";
      default:
        return "USD";
    }
  }

  /**
   * 根据区域获取支付方式
   */
  private getPaymentMethodsByRegion(region: RegionType): string[] {
    switch (region) {
      case RegionType.CHINA:
        return ["wechat", "alipay"];
      case RegionType.EUROPE:
        return []; // GDPR合规，禁用支付
      default:
        return ["stripe", "paypal"];
    }
  }

  /**
   * 根据区域获取认证方法
   */
  private getAuthMethods(region: RegionType): string[] {
    switch (region) {
      case RegionType.CHINA:
        return ["wechat", "email"];
      case RegionType.EUROPE:
        return ["email"]; // 欧洲地区GDPR合规，只允许邮箱认证
      default:
        return ["google", "email"];
    }
  }

  /**
   * 映射到RegionType枚举
   */
  private mapToRegionType(region: string): RegionType {
    switch (region) {
      case "china":
        return RegionType.CHINA;
      case "usa":
        return RegionType.USA;
      case "europe":
        return RegionType.EUROPE;
      case "india":
        return RegionType.INDIA;
      case "singapore":
        return RegionType.SINGAPORE;
      default:
        return RegionType.OTHER;
    }
  }

  /**
   * 检查是否为私有IP
   */
  private isPrivateIP(ip: string): boolean {
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
   * 获取默认地理结果（海外）
   */
  private getDefaultGeoResult(): GeoResult {
    return {
      region: RegionType.USA,
      countryCode: "US",
      currency: "USD",
      paymentMethods: ["stripe", "paypal"],
      authMethods: ["google", "email"],
      database: "supabase",
      deployment: "vercel",
      gdprCompliant: false,
    };
  }

  /**
   * 带超时的fetch请求
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; entries: Array<{ ip: string; timestamp: number }> } {
    const entries = Array.from(this.cache.entries()).map(([ip, data]) => ({
      ip,
      timestamp: data.timestamp,
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }
}

// 导出单例实例
export const geoRouter = new GeoRouter();

/**
 * 便捷函数：检测用户位置
 */
export async function detectUserLocation(
  ip: string,
  options?: GeoDetectionOptions
): Promise<GeoResult> {
  return geoRouter.detect(ip, options);
}