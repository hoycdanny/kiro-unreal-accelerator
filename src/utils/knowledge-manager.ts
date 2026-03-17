/**
 * KnowledgeManager
 * 
 * 知識管理模組：文件儲存、檢索、過期偵測、API 變更追蹤
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import type { KnowledgeDocument, ApiChange } from '../types/analysis.js';
import type { Logger } from './logger.js';

/**
 * KnowledgeManager 類別
 * 
 * 提供團隊文件的集中儲存與檢索、過期偵測、API 變更追蹤與受影響程式碼標記
 */
export class KnowledgeManager {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private apiChanges: Map<string, ApiChange[]> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 儲存知識文件
   * Validates: Requirements 8.1
   */
  storeDocument(key: string, document: KnowledgeDocument): void {
    this.logger.info(`Storing document: ${key}`, { module: 'KnowledgeManager' });
    this.documents.set(key, { ...document, key });
  }

  /**
   * 以鍵值檢索文件
   * Validates: Requirements 8.1
   */
  getDocument(key: string): KnowledgeDocument | null {
    const doc = this.documents.get(key);
    if (!doc) {
      this.logger.debug(`Document not found: ${key}`, { module: 'KnowledgeManager' });
      return null;
    }
    return { ...doc };
  }

  /**
   * 搜尋文件：比對 title、content、tags
   * Validates: Requirements 8.2
   */
  searchDocuments(query: string): KnowledgeDocument[] {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: KnowledgeDocument[] = [];

    for (const doc of this.documents.values()) {
      const matchesTitle = doc.title.toLowerCase().includes(lowerQuery);
      const matchesContent = doc.content.toLowerCase().includes(lowerQuery);
      const matchesTags = doc.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

      if (matchesTitle || matchesContent || matchesTags) {
        results.push({ ...doc });
      }
    }

    this.logger.debug(`Search "${query}" returned ${results.length} results`, { module: 'KnowledgeManager' });
    return results;
  }

  /**
   * 取得過期文件：lastUpdated 超過閾值的文件
   * Validates: Requirements 8.3
   */
  getExpiredDocuments(thresholdMs: number): KnowledgeDocument[] {
    const now = Date.now();
    const expired: KnowledgeDocument[] = [];

    for (const doc of this.documents.values()) {
      const lastUpdated = new Date(doc.lastUpdated).getTime();
      if (now - lastUpdated > thresholdMs) {
        expired.push({ ...doc });
      }
    }

    this.logger.info(`Found ${expired.length} expired documents (threshold: ${thresholdMs}ms)`, { module: 'KnowledgeManager' });
    return expired;
  }

  /**
   * 追蹤 API 變更
   * Validates: Requirements 8.4
   */
  trackApiChange(change: ApiChange): void {
    this.logger.info(`Tracking API change: ${change.apiName} (${change.changeType})`, { module: 'KnowledgeManager' });
    const existing = this.apiChanges.get(change.apiName) ?? [];
    existing.push({ ...change });
    this.apiChanges.set(change.apiName, existing);
  }

  /**
   * 取得受 API 變更影響的程式碼路徑
   * Validates: Requirements 8.4
   */
  getAffectedCode(apiName: string): string[] {
    const changes = this.apiChanges.get(apiName);
    if (!changes || changes.length === 0) {
      return [];
    }

    const affectedPaths = new Set<string>();
    for (const change of changes) {
      for (const path of change.affectedCodePaths) {
        affectedPaths.add(path);
      }
    }

    return Array.from(affectedPaths);
  }

  /**
   * 取得特定 API 的所有變更記錄
   */
  getApiChanges(apiName: string): ApiChange[] {
    const changes = this.apiChanges.get(apiName);
    if (!changes) {
      return [];
    }
    return changes.map(c => ({ ...c }));
  }

  /**
   * 取得所有已追蹤的 API 名稱
   */
  getTrackedApis(): string[] {
    return Array.from(this.apiChanges.keys());
  }

  /**
   * 取得所有文件鍵值
   */
  getDocumentKeys(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * 文件數量
   */
  get documentCount(): number {
    return this.documents.size;
  }

  /**
   * 清除所有資料
   */
  clear(): void {
    this.documents.clear();
    this.apiChanges.clear();
    this.logger.info('Knowledge manager cleared', { module: 'KnowledgeManager' });
  }
}
