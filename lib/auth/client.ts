/**
 * 前端认证客户端
 *
 * 根据 DEPLOY_REGION 环境变量提供统一的认证接口
 */

import { isChinaDeployment } from '../config/deployment';
import { getAuth } from './adapter';
import { AuthResponse, DeploymentRegion } from '../core/types';

/**
 * 统一的用户类型
 */
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

/**
 * 统一的会话类型
 */
export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: AuthUser;
}

/**
 * 统一的认证响应类型
 */
export interface ClientAuthResponse {
  data: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
  error: Error | null;
}

/**
 * 统一的认证客户端接口
 */
export interface AuthClient {
  /**
   * 邮箱密码登录
   */
  signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<ClientAuthResponse>;

  /**
   * 邮箱密码注册
   */
  signUp(params: { email: string; password: string }): Promise<ClientAuthResponse>;

  /**
   * OAuth 登录
   */
  signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }>;

  /**
   * 更新用户信息
   */
  updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }>;

  /**
   * 发送 OTP
   */
  signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }>;

  /**
   * 验证 OTP
   */
  verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<ClientAuthResponse>;

  /**
   * 登出
   */
  signOut(): Promise<{ error: Error | null }>;

  /**
   * 获取当前用户
   */
  getUser(): Promise<{ data: { user: AuthUser | null }; error: Error | null }>;

  /**
   * 获取当前会话
   */
  getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }>;

  /**
   * 监听认证状态变化
   */
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } };
}

/**
 * 获取当前部署区域
 */
function getCurrentRegion(): DeploymentRegion {
  return isChinaDeployment() ? DeploymentRegion.CN : DeploymentRegion.INTL;
}

/**
 * 转换认证响应格式
 */
function convertAuthResponse(authResponse: AuthResponse): ClientAuthResponse {
  if (authResponse.user) {
    return {
      data: {
        user: {
          id: authResponse.user.id,
          email: authResponse.user.email,
          user_metadata: authResponse.user.metadata || {},
        },
        session: authResponse.session ? {
          access_token: authResponse.session.access_token || 'mock-token',
          refresh_token: authResponse.session.refresh_token,
          expires_at: authResponse.session.expires_at,
          user: {
            id: authResponse.user.id,
            email: authResponse.user.email,
            user_metadata: authResponse.user.metadata || {},
          },
        } : null,
      },
      error: authResponse.error || null,
    };
  }

  return {
    data: { user: null, session: null },
    error: authResponse.error || null,
  };
}

/**
 * 认证客户端的命名空间对象
 * 提供类似 supabase.auth 的 API
 */
export const auth = {
  get client() {
    return getAuth();
  },
  signInWithPassword: async (params: { email: string; password: string }) => {
    try {
      const auth = getAuth(getCurrentRegion());
      const result = await auth.signInWithEmail?.(params.email, params.password);
      if (result) {
        return convertAuthResponse(result);
      }
      return { data: { user: null, session: null }, error: new Error('Not supported') };
    } catch (error) {
      return { data: { user: null, session: null }, error: error as Error };
    }
  },
  signUp: async (params: { email: string; password: string }) => {
    try {
      const auth = getAuth(getCurrentRegion());
      const result = await auth.signUpWithEmail?.(params.email, params.password);
      if (result) {
        return convertAuthResponse(result);
      }
      return { data: { user: null, session: null }, error: new Error('Not supported') };
    } catch (error) {
      return { data: { user: null, session: null }, error: error as Error };
    }
  },
  signOut: async () => {
    try {
      const auth = getAuth(getCurrentRegion());
      await auth.signOut();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
  getUser: async () => {
    try {
      const auth = getAuth(getCurrentRegion());
      const user = await auth.getCurrentUser();
      if (user) {
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: user.metadata || {},
            },
          },
          error: null,
        };
      }
      return { data: { user: null }, error: null };
    } catch (error) {
      return { data: { user: null }, error: error as Error };
    }
  },
  getSession: async () => {
    try {
      const auth = getAuth(getCurrentRegion());
      const user = await auth.getCurrentUser();
      if (user) {
        return {
          data: {
            session: {
              access_token: 'mock-token',
              user: {
                id: user.id,
                email: user.email,
                user_metadata: user.metadata || {},
              },
            },
          },
          error: null,
        };
      }
      return { data: { session: null }, error: null };
    } catch (error) {
      return { data: { session: null }, error: error as Error };
    }
  },
  onAuthStateChange: (
    callback: (event: string, session: AuthSession | null) => void
  ) => ({
    data: {
      subscription: { unsubscribe: () => {} },
    },
  }),
  signInWithOAuth: async (params: { provider: string; options?: any }) => {
    try {
      const auth = getAuth(getCurrentRegion());
      await auth.signInWithOAuth?.(params.provider as "google" | "github");
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },
};

/**
 * 获取认证客户端
 */
export function getAuthClient(): AuthClient {
  // 返回一个包装后的客户端对象
  return {
    signInWithPassword: auth.signInWithPassword,
    signUp: auth.signUp,
    signInWithOAuth: auth.signInWithOAuth,
    updateUser: async (params: any) => ({ data: { user: null }, error: new Error('Not implemented') }),
    signInWithOtp: async (params: any) => ({ error: new Error('Not supported') }),
    verifyOtp: async (params: any) => ({ data: { user: null, session: null }, error: new Error('Not supported') }),
    signOut: auth.signOut,
    getUser: auth.getUser,
    getSession: auth.getSession,
    onAuthStateChange: auth.onAuthStateChange,
  };
}