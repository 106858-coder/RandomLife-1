/**
 * 支付业务服务 - 处理支付相关的业务逻辑
 */

import {
  PaymentOrder,
  PaymentResult,
  PaymentConfirmation,
  RefundResult,
} from "./router";

export interface PaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  originalAmount?: number; // 原始金额（转换前）
  originalCurrency?: string; // 原始货币（转换前）
  status: "pending" | "completed" | "failed" | "refunded";
  paymentMethod: string;
  externalId?: string; // 第三方支付平台的订单ID
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRepository {
  save(
    payment: Omit<PaymentRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<PaymentRecord>;
  findById(id: string): Promise<PaymentRecord | null>;
  findByExternalId(externalId: string): Promise<PaymentRecord | null>;
  updateStatus(id: string, status: PaymentRecord["status"]): Promise<void>;
  findByUserId(userId: string): Promise<PaymentRecord[]>;
}

export abstract class AbstractPaymentService {
  protected repository: PaymentRepository;

  // 汇率配置
  protected static readonly EXCHANGE_RATES = {
    USD_TO_CNY: 7.2, // 1 USD = 7.2 CNY
  } as const;

  constructor(repository: PaymentRepository) {
    this.repository = repository;
  }

  /**
   * 货币转换
   */
  protected convertCurrency(
    amount: number,
    fromCurrency: string,
    targetCurrency: string
  ): number {
    if (fromCurrency === targetCurrency) {
      return amount;
    }

    // USD 转 CNY
    if (fromCurrency === "USD" && targetCurrency === "CNY") {
      return amount * AbstractPaymentService.EXCHANGE_RATES.USD_TO_CNY;
    }

    // CNY 转 USD
    if (fromCurrency === "CNY" && targetCurrency === "USD") {
      return amount / AbstractPaymentService.EXCHANGE_RATES.USD_TO_CNY;
    }

    throw new Error(
      `Unsupported currency conversion: ${fromCurrency} to ${targetCurrency}`
    );
  }

  /**
   * 处理支付订单
   */
  async processPayment(
    order: PaymentOrder,
    paymentMethod: string
  ): Promise<PaymentResult> {
    try {
      // 1. 创建支付记录
      const paymentRecord = await this.repository.save({
        userId: order.userId,
        amount: order.amount,
        currency: order.currency,
        status: "pending",
        paymentMethod,
      });

      // 2. 调用具体的支付处理逻辑
      const result = await this.doProcessPayment(order, paymentRecord);

      // 3. 更新支付状态
      if (result.success) {
        await this.repository.updateStatus(paymentRecord.id, "completed");
      } else {
        await this.repository.updateStatus(paymentRecord.id, "failed");
      }

      return result;
    } catch (error) {
      console.error("Payment processing failed:", error);
      throw error;
    }
  }

  // 抽象方法
  protected abstract doProcessPayment(
    order: PaymentOrder,
    payment: PaymentRecord
  ): Promise<PaymentResult>;
}