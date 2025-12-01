# 认证系统开发文档 - 基于 lib/auth 模块

## 概述

本文档详细说明了基于 `lib/auth` 模块的多区域认证系统架构，支持邮箱登录/注册和微信登录功能。该系统采用适配器模式，支持中国区（CloudBase）和国际区（Supabase）两套不同的认证后端。

## 系统架构

### 1. 核心架构设计

```
lib/auth/
├── index.ts           # 统一导出模块
├── client.ts          # 前端认证客户端
└── adapter.ts         # 认证适配器实现
```

### 2. 支持的认证方式

#### 中国区 (DeploymentRegion.CN)
- **邮箱密码认证**: 基于腾讯云 CloudBase
- **微信登录**: 基于微信开放平台
- **数据库**: 腾讯云 CloudBase

#### 国际区 (DeploymentRegion.INTL)
- **邮箱密码认证**: 基于 Supabase Auth
- **OAuth 登录**: Google、GitHub
- **数据库**: Supabase PostgreSQL

### 3. 适配器模式实现

系统采用适配器模式，通过 `AuthAdapter` 接口统一不同认证后端的 API：

```typescript
interface AuthAdapter {
  signInWithEmail?(email: string, password: string): Promise<AuthResponse>;
  signUpWithEmail?(email: string, password: string): Promise<AuthResponse>;
  signInWithWechat?(code: string): Promise<AuthResponse>;
  signInWithOAuth?(provider: "google" | "github"): Promise<void>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  isAuthenticated(): Promise<boolean>;
}
```

## 邮箱登录/注册功能

### 1. 前端页面结构

#### 登录页面 (`app/login/page.tsx`)
```typescript
"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/auth/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await auth.signInWithPassword({ email, password })
      if (result.data.user) {
        router.push('/')
      } else {
        setError(result.error?.message || '登录失败')
      }
    } catch (error) {
      setError('登录过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-24">
      <h1 className="text-2xl font-semibold mb-6">登录</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '登录中...' : '登录'}
        </Button>
      </form>
    </div>
  )
}
```

#### 注册页面 (`app/register/page.tsx`)
```typescript
"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/auth/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      setLoading(false)
      return
    }

    try {
      const result = await auth.signUp({ email, password })
      if (result.data.user) {
        router.push('/login?message=注册成功，请登录')
      } else {
        setError(result.error?.message || '注册失败')
      }
    } catch (error) {
      setError('注册过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm py-24">
      <h1 className="text-2xl font-semibold mb-6">注册</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="密码"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="确认密码"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '注册中...' : '注册'}
        </Button>
      </form>
    </div>
  )
}
```

### 2. API 路由实现

#### 注册 API (`app/api/register/route.ts`)
```typescript
import { CloudBaseService } from '@/lib/cloudbase'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

// 数据验证模式
const RegisterSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  email: z.string().email(),
  password: z.string()
    .min(6)
    .max(100)
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, '密码必须包含字母和数字'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 数据验证
    const validationResult = RegisterSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors.map(err => err.message).join(', ') },
        { status: 400 }
      )
    }

    const { name, email, password } = validationResult.data

    // 检查邮箱是否已存在
    const emailExists = await CloudBaseService.isEmailExists(email.trim().toLowerCase())
    if (emailExists) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 409 }
      )
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const newUserData = {
      name: name?.trim() || undefined,
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      subscriptionTier: 'free',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await CloudBaseService.createUser(newUserData)

    return NextResponse.json({
      success: true,
      message: '注册成功！',
      user: {
        id: result.id,
        email: newUserData.email,
        name: newUserData.name,
        subscriptionTier: newUserData.subscriptionTier
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error('注册API错误:', error)
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    )
  }
}
```

