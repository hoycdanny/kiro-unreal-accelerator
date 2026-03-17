/**
 * Analysis Cache
 * 
 * 增量分析快取模組
 * 提供檔案雜湊比對、快取命中/失效判斷功能
 * 
 * Validates: Requirements 18.3
 */

import { createHash } from 'crypto';

/**
 * 快取的分析結果
 */
export interface CachedAnalysis {
  assetPath: string;
  hash: string;
  timestamp: string;
  result: unknown;
}

/**
 * 分析快取結構
 */
export interface AnalysisCache {
  version: string;
  lastFullScan: string;
  fileHashes: Record<string, string>;
  cachedResults: Record<string, CachedAnalysis>;
}

/**
 * 快取統計資訊
 */
export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
}

/**
 * 快取序列化格式
 */
export interface SerializedCache {
  version: string;
  lastFullScan: string;
  fileHashes: Record<string, string>;
  cachedResults: Record<string, CachedAnalysis>;
  stats: CacheStats;
}

const CACHE_VERSION = '1.0.0';

/**
 * AnalysisCacheManager 類別
 * 
 * 管理增量分析快取，支援檔案雜湊比對與快取命中/失效判斷
 */
export class AnalysisCacheManager {
  private cache: AnalysisCache;
  private hits: number = 0;
  private misses: number = 0;

  constructor() {
    this.cache = {
      version: CACHE_VERSION,
      lastFullScan: new Date().toISOString(),
      fileHashes: {},
      cachedResults: {},
    };
  }

  /**
   * 計算內容的雜湊值
   * 使用 SHA-256 演算法
   */
  computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * 取得快取的分析結果
   * 如果快取存在且雜湊值匹配，回傳快取結果；否則回傳 null
   */
  get(assetPath: string): CachedAnalysis | null {
    const cached = this.cache.cachedResults[assetPath];
    
    if (!cached) {
      this.misses++;
      return null;
    }

    // 檢查雜湊值是否與儲存的一致
    const storedHash = this.cache.fileHashes[assetPath];
    if (storedHash && storedHash === cached.hash) {
      this.hits++;
      return cached;
    }

    this.misses++;
    return null;
  }

  /**
   * 儲存分析結果到快取
   */
  set(assetPath: string, hash: string, result: unknown): void {
    const timestamp = new Date().toISOString();
    
    this.cache.fileHashes[assetPath] = hash;
    this.cache.cachedResults[assetPath] = {
      assetPath,
      hash,
      timestamp,
      result,
    };
  }

  /**
   * 使快取項目失效（移除）
   */
  invalidate(assetPath: string): void {
    delete this.cache.fileHashes[assetPath];
    delete this.cache.cachedResults[assetPath];
  }

  /**
   * 檢查快取是否有效
   * 比對當前雜湊值與快取中的雜湊值
   */
  isValid(assetPath: string, currentHash: string): boolean {
    const cached = this.cache.cachedResults[assetPath];
    
    if (!cached) {
      return false;
    }

    return cached.hash === currentHash;
  }

  /**
   * 清除所有快取
   */
  clear(): void {
    this.cache.fileHashes = {};
    this.cache.cachedResults = {};
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 取得快取統計資訊
   */
  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: Object.keys(this.cache.cachedResults).length,
    };
  }

  /**
   * 更新最後完整掃描時間
   */
  updateLastFullScan(): void {
    this.cache.lastFullScan = new Date().toISOString();
  }

  /**
   * 取得最後完整掃描時間
   */
  getLastFullScan(): string {
    return this.cache.lastFullScan;
  }

  /**
   * 取得快取版本
   */
  getVersion(): string {
    return this.cache.version;
  }

  /**
   * 序列化快取為 JSON
   */
  toJSON(): SerializedCache {
    return {
      version: this.cache.version,
      lastFullScan: this.cache.lastFullScan,
      fileHashes: { ...this.cache.fileHashes },
      cachedResults: { ...this.cache.cachedResults },
      stats: this.getStats(),
    };
  }

  /**
   * 從 JSON 還原快取
   */
  static fromJSON(json: SerializedCache): AnalysisCacheManager {
    const manager = new AnalysisCacheManager();
    
    // 版本檢查 - 如果版本不匹配，回傳空快取
    if (json.version !== CACHE_VERSION) {
      return manager;
    }

    manager.cache = {
      version: json.version,
      lastFullScan: json.lastFullScan,
      fileHashes: { ...json.fileHashes },
      cachedResults: { ...json.cachedResults },
    };

    return manager;
  }

  /**
   * 批次檢查多個檔案的快取有效性
   * 回傳需要重新分析的檔案路徑列表
   */
  getInvalidatedPaths(fileHashes: Record<string, string>): string[] {
    const invalidated: string[] = [];

    for (const [assetPath, currentHash] of Object.entries(fileHashes)) {
      if (!this.isValid(assetPath, currentHash)) {
        invalidated.push(assetPath);
      }
    }

    return invalidated;
  }

  /**
   * 批次更新快取
   */
  batchSet(entries: Array<{ assetPath: string; hash: string; result: unknown }>): void {
    for (const entry of entries) {
      this.set(entry.assetPath, entry.hash, entry.result);
    }
  }

  /**
   * 取得所有快取的資產路徑
   */
  getCachedPaths(): string[] {
    return Object.keys(this.cache.cachedResults);
  }

  /**
   * 檢查是否有快取項目
   */
  has(assetPath: string): boolean {
    return assetPath in this.cache.cachedResults;
  }

  /**
   * 取得快取項目數量
   */
  get size(): number {
    return Object.keys(this.cache.cachedResults).length;
  }
}
