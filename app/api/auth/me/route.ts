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
    // 从 cookie 中获取 token
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token found' },
        { status: 401 }
      );
    }

    // 获取对应的认证服务
    const authService = getDEPLOY_REGION() === 'CN'
      ? new CloudBaseAuthService()
      : new SupabaseAuthService();

    const user = await authService.getCurrentUser();

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
    console.error('Get user info error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}