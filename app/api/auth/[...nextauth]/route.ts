/**
 * NextAuth 配置 - 兼容原有配置但使用新的认证系统
 *
 * 注意：主要的认证逻辑已经迁移到自定义的 API 路由中
 * 这个文件主要用于保持与现有客户端代码的兼容性
 */

import NextAuth, { AuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

// 自定义认证验证器
async function authorizeUser(credentials: any) {
  try {
    const { email, password } = credentials;

    if (!email || !password) {
      return null;
    }

    // 调用我们的认证 API
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.success && data.user) {
      return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        image: data.user.avatar,
      };
    }

    return null;
  } catch (error) {
    console.error('NextAuth authorize error:', error);
    return null;
  }
}

export const authOptions: AuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizeUser,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.userId = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = (token as any).userId;
      }

      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

