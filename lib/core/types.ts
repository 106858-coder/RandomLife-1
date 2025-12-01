/**
 * 核心类型定义 - 整个架构的基础类型
 */

/**
 * 地理区域类型枚举
 * 用于标识用户所在的大区域，影响货币、支付方式、合规要求等
 */
export enum RegionType {
  CHINA = "china",       // 中国大陆
  USA = "usa",            // 美国
  EUROPE = "europe",      // 欧洲
  INDIA = "india",        // 印度
  SINGAPORE = "singapore",// 新加坡
  OTHER = "other",        // 其他地区
}

/**
 * 部署区域枚举
 * CN    → 国内（腾讯云、CloudBase、阿里云等）
 * INTL  → 国际（Vercel、Supabase、Stripe 等）
 */
export enum DeploymentRegion {
  CN = "CN",
  INTL = "INTL"
}

/**
 * 根据 IP 或其他信息解析得到的地理位置结果
 * 该对象决定当前请求应该走哪套支付方式、哪套数据库、是否需要 GDPR 合规等
 */
export interface GeoResult {
  /** 大区域分类 */
  region: RegionType;
  /** ISO 3166-1 alpha-2 国家码，例如 CN、US、DE */
  countryCode: string;
  /** 默认货币代码，例如 CNY、USD、EUR */
  currency: string;
  /** 该地区支持的支付方式 */
  paymentMethods: string[];
  /** 该地区支持的认证方式（邮箱、微信、Google 等） */
  authMethods: string[];
  /** 使用的数据库后端 */
  database: "supabase" | "cloudbase";
  /** 部署平台 */
  deployment: "vercel" | "tencent";
  /** 是否需要满足 GDPR 等隐私法规要求 */
  gdprCompliant: boolean;
}

/**
 * 用户资料表（通常对应 users / profiles 表）
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;               // 姓名，可选
  avatar?: string;                  // 头像 URL，可选
  subscription_plan?: "free" | "premium" | "pro"; // 当前订阅套餐
  membership_expires_at?: string;   // 会员到期时间（ISO 字符串）
  region?: string;                  // 用户所在地区（可用于后续分库分表）
  pro?: boolean;                    // 是否为 Pro 用户（冗余字段，便于快速查询）
  createdAt?: string;               // 账号创建时间
  metadata?: Record<string, any>;   // 其他自定义扩展字段
}

/**
 * 支付记录表（一条记录对应一次真实的付款行为）
 */
export interface PaymentRecord {
  id: string;                       // 本地支付记录 ID
  user_id: string;                  // 关联用户
  order_id: string;                 // 业务订单号（可能与第三方订单号不同）
  payment_method: "alipay" | "wechat" | "stripe" | "paypal"; // 支付方式
  amount: number;                   // 支付金额（单位：分或元，视业务而定）
  currency: string;                 // 货币代码
  status: "pending" | "completed" | "failed" | "refunded"; // 支付状态
  external_id?: string;             // 第三方支付平台订单号（如 Stripe 的 pi_xxx）
  created_at: string;               // 创建时间（ISO）
  updated_at: string;               // 最后更新时间（ISO）
}

/**
 * 创建支付订单时前端传给后端的参数
 */
export interface PaymentOrder {
  amount: number;                   // 金额（单位同上）
  currency: string;                 // 货币
  description: string;              // 订单描述，用于展示给用户
  userId: string;                   // 用户 ID
  planType: string;                 // 订阅套餐类型（如 "premium_monthly"）
  billingCycle: "monthly" | "yearly"; // 计费周期
  metadata?: Record<string, any>;   // 额外信息，可传给支付网关
}

/**
 * 发起支付后后端返回的结果
 */
export interface PaymentResult {
  success: boolean;                 // 是否成功创建支付订单
  paymentId?: string;               // 本地支付记录 ID
  paymentUrl?: string;              // H5/Web 支付跳转链接（Stripe、PayPal 等）
  qrCode?: string;                  // 微信/支付宝扫码支付时返回的二维码 base64 或 URL
  error?: string;                   // 失败时的错误信息
}

/**
 * 支付平台异步通知或前端轮询时，用于确认支付是否成功的结构
 */
