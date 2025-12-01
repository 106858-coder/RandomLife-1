/**
 * CloudBase 认证服务实现
 * 适用于中国地区部署
 */

import { AuthResponse, User } from '../../core/types';
import { CloudBaseConnector } from '../../database/connectors/cloudbase-connector';
import bcrypt from 'bcryptjs';

export class CloudBaseAuthService {
  private db: any = null;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    try {
      const connector = new CloudBaseConnector({});
      await connector.initialize({
        envId: process.env.WECHAT_CLOUDBASE_ID,
        secretId: process.env.CLOUDBASE_SECRET_ID,
        secretKey: process.env.CLOUDBASE_SECRET_KEY,
      });
      this.db = connector.getClient();
    } catch (error) {
      console.error('Failed to initialize CloudBase database:', error);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // 查找用户
      const result = await this.db.collection('users')
        .where({ email })
        .get();

      const user = result.data[0];

      if (!user) {
        return { user: null, error: new Error('User not found') };
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return { user: null, error: new Error('Invalid password') };
      }

      // 生成会话令牌
      const sessionToken = this.generateSessionToken();

      // 更新最后登录时间
      await this.db.collection('users')
        .doc(user._id)
        .update({
          lastLoginAt: new Date().toISOString(),
          sessionToken
        });

      // 构建用户对象
      const authUser: User = {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: new Date(user.createdAt),
        metadata: {
          pro: user.pro || false,
          region: user.region || 'CN'
        }
      };

      const session = {
        access_token: sessionToken,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        user: authUser
      };

      return { user: authUser, session };
    } catch (error) {
      console.error('CloudBase sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  async signUpWithEmail(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // 检查用户是否已存在
      const existingUser = await this.db.collection('users')
        .where({ email })
        .get();

      if (existingUser.data.length > 0) {
        return { user: null, error: new Error('User already exists') };
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const userData = {
        email,
        password: hashedPassword,
        name: name || null,
        avatar: null,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        pro: false,
        region: 'CN',
        subscriptionTier: 'free',
        paymentMethod: null
      };

      const result = await this.db.collection('users').add(userData);

      // 生成会话令牌
      const sessionToken = this.generateSessionToken();

      // 更新会话令牌
      await this.db.collection('users')
        .doc(result.id)
        .update({ sessionToken });

      // 构建用户对象
      const authUser: User = {
        id: result.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar,
        createdAt: new Date(userData.createdAt),
        metadata: {
          pro: userData.pro,
          region: userData.region
        }
      };

      const session = {
        access_token: sessionToken,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        user: authUser
      };

      return { user: authUser, session };
    } catch (error) {
      console.error('CloudBase sign up error:', error);
      return { user: null, error: error as Error };
    }
  }

  async signInWithWechat(code: string): Promise<AuthResponse> {
    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // 调用微信 API 获取用户信息
      const wechatUser = await this.getWechatUserInfo(code);

      if (!wechatUser) {
        return { user: null, error: new Error('Failed to get WeChat user info') };
      }

      // 查找是否已有绑定微信的用户
      const existingUser = await this.db.collection('users')
        .where({ wechatOpenId: wechatUser.openid })
        .get();

      let user: any;

      if (existingUser.data.length > 0) {
        // 用户已存在，更新登录信息
        user = existingUser.data[0];
        const sessionToken = this.generateSessionToken();

        await this.db.collection('users')
          .doc(user._id)
          .update({
            lastLoginAt: new Date().toISOString(),
            sessionToken,
            wechatInfo: wechatUser
          });

        user.sessionToken = sessionToken;
      } else {
        // 创建新用户
        const sessionToken = this.generateSessionToken();
        const userData = {
          wechatOpenId: wechatUser.openid,
          name: wechatUser.nickname || wechatUser.userName,
          avatar: wechatUser.headImgUrl || wechatUser.avatarUrl,
          email: null,
          password: null,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          pro: false,
          region: 'CN',
          subscriptionTier: 'free',
          paymentMethod: null,
          sessionToken,
          wechatInfo: wechatUser
        };

        const result = await this.db.collection('users').add(userData);
        user = { ...userData, _id: result.id };
      }

      // 构建用户对象
      const authUser: User = {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: new Date(user.createdAt),
        metadata: {
          pro: user.pro,
          region: user.region,
          wechatOpenId: user.wechatOpenId
        }
      };

      const session = {
        access_token: user.sessionToken,
        expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        user: authUser
      };

      return { user: authUser, session };
    } catch (error) {
      console.error('CloudBase WeChat sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      if (!this.db) {
        return null;
      }

      // 在实际实现中，这里应该从请求中获取 token 并验证
      // 为了简化，这里返回 null，实际使用时需要传入 token 或从上下文获取
      return null;
    } catch (error) {
      console.error('CloudBase get current user error:', error);
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      if (!this.db) {
        return;
      }

      // 在实际实现中，这里应该清除用户的 sessionToken
      // 需要传入用户 ID 或 token
    } catch (error) {
      console.error('CloudBase sign out error:', error);
    }
  }

  private generateSessionToken(): string {
    return Buffer.from(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).toString('base64');
  }

  private async getWechatUserInfo(code: string): Promise<any> {
    try {
      // 获取 access_token
      const tokenResponse = await fetch(
        `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.errcode) {
        throw new Error(`WeChat API error: ${tokenData.errmsg}`);
      }

      // 获取用户信息
      const userResponse = await fetch(
        `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}&lang=zh_CN`
      );

      const userData = await userResponse.json();

      if (userData.errcode) {
        throw new Error(`WeChat user info error: ${userData.errmsg}`);
      }

      return userData;
    } catch (error) {
      console.error('Get WeChat user info error:', error);
      return null;
    }
  }
}