/**
 * 用户注册 API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDEPLOY_REGION } from '@/lib/config/region';
import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth';
import { SupabaseAuthService } from '@/lib/auth/services/supabase-auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, confirmPassword, name } = await request.json();

    // 输入验证
    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Email, password, and confirm password are required' },
        { status: 400 }
      );
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 密码验证
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // 获取对应的认证服务
    const authService = getDEPLOY_REGION() === 'CN'
      ? new CloudBaseAuthService()
      : new SupabaseAuthService();

    const result = await authService.signUpWithEmail(email, password, name);

    if (result.user) {
      const response = NextResponse.json({
        success: true,
        user: result.user,
        session: result.session,
        message: 'Registration successful'
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
          error: result.error?.message || 'Registration failed',
          code: result.error?.name || 'REGISTRATION_ERROR'
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}