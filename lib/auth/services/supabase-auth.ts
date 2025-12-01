/**
 * Supabase 认证服务实现
 * 适用于国际地区部署
 */

import { AuthResponse, User } from '../../core/types';
import { createClient } from '@supabase/supabase-js';

export class SupabaseAuthService {
  private supabase: any = null;

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    try {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error };
      }

      // 确保用户资料存在于 profiles 表中
      if (data.user) {
        await this.ensureProfileExists(data.user.id, email);
      }

      const authUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        avatar: data.user.user_metadata?.avatar_url,
        createdAt: new Date(data.user.created_at),
        metadata: data.user.user_metadata || {}
      };

      return {
        user: authUser,
        session: data.session
      };
    } catch (error) {
      console.error('Supabase sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

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
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

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
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

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
      if (!this.supabase) {
        return null;
      }

      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      // 获取用户详细资料
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

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

      return authUser;
    } catch (error) {
      console.error('Supabase get current user error:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (!this.supabase) {
        return;
      }

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
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

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
      await this.supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          name,
          avatar_url: null,
          subscription_tier: 'free',
          region: 'INTL',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  }

  private async ensureProfileExists(userId: string, email: string): Promise<void> {
    try {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) {
        await this.createProfile(userId, email);
      }
    } catch (error) {
      console.error('Error ensuring profile exists:', error);
    }
  }
}