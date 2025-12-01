import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // 1. 实例化认证服务
    const authService = new CloudBaseAuthService()

    // 2. 获取当前用户 - 从请求头获取token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 })
    }

    // 3. 验证token并获取用户信息
    const currentUser = await authService.validateTokenAndGetUser(token)

    if (!currentUser) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    // 4. 更新用户订阅等级为 pro
    await authService.updateUserSubscription(currentUser.id, 'pro')

    return NextResponse.json({
      success: true,
      subscriptionTier: 'pro',
      userId: currentUser.id
    }, { status: 200 })

  } catch (error) {
    console.error('Upgrade failed:', error)
    return NextResponse.json({
      error: 'Upgrade failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}