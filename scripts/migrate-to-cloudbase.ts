// 迁移时，需要有Prisma原型文件和依赖。
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import CloudBase from '@cloudbase/node-sdk'
import bcrypt from 'bcryptjs'

// 初始化源数据库(Prisma)
const prisma = new PrismaClient()

// 初始化目标数据库(CloudBase)
const cloudBase = CloudBase.init({
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
    envId: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID
})

const db = cloudBase.database()
const usersCollection = db.collection('users')

async function migrateUsers() {
    try {
        console.log('开始迁移用户数据...')

        // 获取SQLite中的所有用户
        const users = await prisma.user.findMany()
        console.log(`找到 ${users.length} 个用户`)

        // 批量插入到CloudBase
        const migrationPromises = users.map(async (user) => {
            try {
                const cloudBaseUser = {
                    _id: user.id,
                    name: user.name,
                    email: user.email,
                    password: user.password, // 密码已经是bcrypt加密过的
                    subscriptionTier: user.subscriptionTier,
                    subscriptionId: user.subscriptionId,
                    paymentMethod: user.paymentMethod,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }

                await usersCollection.add(cloudBaseUser)
                console.log(`✅ 用户 ${user.email} 迁移成功`)
            } catch (error) {
                console.error(`❌ 用户 ${user.email} 迁移失败:`, error)
            }
        })

        await Promise.all(migrationPromises)
        console.log('🎉 用户数据迁移完成!')

    } catch (error) {
        console.error('迁移过程中发生错误:', error)
    } finally {
        await prisma.$disconnect()
    }
}

// 执行迁移
migrateUsers()