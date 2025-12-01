/**
 * 认证管理模块 - 适配器模式实现
 *
 * 支持多重认证方式：
 * - 中国区：腾讯云 CloudBase + 微信登录
 * - 国际区：Supabase Auth + OAuth (Google/GitHub)
 */

import { AuthAdapter, AuthResponse, User, DeploymentRegion } from '../core/types';
import { isChinaRegion } from '../config/region';

/**
 * 统一的用户接口
 */
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

/**
 * 认证适配器接口实现
 */
class SupabaseAuthAdapter implements AuthAdapter {
  private supabase: any;

  constructor() {
    // 动态导入 Supabase 客户端
    if (typeof window !== 'undefined') {
      import('@supabase/supabase-js').then(({ createClient }) => {
        // 这里需要从配置中获取 URL 和 Key
        this.supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
      });
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    if (!this.supabase) {
      throw new Error("Supabase 客户端未初始化");
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error };
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        avatar: data.user.user_metadata?.avatar_url,
        createdAt: new Date(data.user.created_at),
        metadata: data.user.user_metadata,
      },
      session: data.session,
    };
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthResponse> {
    if (!this.supabase) {
      throw new Error("Supabase 客户端未初始化");
    }

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { user: null, error };
    }

    return {
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        avatar: data.user.user_metadata?.avatar_url,
        createdAt: new Date(data.user.created_at),
        metadata: data.user.user_metadata,
      } : null,
      session: data.session,
    };
  }

  async signInWithOAuth(provider: "google" | "github"): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase 客户端未初始化");
    }

    await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async signOut(): Promise<void> {
    if (!this.supabase) {
      throw new Error("Supabase 客户端未初始化");
    }

    await this.supabase.auth.signOut();
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.supabase) {
      return null;
    }

    const { data: { user } } = await this.supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name,
      avatar: user.user_metadata?.avatar_url,
      createdAt: new Date(user.created_at),
      metadata: user.user_metadata,
    };
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }
}

/**
 * CloudBase 认证适配器（中国版）
 */
class CloudBaseAuthAdapter implements AuthAdapter {
  constructor() {
    console.log("🔐 CloudBase 认证适配器（国内版）已初始化");
  }

  async signInWithWechat(code: string): Promise<AuthResponse> {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login_wechat", code }),
      });
      const data = await response.json();
      return data.success
        ? { user: data.user }
        : { user: null, error: new Error(data.message) };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          user: null,
          error: new Error(errorData.error || "Login failed"),
        };
      }

      const data = await response.json();
      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword: password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          user: null,
          error: new Error(errorData.error || "Registration failed"),
        };
      }

      const data = await response.json();
      return {
        user: data.user,
        session: data.session,
      };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async toDefaultLoginPage(redirectUrl?: string): Promise<void> {
    // 实现腾讯云默认登录页面跳转
    const authUrl = `https://auth.cloud.tencent.com/login?redirect_uri=${encodeURIComponent(redirectUrl || window.location.href)}`;
    window.location.href = authUrl;
  }

  async signOut(): Promise<void> {
    console.log("✅ 登出");
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth-token");
      localStorage.removeItem("auth-user");
      localStorage.removeItem("auth-logged-in");
    }
  }

  async getCurrentUser(): Promise<User | null> {
    // 从 localStorage 获取用户信息（客户端）
    if (typeof window !== "undefined") {
      const userJson = localStorage.getItem("auth-user");
      const token = localStorage.getItem("auth-token");

      if (userJson && token) {
        try {
          const user = JSON.parse(userJson);
          return {
            id: user.id || user.userId || "",
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
            metadata: { pro: user.pro, region: user.region },
          };
        } catch (e) {
          console.error("Failed to parse user from localStorage:", e);
        }
      }
    }

    // 尝试从服务器获取用户信息
    try {
      const response = await fetch("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          return {
            id: data.user.id || data.user.userId || "",
            email: data.user.email,
            name: data.user.name,
            avatar: data.user.avatar,
            createdAt: data.user.createdAt ? new Date(data.user.createdAt) : undefined,
            metadata: { pro: data.user.pro, region: data.user.region },
          };
        }
      }
    } catch (error) {
      console.error("Failed to fetch current user:", error);
    }

    return null;
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }
}

/**
 * 创建认证适配器
 */
export function createAuthAdapter(region: DeploymentRegion): AuthAdapter {
  if (region === DeploymentRegion.CN) {
    console.log("🔐 使用 CloudBase 认证（中国版）");
    return new CloudBaseAuthAdapter();
  } else {
    console.log("🔐 使用 Supabase 认证（国际版）");
    return new SupabaseAuthAdapter();
  }
}

/**
 * 全局认证实例（单例模式）
 */
let authInstance: AuthAdapter | null = null;

/**
 * 获取认证实例（带默认区域）
 */
export function getAuth(): AuthAdapter;

/**
 * 获取认证实例（指定区域）
 */
export function getAuth(region: DeploymentRegion): AuthAdapter;

export function getAuth(region?: DeploymentRegion): AuthAdapter {
  // 如果没有提供region，使用当前部署区域
  const targetRegion = region || (isChinaRegion() ? DeploymentRegion.CN : DeploymentRegion.INTL);

  if (!authInstance) {
    authInstance = createAuthAdapter(targetRegion);
  }
  return authInstance;
}

/**
 * 检查当前区域是否支持某个认证功能
 */
export function isAuthFeatureSupported(
  feature: string,
  region: DeploymentRegion
): boolean {
  const features = {
    [DeploymentRegion.CN]: {
      emailAuth: true,
      wechatAuth: true,
      googleAuth: false,
      githubAuth: false,
    },
    [DeploymentRegion.INTL]: {
      emailAuth: true,
      wechatAuth: false,
      googleAuth: true,
      githubAuth: true,
    },
  };

  return features[region]?.[feature as keyof typeof features[typeof region]] || false;
}