#### 认证 API (`app/api/auth/[...nextauth]/route.ts`)
```typescript
import NextAuth, { AuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      if (token?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email }
        })
        if (dbUser) {
          token.userId = dbUser.id
          ;(token as any).subscriptionTier = dbUser.subscriptionTier
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = (token as any).userId
        ;(session.user as any).subscriptionTier = (token as any).subscriptionTier
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

## 微信登录功能

### 1. 微信登录组件

```typescript
"use client"
import { useState } from 'react'
import { auth } from '@/lib/auth/client'

interface WeChatLoginButtonProps {
  onSuccess?: (user: any) => void
  onError?: (error: Error) => void
}

export function WeChatLoginButton({ onSuccess, onError }: WeChatLoginButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleWeChatLogin = async () => {
    setLoading(true)

    try {
      // 获取微信授权链接
      const authUrl = await getWeChatAuthUrl()

      // 跳转到微信授权页面
      window.location.href = authUrl

    } catch (error) {
      onError?.(error as Error)
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleWeChatLogin}
      disabled={loading}
      className="w-full bg-green-500 hover:bg-green-600"
    >
      {loading ? '登录中...' : '微信登录'}
    </Button>
  )
}

// 获取微信授权 URL
async function getWeChatAuthUrl(): Promise<string> {
  const response = await fetch('/api/auth/wechat/login-url')
  const data = await response.json()
  return data.authUrl
}
```

### 2. 微信授权 URL 获取

```typescript
// app/api/auth/wechat/login-url/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const appId = process.env.WECHAT_APP_ID
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/wechat`)
  const scope = 'snsapi_userinfo'
  const state = Math.random().toString(36).substr(2, 9)

  const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`

  return NextResponse.json({ authUrl })
}
```

### 3. 微信回调处理

```typescript
// app/api/auth/callback/wechat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/adapter'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.redirect('/login?error=wechat_auth_failed')
  }

  try {
    // 使用认证适配器处理微信登录
    const authAdapter = auth.getAdapter()
    const result = await authAdapter.signInWithWechat(code)

    if (result.user) {
      // 设置会话或重定向到成功页面
      return NextResponse.redirect('/?login=success')
    } else {
      return NextResponse.redirect('/login?error=wechat_login_failed')
    }
  } catch (error) {
    console.error('微信登录错误:', error)
    return NextResponse.redirect('/login?error=wechat_login_error')
  }
}
```

## 核心认证模块使用

### 1. 客户端认证使用

```typescript
import { auth } from '@/lib/auth/client'

// 登录
const loginResult = await auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

// 注册
const registerResult = await auth.signUp({
  email: 'user@example.com',
  password: 'password123'
})

// 获取当前用户
const { data: { user } } = await auth.getUser()

// 获取当前会话
const { data: { session } } = await auth.getSession()

// 登出
await auth.signOut()

// OAuth 登录
await auth.signInWithOAuth({ provider: 'google' })
```

### 2. 服务端认证使用

```typescript
import { getAuth } from '@/lib/auth/adapter'

// 获取认证适配器
const authAdapter = getAuth()

// 检查用户认证状态
const isAuthenticated = await authAdapter.isAuthenticated()

// 获取当前用户
const currentUser = await authAdapter.getCurrentUser()

// 邮箱登录
const loginResult = await authAdapter.signInWithEmail(email, password)

// 微信登录
const wechatResult = await authAdapter.signInWithWechat(code)
```

## 环境配置

### 1. 中国区环境变量

```env
# 腾讯云 CloudBase 配置
WECHAT_CLOUDBASE_ID=your-cloudbase-env-id

# 微信开放平台配置
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret

