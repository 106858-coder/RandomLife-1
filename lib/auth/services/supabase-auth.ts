/**
 * Supabase 认证服务实现
 * 适用于国际地区部署
 */

import { AuthResponse, User } from '../../core/types';
import { createClient } from '@supabase/supabase-js';

export class SupabaseAuthService {
  private supabase: any = null;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initializationPromise = this.initializeSupabase();
  }

  private async initializeSupabase() {
    // 检查必需的环境变量 - 兼容多种命名方式
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase 环境变量未配置，请检查 .env.local 文件');
      console.warn('需要的变量: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_URL');
      console.warn('需要的变量: NEXT_PUBLIC_SUPABASE_ANON_KEY 或 SUPABASE_ANON_KEY');
      throw new Error('Supabase environment variables not configured');
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('✅ Supabase client initialized');
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      throw error;
    }
  }

  private async waitForInitialization() {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    if (!this.supabase) {
      throw new Error('Supabase client initialization failed');
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      await this.waitForInitialization();

      console.log('🔐 Supabase 开始登录:', { email });

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('🔐 Supabase 登录响应:', { data, error });

      if (error) {
        console.error('🔐 Supabase 登录错误:', error);
        return { user: null, error };
      }

      if (!data.user) {
        console.error('🔐 Supabase 登录: 无用户数据');
        return { user: null, error: new Error('No user data returned') };
      }

      // 尝试确保用户资料存在于 profiles 表中，但不阻塞登录
      try {
        await this.ensureProfileExists(data.user.id, email);
      } catch (profileError) {
        console.warn('⚠️ Profiles 表创建失败，但不影响登录:', profileError);
      }

      const authUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        avatar: data.user.user_metadata?.avatar_url,
        createdAt: new Date(data.user.created_at),
        metadata: {
          ...data.user.user_metadata,
          pro: false, // 默认不是 pro 用户
          region: 'INTL' // 国际版用户
        }
      };

      console.log('✅ Supabase 登录成功:', authUser);

      return {
        user: authUser,
        session: data.session
      };
    } catch (error) {
      console.error('🔐 Supabase 登录异常:', error);
      return { user: null, error: error as Error };
    }
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      await this.waitForInitialization();

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || null,
          }
        }
      });

      if (error) {
        return { user: null, error };
      }

      if (data.user) {
        // 创建用户资料
        await this.createProfile(data.user.id, email, name);
      }

      const authUser: User = {
        id: data.user?.id || '',
        email: data.user?.email,
        name: data.user?.user_metadata?.name,
        avatar: data.user?.user_metadata?.avatar_url,
        createdAt: data.user ? new Date(data.user.created_at) : undefined,
        metadata: data.user?.user_metadata || {}
      };

      return {
        user: authUser,
        session: data.session
      };
    } catch (error) {
      console.error('Supabase sign up error:', error);
      return { user: null, error: error as Error };
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      await this.waitForInitialization();

      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
        }
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Supabase Google sign in error:', error);
      throw error;
    }
  }

  async signInWithGithub(): Promise<void> {
    try {
      await this.waitForInitialization();

      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
        }
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Supabase GitHub sign in error:', error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      console.log('🔍 获取当前用户...');
      await this.waitForInitialization();

      const { data: { user }, error } = await this.supabase.auth.getUser();

      console.log('🔍 Supabase 用户数据:', { user, error });

      if (error || !user) {
        console.log('❌ 无用户或存在错误');
        return null;
      }

      // 获取用户详细资料
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('🔍 用户资料数据:', { profile, profileError });

      const authUser: User = {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name,
        avatar: profile?.avatar_url || user.user_metadata?.avatar_url,
        createdAt: new Date(user.created_at),
        metadata: {
          ...user.user_metadata,
          ...profile,
          pro: profile?.subscription_tier !== 'free',
          region: profile?.region || 'INTL'
        }
      };

      console.log('✅ 构建的用户对象:', authUser);
      return authUser;
    } catch (error) {
      console.error('❌ 获取当前用户异常:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.waitForInitialization();

      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase sign out error:', error);
    }
  }

  async updateUser(updates: {
    name?: string;
    avatar_url?: string;
    email?: string;
  }): Promise<{ user: User | null; error: Error | null }> {
    try {
      await this.waitForInitialization();

      // 更新 auth metadata
      const { data, error } = await this.supabase.auth.updateUser({
        data: updates
      });

      if (error) {
        return { user: null, error };
      }

      // 更新 profiles 表
      if (data.user) {
        await this.supabase
          .from('profiles')
          .update(updates)
          .eq('id', data.user.id);
      }

      const authUser: User = {
        id: data.user?.id || '',
        email: data.user?.email,
        name: data.user?.user_metadata?.name,
        avatar: data.user?.user_metadata?.avatar_url,
        createdAt: data.user ? new Date(data.user.created_at) : undefined,
        metadata: data.user?.user_metadata || {}
      };

      return { user: authUser, error: null };
    } catch (error) {
      console.error('Supabase update user error:', error);
      return { user: null, error: error as Error };
    }
  }

  private async createProfile(userId: string, email: string, name?: string): Promise<void> {
    try {
      console.log('📝 创建用户资料:', { userId, email, name });

      const { data, error } = await this.supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          name: name || null,
          avatar_url: null,
          subscription_tier: 'free',
          region: 'INTL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ 创建用户资料失败:', error);
        throw error;
      }

      console.log('✅ 用户资料创建成功:', data);
    } catch (error) {
      console.error('❌ 创建用户资料异常:', error);
      // 不抛出错误，以免阻塞登录流程
    }
  }

  private async ensureProfileExists(userId: string, email: string): Promise<void> {
    try {
      console.log('🔍 检查用户资料是否存在:', userId);

      // 检查用户资料是否存在
      const { data: profile, error: selectError } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (selectError) {
        if (selectError.code === 'PGRST116') {
          // PGRST116 = no rows returned，用户资料不存在，创建一个
          console.log('📝 用户资料不存在，创建新资料');
          await this.createProfile(userId, email);
        } else {
          console.warn('⚠️ 查询 profile 失败:', selectError);
        }
      } else {
        console.log('✅ 用户资料已存在');
      }
    } catch (error) {
      console.error('❌ 确保资料存在时出错:', error);
      // 不抛出错误，以免阻塞登录流程
    }
  }
}