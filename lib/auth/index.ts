/**
 * 认证管理模块统一导出
 */

// 导出核心类型和接口
export type {
  AuthAdapter,
  AuthResponse,
  User
} from '../core/types';

export type {
  AuthUser as ClientAuthUser,
  AuthSession,
  ClientAuthResponse,
  AuthClient
} from './client';

// 导出功能函数
export { getAuth, isAuthFeatureSupported } from './adapter';
export { getAuthClient, auth } from './client';