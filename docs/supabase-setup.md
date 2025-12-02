# Supabase 设置指南

## 邮箱确认问题解决方案

当前登录失败是因为 Supabase 默认要求用户确认邮箱后才能登录。有以下几种解决方案：

### 方案1：禁用邮箱确认（推荐用于开发/测试）

在 Supabase Dashboard 中：

1. 进入 **Authentication** -> **Settings**
2. 找到 **Email confirmation** 设置
3. 取消勾选 **Confirm email signups**
4. 点击 **Save**

这样用户注册后就可以直接登录，无需确认邮件。

### 方案2：手动确认现有用户

如果你���经有未确认的用户账号，可以在 Supabase Dashboard 中手动确认：

1. 进入 **Authentication** -> **Users**
2. 找到需要确认的用户
3. 点击用户邮箱旁的 **✓** 图标
4. 或者点击用户进入详情页，设置 **Email confirmed** 为 `true`

### 方案3：使用当前的重发邮件功能

应用已经集成了重发确认邮件的功能：

1. 在登录页面输入邮箱密码
2. 如果提示"邮箱尚未确认"，点击"重新发送确认邮件"按钮
3. 检查邮箱并点击确认链接

### 方案4：修改用户表直接确认

在 Supabase SQL Editor 中运行：

```sql
-- 确认所有用户的邮箱
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

## 完整的 profiles 表设置

1. 在 Supabase SQL Editor 中运行 `supabase/profiles.sql` 中的脚本
2. 确保表结构与你的应用代码匹配

## 环境变量检查

确保你的 `.env.local` 文件包含：

```env
NEXT_PUBLIC_DEPLOYMENT_REGION=INTL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 测试步骤

1. 首先禁用邮箱确认（方案1）
2. 注册一个新用户
3. 立即尝试登录
4. 检查控制台日志，应该看到成功的登录流程
5. 确认用户资料在 profiles 表中创建成功

## 常见问题

### Q: 为什么注册成功但登录失败？
A: 这是因为 Supabase 默认需要邮箱确认。使用方案1快速解决。

### Q: 如何检查用户是否已确认邮箱？
A: 在 Supabase Dashboard -> Authentication -> Users 中查看用户的 Email Confirmed 状态。

### Q: 登录时出现 "Invalid login credentials"？
A: 检查邮箱密码是否正确，或者用户是否真的存在于 auth.users 表中。

### Q: profiles 表中的数据没有创建？
A: 检查 Supabase 日志，可能是 RLS 策略阻止了插入操作。确保运行了 profiles.sql 中的安全策略设置。