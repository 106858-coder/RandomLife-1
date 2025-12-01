import { getServerSession } from 'next-auth'
import { CloudBaseService } from '@/lib/cloudbase'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { NextResponse } from 'next/server'

export async function POST() {
  // 1. 获取当前用户 session
  const session = await getServerSession(authOptions)

  // 检查是否登录
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. 先找到用户的 ID (CloudBase 更新通常需要 _id)
    const userId = (session.user as any).id

    if (!userId) {
      //以此为保险，如果session里没id，用email查一下
      const user = await CloudBaseService.findUser({ email: session.user.email })
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      // 3. 执行更新：将 subscriptionTier 设为 'pro'
      await CloudBaseService.updateUser(user._id, {
        subscriptionTier: 'pro',
      })
    } else {
      // 直接用 Session 里的 ID 更新
      await CloudBaseService.updateUser(userId, {
        subscriptionTier: 'pro'
      })
    }

    return NextResponse.json({ success: true, subscriptionTier: 'pro' }, { status: 200 })

  } catch (error) {
    console.error('Update failed:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}