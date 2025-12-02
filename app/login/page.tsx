"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { auth } from '@/lib/auth/client'
import { isChinaDeployment } from '@/lib/config/deployment'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isChinaRegion = isChinaDeployment()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      console.log('🔐 开始登录:', { email, region: isChinaRegion ? 'CN' : 'INTL' })

      // 使用新的认证 API
      const response = await auth.signInWithPassword({ email, password })

      console.log('🔐 登录响应:', response)

      if (response.data.user) {
        console.log('✅ 登录成功，用户:', response.data.user)

        // 保存 token 到 cookie（如果存在）
        if (response.data.session?.access_token) {
          document.cookie = `auth-token=${response.data.session.access_token}; path=/; max-age=604800`
        }

        router.push('/')
        router.refresh()
      } else {
        console.log('❌ 登录失败:', response.error)

        // 处理特定的错误类型
        const errorMessage = response.error?.message || '登录失败'

        if (errorMessage.includes('Email not confirmed')) {
          setError('邮箱尚未确认，请检查您的邮箱并点击确认链接。如果没有收到邮件，请点击下方的"重新发送确认邮件"按钮。')
        } else if (errorMessage.includes('Invalid login credentials')) {
          setError('邮箱或密码错误，请重新输入。')
        } else if (errorMessage.includes('Too many requests')) {
          setError('登录尝试次数过多，请稍后再试。')
        } else {
          setError(errorMessage)
        }
      }
    } catch (err) {
      console.error('🔐 登录异常:', err)
      setError('登录服务暂时不可用，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  const handleWeChatLogin = async () => {
    try {
      const response = await fetch('/api/auth/wechat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get-login-url' }),
      })

      const data = await response.json()

      if (data.success) {
        window.location.href = data.loginUrl
      } else {
        setError(data.error || '微信登录失败')
      }
    } catch (err) {
      setError('微信登录服务暂时不可用')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await auth.signInWithOAuth({ provider: 'google' })
    } catch (err) {
      setError('Google 登录服务暂时不可用')
    }
  }

  const handleGithubLogin = async () => {
    try {
      await auth.signInWithOAuth({ provider: 'github' })
    } catch (err) {
      setError('GitHub 登录服务暂时不可用')
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('请先输入邮箱地址')
      return
    }

    setLoading(true)
    try {
      // 调用 Supabase API 重新发送确认邮件
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
        },
        body: JSON.stringify({
          email: email,
          type: 'signup'
        })
      })

      if (response.ok) {
        setError('确认邮件已重新发送，请检查您的邮箱。')
      } else {
        const data = await response.json()
        setError(`发送确认邮件失败: ${data.message || '未知错误'}`)
      }
    } catch (err) {
      console.error('重发确认邮件错误:', err)
      setError('发送确认邮件时发生错误，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录到您的账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            或者{' '}
            <Link href="/register" className="font-medium text-green-600 hover:text-green-500">
              创建新账户
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                邮箱地址
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">
              <div>{error}</div>
              {error.includes('邮箱尚未确认') && (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResendConfirmation}
                    disabled={loading}
                    className="text-xs"
                  >
                    {loading ? '发送中...' : '重新发送确认邮件'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4"
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">或者使用</span>
            </div>
          </div>

          <div className="space-y-3">
            {/* 微信登录 - 仅中国地区 */}
            {isChinaRegion && (
              <Button
                type="button"
                variant="outline"
                onClick={handleWeChatLogin}
                className="w-full flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
                微信登录
              </Button>
            )}

            {/* Google 登录 - 仅国际地区 */}
            {!isChinaRegion && (
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google 登录
              </Button>
            )}

            {/* GitHub 登录 - 仅国际地区 */}
            {!isChinaRegion && (
              <Button
                type="button"
                variant="outline"
                onClick={handleGithubLogin}
                className="w-full flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub 登录
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}


