/**
 * 获取当前用户信息 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDEPLOY_REGION } from '@/lib/config/region';
import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth';
import { SupabaseAuthService } from '@/lib/auth/services/supabase-auth';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: 获取用户信息请求');

    // 从 cookie 中获取 token
    const token = request.cookies.get('auth-token')?.value;

    console.log('🔍 API: Token 状态:', token ? '存在' : '不存在');

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      );
    }

    // 获取对应的认证服务
    const isChina = getDEPLOY_REGION() === 'CN';
    console.log('🔍 API: 部署区域:', isChina ? 'CN' : 'INTL');

    const authService = isChina
      ? new CloudBaseAuthService()
      : new SupabaseAuthService();

    let user;

    if (isChina) {
      // CloudBase 服务需要验证 token
      user = await authService.validateTokenAndGetUser(token);
    } else {
      // Supabase 服务 - 使用 token 获取用户
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase 环境变量未配置');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

        console.log('🔍 API: Supabase 用户查询结果:', { user: supabaseUser, error });

        if (error) {
          console.error('🔍 API: Supabase 用户查询错误:', error);
          user = null;
        } else if (supabaseUser) {
          user = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name,
            avatar: supabaseUser.user_metadata?.avatar_url,
            createdAt: new Date(supabaseUser.created_at),
            metadata: {
              ...supabaseUser.user_metadata,
              pro: false,
              region: 'INTL'
            }
          };
        } else {
          user = null;
        }
      } catch (supabaseError) {
        console.error('🔍 API: Supabase 初始化错误:', supabaseError);
        user = await authService.getCurrentUser();
      }
    }

    console.log('🔍 API: 最终用户数据:', user);

    if (user) {
      return NextResponse.json({
        success: true,
        user
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('🔍 API: Get user info error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}