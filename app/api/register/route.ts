import { CloudBaseService } from '@/lib/cloudbase'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
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

    // 2. 检查邮箱是否已存在
    const emailExists = await CloudBaseService.isEmailExists(email.trim().toLowerCase())
    if (emailExists) {
      return NextResponse.json(
        { error: '该邮箱已被注册，请使用其他邮箱或直接登录' },
        { status: 409 }
      )
    }

    // 3. 密码加密
    const hashedPassword = await bcrypt.hash(password, 12)

    // 4. 准备用户数据对象 (先存到一个变量里)
    const newUserData = {
      name: name?.trim() || undefined,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      subscriptionTier: 'free', // 确保默认是 free
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // 5. 创建用户
    // 注意：result 只包含 { id: "...", requestId: "..." }
    const result = await CloudBaseService.createUser(newUserData)

    // 6. 返回成功响应
    // 关键修正：直接使用上面的 newUserData 变量，而不是从 result 里读
    return NextResponse.json({
      success: true,
      message: '注册成功！',
      user: {
        id: result.id, // SDK 返回的新 ID (数据库里的 _id)
        email: newUserData.email,
        name: newUserData.name,
        subscriptionTier: newUserData.subscriptionTier
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('注册API错误:', error)

    if (error.code === 'LIMIT_EXCEEDED') {
      return NextResponse.json({ error: '注册请求过于频繁' }, { status: 429 })
    }

    // 简单的错误回退
    const msg = error instanceof Error ? error.message : '服务器错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
