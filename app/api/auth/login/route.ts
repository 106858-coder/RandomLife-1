/**
 * 用户登录 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDEPLOY_REGION } from '@/lib/config/region';
import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth';
import { SupabaseAuthService } from '@/lib/auth/services/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 获取对应的认证服务
    const authService = getDEPLOY_REGION() === 'CN'
      ? new CloudBaseAuthService()
      : new SupabaseAuthService();

    const result = await authService.signInWithEmail(email, password);

    if (result.user) {
      const response = NextResponse.json({
        success: true,
        user: result.user,
        session: result.session
      });

      // 设置认证 token 到 cookie
      if (result.session?.access_token) {
        response.cookies.set('auth-token', result.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: '/'
        });
      }

      return response;
    } else {
      return NextResponse.json(
        {
          error: result.error?.message || 'Login failed',
          code: result.error?.name || 'AUTH_ERROR'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}