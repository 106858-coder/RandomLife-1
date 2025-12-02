"use client"
import type { ReactNode } from 'react'

export default function AuthProvider({ children }: { children: ReactNode }) {
  // 简单的认证上下文提供者
  // 实际的认证状态通过各页面的 auth.getUser() 来获取
  return <>{children}</>
}


