/**
 * 区域配置工具函数
 */

import { DeploymentRegion } from '../core/types';

/**
 * 区域类型定义
 */
export type Region = "china" | "usa" | "india" | "singapore" | "europe" | "other";

/**
 * 获取部署区域
 */
export function getDEPLOY_REGION(): DeploymentRegion {
  return process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "INTL" ? DeploymentRegion.INTL : DeploymentRegion.CN;
}

/**
 * 检查是否为中国区域
 */
export function isChinaRegion(): boolean {
  return getDEPLOY_REGION() === DeploymentRegion.CN;
}

/**
 * 检查是否为国际区域
 */
export function isInternationalRegion(): boolean {
  return getDEPLOY_REGION() === DeploymentRegion.INTL;
}

/**
 * 区域配置
 */
export const RegionConfig = {
  current: getDEPLOY_REGION(),
  isChina: isChinaRegion(),
  isInternational: isInternationalRegion(),
};

/**
 * 验证区域配置
 */
export function validateRegionConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const region = getDEPLOY_REGION();

  if (!Object.values(DeploymentRegion).includes(region)) {
    errors.push(`Invalid deployment region: ${region}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 打印区域配置信息
 */
export function printRegionConfig(): void {
  if (typeof window === "undefined") {
    console.log(
      `🌍 区域配置: ${RegionConfig.current} (${RegionConfig.isChina ? '中国版' : '国际版'})`
    );
  }
}

// 初始化时打印配置
printRegionConfig();