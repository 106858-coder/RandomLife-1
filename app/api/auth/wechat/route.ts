/**
 * 微信登录 API 路由
 * 仅适用于中国地区部署
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDEPLOY_REGION } from '@/lib/config/region';
import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth';

export async function POST(request: NextRequest) {
  try {
    // 检查是否为中国地区
    if (getDEPLOY_REGION() !== 'CN') {
      return NextResponse.json(
        { error: 'WeChat login is only available in China region' },
        { status: 403 }
      );
    }

    const { action, code } = await request.json();

    if (action === 'get-login-url') {
      return getWechatLoginUrl();
    }

    if (action === 'login' && code) {
      return handleWechatLogin(code);
    }

    return NextResponse.json(
      { error: 'Invalid action or missing parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('WeChat auth error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

function getWechatLoginUrl() {
  const appId = process.env.WECHAT_APP_ID;
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/auth/wechat/callback`);

  if (!appId) {
    return NextResponse.json(
      { error: 'WeChat app ID not configured' },
      { status: 500 }
    );
  }

  const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=STATE`;

  return NextResponse.json({
    success: true,
    loginUrl: wechatUrl
  });
}

async function handleWechatLogin(code: string) {
  try {
    const authService = new CloudBaseAuthService();
    const result = await authService.signInWithWechat(code);

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
          error: result.error?.message || 'WeChat login failed',
          code: result.error?.name || 'WECHAT_LOGIN_ERROR'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'WeChat login failed',
        code: 'WECHAT_LOGIN_ERROR'
      },
      { status: 401 }
    );
  }
}