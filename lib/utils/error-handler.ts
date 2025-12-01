/**
 * 统一的错误处理工具
 */

export enum ErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND_ERROR = "NOT_FOUND_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
}

export class ArchitectureError extends Error {
  public readonly type: ErrorType;
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(
    message: string,
    type: ErrorType,
    code: string,
    retryable: boolean = false
  ) {
    super(message);
    this.name = "ArchitectureError";
    this.type = type;
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * 错误分类器
 */
export function classifyError(error: any): ArchitectureError {
  if (error instanceof ArchitectureError) {
    return error;
  }

  if (error.name === "TypeError" || error instanceof TypeError) {
    return new ArchitectureError(
      error.message,
      ErrorType.VALIDATION_ERROR,
      "TYPE_ERROR",
      false
    );
  }

  if (error.message?.includes("timeout") || error.message?.includes("TIMEOUT")) {
    return new ArchitectureError(
      error.message || "Request timeout",
      ErrorType.TIMEOUT_ERROR,
      "TIMEOUT",
      true
    );
  }

  if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
    return new ArchitectureError(
      error.message || "Authentication failed",
      ErrorType.AUTHENTICATION_ERROR,
      "AUTH_FAILED",
      false
    );
  }

  if (error.message?.includes("403") || error.message?.includes("Forbidden")) {
    return new ArchitectureError(
      error.message || "Access denied",
      ErrorType.AUTHORIZATION_ERROR,
      "ACCESS_DENIED",
      false
    );
  }

  if (error.message?.includes("404") || error.message?.includes("Not found")) {
    return new ArchitectureError(
      error.message || "Resource not found",
      ErrorType.NOT_FOUND_ERROR,
      "NOT_FOUND",
      false
    );
  }

  if (error.message?.includes("429") || error.message?.includes("rate limit")) {
    return new ArchitectureError(
      error.message || "Rate limit exceeded",
      ErrorType.RATE_LIMIT_ERROR,
      "RATE_LIMIT",
      true
    );
  }

  if (error.message?.includes("500") || error.message?.includes("Internal server error")) {
    return new ArchitectureError(
      error.message || "Server error",
      ErrorType.SERVER_ERROR,
      "SERVER_ERROR",
      true
    );
  }

  // 默认为网络错误
  return new ArchitectureError(
    error.message || error.toString(),
    ErrorType.NETWORK_ERROR,
    "UNKNOWN_ERROR",
    true
  );
}

/**
 * 带超时的fetch请求
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ArchitectureError(
        `Request timeout after ${timeout}ms`,
        ErrorType.TIMEOUT_ERROR,
        "FETCH_TIMEOUT",
        true
      );
    }
    throw error;
  }
}

/**
 * 带重试的函数执行
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const classifiedError = classifyError(error);

      if (attempt === maxRetries || !classifiedError.retryable) {
        throw classifiedError;
      }

      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, classifiedError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // 指数退避
    }
  }

  throw lastError;
}

/**
 * 降级处理器
 */
export class FallbackHandler {
  private fallbacks: Array<() => Promise<any>> = [];

  addFallback(fn: () => Promise<any>): void {
    this.fallbacks.push(fn);
  }

  async executeWithFallbacks(): Promise<any> {
    const errors: Error[] = [];

    for (const fallback of this.fallbacks) {
      try {
        return await fallback();
      } catch (error) {
        errors.push(error as Error);
        console.warn('Fallback failed:', error);
        continue;
      }
    }

    throw new Error(`All fallbacks failed. Errors: ${errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * 错误恢复管理器
 */
export const errorRecovery = {
  errors: new Map<string, ArchitectureError[]>(),

  recordError(context: string, error: ArchitectureError): void {
    if (!this.errors.has(context)) {
      this.errors.set(context, []);
    }
    this.errors.get(context)!.push(error);

    // 只保留最近10个错误
    const contextErrors = this.errors.get(context)!;
    if (contextErrors.length > 10) {
      contextErrors.shift();
    }
  },

  getErrorStats(context: string): { count: number; lastError?: ArchitectureError } {
    const contextErrors = this.errors.get(context) || [];
    return {
      count: contextErrors.length,
      lastError: contextErrors[contextErrors.length - 1],
    };
  },

  clearErrors(context?: string): void {
    if (context) {
      this.errors.delete(context);
    } else {
      this.errors.clear();
    }
  },
};