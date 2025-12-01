/**
 * 统一认证 API 路由
 *
 * 根据部署区域自动选择认证后端：
 * - 中国区：CloudBase 认证
 * - 国际区：Supabase 认证
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDEPLOY_REGION } from '@/lib/config/region';
import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth';
import { SupabaseAuthService } from '@/lib/auth/services/supabase-auth';

// 动态获取认证服务
function getAuthService() {
  const region = getDEPLOY_REGION();
  return region === 'CN' ? new CloudBaseAuthService() : new SupabaseAuthService();
}

export async function POST(request: NextRequest) {
  try {
    const { action, ...credentials } = await request.json();
    const authService = getAuthService();

    switch (action) {
      case 'login':
        return handleLogin(authService, credentials);
      case 'register':
        return handleRegister(authService, credentials);
      case 'login_wechat':
        return handleWechatLogin(authService, credentials);
      case 'logout':
        return handleLogout(authService);
      case 'refresh':
        return handleRefreshToken(authService);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleLogin(authService: any, credentials: { email: string; password: string }) {
  const { email, password } = credentials;

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: 'Email and password are required' },
      { status: 400 }
    );
  }

  try {
    const result = await authService.signInWithEmail(email, password);

    if (result.user) {
      // 设置 HTTP-only cookie
      const response = NextResponse.json({
        success: true,
        user: result.user,
        session: result.session
      });

      if (result.session?.access_token) {
        response.cookies.set('auth-token', result.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }

      return response;
    } else {
      return NextResponse.json(
        { success: false, error: result.error?.message || 'Login failed' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Login failed' },
      { status: 401 }
    );
  }
}

async function handleRegister(authService: any, credentials: {
  email: string;
  password: string;
  confirmPassword: string;
  name?: string;
}) {
  const { email, password, confirmPassword, name } = credentials;

  if (!email || !password || !confirmPassword) {
    return NextResponse.json(
      { success: false, error: 'All fields are required' },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { success: false, error: 'Passwords do not match' },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 6 characters long' },
      { status: 400 }
    );
  }

  try {
    const result = await authService.signUpWithEmail(email, password, name);

    if (result.user) {
      const response = NextResponse.json({
        success: true,
        user: result.user,
        session: result.session,
        message: 'Registration successful'
      });

      if (result.session?.access_token) {
        response.cookies.set('auth-token', result.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }

      return response;
    } else {
      return NextResponse.json(
        { success: false, error: result.error?.message || 'Registration failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 400 }
    );
  }
}

async function handleWechatLogin(authService: any, credentials: { code: string }) {
  const { code } = credentials;

  if (!code) {
    return NextResponse.json(
      { success: false, error: 'Wechat authorization code is required' },
      { status: 400 }
    );
  }

  try {
    const result = await authService.signInWithWechat?.(code);

    if (result?.user) {
      const response = NextResponse.json({
        success: true,
        user: result.user,
        session: result.session
      });

      if (result.session?.access_token) {
        response.cookies.set('auth-token', result.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
      }

      return response;
    } else {
      return NextResponse.json(
        { success: false, error: result?.error?.message || 'Wechat login failed' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Wechat login failed' },
      { status: 401 }
    );
  }
}

async function handleLogout(authService: any) {
  try {
    await authService.signOut();

    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    });

    // 清除认证 cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Logout failed' },
      { status: 500 }
    );
  }
}

async function handleRefreshToken(authService: any) {
  try {
    const user = await authService.getCurrentUser();

    if (user) {
      return NextResponse.json({
        success: true,
        user
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' },
      { status: 401 }
    );
  }
}