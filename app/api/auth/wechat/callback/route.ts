/**
 * 微信登录回调处理
 */

import { NextRequest, NextResponse } from 'next/server';

// 强制动态渲染
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(
        new URL('/login?error=wechat_callback_failed', request.url)
      );
    }

    // 重定向到前端页面，带上授权码
    const callbackUrl = `/auth/wechat/callback?code=${code}&state=${state || ''}`;

    return NextResponse.redirect(
      new URL(callbackUrl, process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (error) {
    console.error('WeChat callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=wechat_callback_error', request.url)
    );
  }
}