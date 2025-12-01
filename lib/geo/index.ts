/**
 * 地理路由模块统一导出
 */

export * from './router';
export * from './ip-detection';

// 便捷导出
export {
  geoRouter,
  detectUserLocation
} from './router';

export {
  getRegionFromCountryCode,
  isEuropeanCountry,
  getDefaultLanguage
} from './ip-detection';