# 部署区域
NEXT_PUBLIC_DEPLOYMENT_REGION=CN
```

### 2. 国际区环境变量

```env
# Supabase 配置
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# OAuth 配置
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# 部署区域
NEXT_PUBLIC_DEPLOYMENT_REGION=INTL
```

## 安全考虑

### 1. 密码安全
- 使用 bcrypt 进行密码哈希，成本因子设置为 12
- 密码强度要求：至少6位，包含字母和数字
- 前端和后端双重验证

### 2. 会话管理
- 使用 JWT token 进行会话管理
- 支持令牌刷新机制
- 安全的令牌存储（localStorage 或 httpOnly cookies）

### 3. 数据验证
- 使用 Zod 进行严格的数据验证
- 防止 SQL 注入和 XSS 攻击
- 输入数据的清理和转义

### 4. CORS 和安全头
- 配置适当的 CORS 策略
- 设置安全相关的 HTTP 头
- 防止 CSRF 攻击

## 错误处理

### 1. 常见错误类型

```typescript
// 认证错误
enum AuthError {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  NETWORK_ERROR = 'NETWORK_ERROR',
}
```

### 2. 错误处理示例

```typescript
const handleAuthError = (error: any) => {
  if (error.code === 'EMAIL_ALREADY_EXISTS') {
    return '该邮箱已被注册，请直接登录'
  }
  if (error.code === 'INVALID_CREDENTIALS') {
    return '邮箱或密码错误'
  }
  if (error.code === 'WEAK_PASSWORD') {
    return '密码强度不够，请使用更复杂的密码'
  }
  return '认证过程中发生错误，请稍后重试'
}
```

## 测试策略

### 1. 单元测试

```typescript
// 测试认证适配器
describe('AuthAdapter', () => {
  it('should sign in with email and password', async () => {
    const adapter = new CloudBaseAuthAdapter()
    const result = await adapter.signInWithEmail('test@example.com', 'password123')
    expect(result.user).toBeTruthy()
  })

  it('should handle invalid credentials', async () => {
    const adapter = new CloudBaseAuthAdapter()
    const result = await adapter.signInWithEmail('test@example.com', 'wrongpassword')
    expect(result.error).toBeTruthy()
  })
})
```

### 2. 集成测试

```typescript
// 测试完整的认证流程
describe('Authentication Flow', () => {
  it('should complete registration and login flow', async () => {
    // 注册用户
    const registerResponse = await POST('/api/register', {
      email: 'test@example.com',
      password: 'password123'
    })

    expect(registerResponse.status).toBe(201)

    // 登录用户
    const loginResponse = await POST('/api/auth/callback/credentials', {
      email: 'test@example.com',
      password: 'password123'
    })

    expect(loginResponse.status).toBe(200)
  })
})
```

## 部署和监控

### 1. 健康检查

```typescript
// 认证系统健康检查
export async function authHealthCheck() {
  const checks = []

  try {
    const authAdapter = getAuth()
    await authAdapter.isAuthenticated()
    checks.push({ name: 'auth', status: 'pass' })
  } catch (error) {
    checks.push({ name: 'auth', status: 'fail', error: error.message })
  }

  return {
    healthy: checks.every(check => check.status === 'pass'),
    checks
  }
}
```

### 2. 性能监控

- 认证请求响应时间监控
- 认证成功率统计
- 错误日志收集和分析
- 用户行为分析

## 最佳实践

### 1. 代码组织
- 保持认证逻辑的模块化
- 使用 TypeScript 提供类型安全
- 遵循单一职责原则

### 2. 用户体验
- 提供清晰的错误提示
- 支持表单验证和实时反馈
- 优雅的加载状态处理

### 3. 可维护性
- 定期更新依赖包
- 定期审查安全配置
- 保持文档的及时更新

## 总结

基于 `lib/auth` 模块的认证系统提供了：

1. **多区域支持**: 自动适配中国区和国际区的不同认证需求
2. **灵活的认证方式**: 支持邮箱密码、微信、OAuth等多种认证方式
3. **统一API接口**: 通过适配器模式提供一致的开发体验
4. **安全保障**: 完善的安全措施和错误处理机制
5. **易于扩展**: 模块化设计便于后续功能扩展

该系统能够满足不同地区的认证需求，为用户提供安全、便捷的登录体验。