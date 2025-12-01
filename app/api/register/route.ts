import { CloudBaseAuthService } from '@/lib/auth/services/cloudbase-auth'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

// 详细的注册数据验证
const RegisterSchema = z.object({
  name: z.string().min(1, '用户名不能为空').max(50, '用户名不能超过50个字符').optional(),
  email: z.string().email('邮箱格式不正确'),
  password: z.string()
    .min(6, '密码至少需要6个字符')
    .max(100, '密码不能超过100个字符')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 1. 数据验证
    const validationResult = RegisterSchema.safeParse(body)
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => err.message)
      return NextResponse.json(
        { error: errors.join(', ') },
        { status: 400 }
      )
    }

    const { name, email, password } = validationResult.data

    // 2. 实例化认证服务
    const authService = new CloudBaseAuthService()

    // 3. 检查邮箱是否已存在 - 通过 CloudBaseAuthService 的内部方法
    // 我们直接调用 signUpWithEmail，它会自动处理重复检查
    const authResponse = await authService.signUpWithEmail(
      email.trim().toLowerCase(),
      password,
      name?.trim()
    )

    if (authResponse.error) {
      // 处理各种错误情况
      let errorMessage = authResponse.error.message

      // 根据错误消息判断具体错误类型
      if (errorMessage.includes('already exists') || errorMessage.includes('User already exists')) {
        return NextResponse.json(
          { error: '该邮箱已被注册，请使用其他邮箱或直接登录' },
          { status: 409 }
        )
      }

      if (errorMessage.includes('LIMIT_EXCEEDED')) {
        return NextResponse.json({ error: '注册请求过于频繁' }, { status: 429 })
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    if (!authResponse.user) {
      return NextResponse.json(
        { error: '注册失败，请稍后重试' },
        { status: 500 }
      )
    }

    // 4. 返回成功响应
    return NextResponse.json({
      success: true,
      message: '注册成功！',
      user: {
        id: authResponse.user.id,
        email: authResponse.user.email,
        name: authResponse.user.name,
        subscriptionTier: 'free', // 默认免费版
        session: authResponse.session // 返回会话信息供客户端使用
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('注册API错误:', error)

    // 处理特定的错误情况
    if (error.code === 'LIMIT_EXCEEDED') {
      return NextResponse.json({ error: '注册请求过于频繁' }, { status: 429 })
    }

    // 简单的错误回退
    const msg = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}