export interface PaymentConfirmation {
  success: boolean;
  transactionId: string;            // 第三方交易 ID
  amount: number;
  currency: string;
}

/**
 * 退款接口返回结构
 */
export interface RefundResult {
  success: boolean;
  refundId: string;                 // 退款单 ID（本地或第三方）
  amount: number;                   // 退款金额
}

/**
 * 统一的用户对象（登录后返回给前端的核心信息）
 */
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  phone?: string;
  createdAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * 认证（Auth）相关接口统一返回格式
 */
export interface AuthResponse {
  user: User | null;                // 成功时返回用户信息，失败时为 null
  session?: any;                        // 会话信息（Supabase/CloudBase 各自的 session 对象）
  error?: Error | null;                 // 错误对象
}

/**
 * 认证适配器抽象接口
 * 业务层通过实现不同的提供商（Supabase、CloudBase、自定义等）时只需实现此接口即可
 */
export interface AuthAdapter {
  /** 邮箱密码登录（可选实现） */
  signInWithEmail?(email: string, password: string): Promise<AuthResponse>;
  /** 邮箱密码注册（可选实现） */
  signUpWithEmail?(email: string, password: string): Promise<AuthResponse>;
  /** 微信小程序/公众号 code 登录（国内环境常用） */
  signInWithWechat?(code: string): Promise<AuthResponse>;
  /** 跳转到默认登录页（用于 OAuth 重定向场景 */
  toDefaultLoginPage?(redirectUrl?: string): Promise<void>;
  /** Google / GitHub 等 OAuth 登录 */
  signInWithOAuth?(provider: "google" | "github"): Promise<void>;
  /** 退出登录 */
  signOut(): Promise<void>;
  /** 获取当前登录用户（可能需要刷新 token） */
  getCurrentUser(): Promise<User | null>;
  /** 是否已登录（快速判断） */
  isAuthenticated(): Promise<boolean>;
}

/**
 * 数据库连接器抽象接口
 * 支持 Supabase 和腾讯 CloudBase 两套后端，业务层通过统一接口操作
 */
export interface DatabaseConnector {
  /** 初始化连接 */
  initialize(config: DatabaseConfig): Promise<void>;
  /** 获取底层客户端实例（supabase-js 或 tcb 实例） */
  getClient(): any;
  /** 测试连接是否正常 */
  testConnection(): Promise<boolean>;
  /** 关闭连接（可选） */
  close(): Promise<void>;
}

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  type: "supabase" | "cloudbase";   // 数据库类型
  connectionString?: string;        // Supabase 使用的 PostgreSQL 连接字符串（生产环境不推荐明文）
  envId?: string;                   // CloudBase 环境 ID
  url?: string;                     // Supabase 项目 URL
  anonKey?: string;                 // Supabase anon/public key
}

/**
 * 整体部署配置（通常放在 vercel.json / serverless 配置里或环境变量中）
 */
export interface DeploymentConfig {
  region: DeploymentRegion;         // CN 或 INTL
  appName: string;                  // 应用名称，用于日志区分
  version: string;                  // 版本号
  auth: {
    provider: "cloudbase" | "supabase";
    features: {
      emailAuth: boolean;           // 是否开启邮箱密码登录
      wechatAuth: boolean;          // 是否开启微信登录
      googleAuth: boolean;
      githubAuth: boolean;
    };
  };
  database: {
    provider: "cloudbase" | "supabase";
  };
  payment: {
    providers: Array<"stripe" | "paypal" | "wechat" | "alipay">;
  };
  apis: {
    authCallbackPath: string;      // OAuth 回调地址路径，例如 "/api/auth/callback"
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableConsole: boolean;
  };
}

/**
 * 架构运行时配置（从 DeploymentConfig 精简而来，供业务代码直接使用）
 */
export interface ArchitectureConfig {
  region: DeploymentRegion;
  database: DatabaseConfig;
  auth: {
    provider: "cloudbase" | "supabase";
    features: Record<string, boolean>;
  };
  payment: {
    providers: string[];
  };
}

/** 计费周期类型 */
export type BillingCycle = "monthly" | "yearly";

/** 支持的支付方式类型（用于类型收窄） */
export type PaymentMethod = "stripe" | "paypal" | "alipay" | "wechat";