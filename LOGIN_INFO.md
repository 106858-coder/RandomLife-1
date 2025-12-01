# 登录凭据

## 模拟用户账户

请使用以下凭据来测试应用程序不同订阅等级的功能：

### 免费账户 (Free Account)
- **邮箱：** `demo@example.com`
- **密码：** `demo123`
- **等级：** 免费 (无需付费)

### 专业版账户 (Pro Account)
- **邮箱：** `pro@example.com`
- **密码：** `demo123`
- **等级：** 专业版 ($9.99/月)
- **支付方式：** Stripe (演示环境)

### Max 企业版账户 (Max Enterprise Account)
- **邮箱：** `enterprise@example.com`
- **密码：** `demo123`
- **等级：** 企业版 ($49.99/月)
- **支付方式：** PayPal (演示环境)

## 功能特性

### 登录后：
- 点击右上角的 **设置** 图标 (⚙️) 进入账户设置
- **账户 (Account) 标签页**：查看您的订阅等级和支付方式
- **支付 (Payment) 标签页**：添加或更新支付信息（信用卡详情）
- **专业版 (Pro) 标签页**：查看订阅选项并进行升级/降级操作
- 点击顶部的 **Pro** 链接可查看完整的定价页面，包含：
  - 3 种订阅等级（免费版、专业版、Max 企业版）
  - Stripe 和 PayPal 支付选项
  - 详细的功能对比
  - 常见问题 (FAQ) 版块

## 运行应用程序

```bash
# 安装依赖
pnpm install

# 运行数据库迁移
npx prisma migrate dev

# 填充模拟用户数据（如果尚未完成）
pnpm run seed

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000 并使用上述凭据登录！