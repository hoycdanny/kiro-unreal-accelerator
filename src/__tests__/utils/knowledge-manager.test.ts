/**
 * KnowledgeManager Unit Tests
 * 
 * 知識管理模組單元測試
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeManager } from '../../utils/knowledge-manager.js';
import { Logger } from '../../utils/logger.js';
import type { KnowledgeDocument, ApiChange } from '../../types/analysis.js';

describe('KnowledgeManager', () => {
  let manager: KnowledgeManager;
  let logger: Logger;

  beforeEach(() => {
    Logger.resetInstance();
    logger = new Logger({ level: 'error' }); // suppress logs in tests
    manager = new KnowledgeManager(logger);
  });

  // ─── 8.1: Document Storage & Retrieval ───

  describe('storeDocument / getDocument', () => {
    it('should store and retrieve a document by key', () => {
      const doc: KnowledgeDocument = {
        key: 'nanite-guide',
        title: 'Nanite Best Practices',
        content: 'Use Nanite for high-poly static meshes.',
        tags: ['nanite', 'performance'],
        lastUpdated: '2024-01-15T10:00:00Z',
        version: '5.3',
      };

      manager.storeDocument('nanite-guide', doc);
      const retrieved = manager.getDocument('nanite-guide');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.key).toBe('nanite-guide');
      expect(retrieved!.title).toBe('Nanite Best Practices');
      expect(retrieved!.content).toBe('Use Nanite for high-poly static meshes.');
      expect(retrieved!.tags).toEqual(['nanite', 'performance']);
      expect(retrieved!.version).toBe('5.3');
    });

    it('should return null for non-existent key', () => {
      expect(manager.getDocument('missing-key')).toBeNull();
    });

    it('should overwrite document with same key', () => {
      const doc1: KnowledgeDocument = {
        key: 'doc',
        title: 'V1',
        content: 'First version',
        tags: ['v1'],
        lastUpdated: '2024-01-01T00:00:00Z',
      };
      const doc2: KnowledgeDocument = {
        key: 'doc',
        title: 'V2',
        content: 'Second version',
        tags: ['v2'],
        lastUpdated: '2024-06-01T00:00:00Z',
      };

      manager.storeDocument('doc', doc1);
      manager.storeDocument('doc', doc2);

      const retrieved = manager.getDocument('doc');
      expect(retrieved!.title).toBe('V2');
      expect(retrieved!.content).toBe('Second version');
    });

    it('should return a copy, not a reference', () => {
      const doc: KnowledgeDocument = {
        key: 'ref-test',
        title: 'Ref Test',
        content: 'content',
        tags: ['test'],
        lastUpdated: '2024-01-01T00:00:00Z',
      };

      manager.storeDocument('ref-test', doc);
      const retrieved = manager.getDocument('ref-test')!;
      retrieved.title = 'Modified';

      expect(manager.getDocument('ref-test')!.title).toBe('Ref Test');
    });

    it('should track document count', () => {
      expect(manager.documentCount).toBe(0);

      manager.storeDocument('a', makeDoc('a'));
      expect(manager.documentCount).toBe(1);

      manager.storeDocument('b', makeDoc('b'));
      expect(manager.documentCount).toBe(2);
    });

    it('should list document keys', () => {
      manager.storeDocument('alpha', makeDoc('alpha'));
      manager.storeDocument('beta', makeDoc('beta'));

      const keys = manager.getDocumentKeys();
      expect(keys).toContain('alpha');
      expect(keys).toContain('beta');
      expect(keys).toHaveLength(2);
    });
  });

  // ─── 8.2: Document Search ───

  describe('searchDocuments', () => {
    beforeEach(() => {
      manager.storeDocument('nanite', {
        key: 'nanite',
        title: 'Nanite Guide',
        content: 'Nanite is a virtual geometry system for high-poly meshes.',
        tags: ['nanite', 'rendering', 'ue5'],
        lastUpdated: '2024-01-01T00:00:00Z',
      });
      manager.storeDocument('lumen', {
        key: 'lumen',
        title: 'Lumen Lighting',
        content: 'Lumen provides global illumination and reflections.',
        tags: ['lumen', 'lighting', 'ue5'],
        lastUpdated: '2024-02-01T00:00:00Z',
      });
      manager.storeDocument('blueprint', {
        key: 'blueprint',
        title: 'Blueprint Best Practices',
        content: 'Keep Blueprint graphs clean and modular.',
        tags: ['blueprint', 'architecture'],
        lastUpdated: '2024-03-01T00:00:00Z',
      });
    });

    it('should find documents by title', () => {
      const results = manager.searchDocuments('Nanite');
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('nanite');
    });

    it('should find documents by content', () => {
      const results = manager.searchDocuments('global illumination');
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('lumen');
    });

    it('should find documents by tag', () => {
      const results = manager.searchDocuments('ue5');
      expect(results).toHaveLength(2);
    });

    it('should be case-insensitive', () => {
      const results = manager.searchDocuments('nanite');
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('nanite');
    });

    it('should return empty array for no matches', () => {
      const results = manager.searchDocuments('nonexistent-topic');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', () => {
      expect(manager.searchDocuments('')).toHaveLength(0);
      expect(manager.searchDocuments('   ')).toHaveLength(0);
    });
  });

  // ─── 8.3: Expiry Detection ───

  describe('getExpiredDocuments', () => {
    it('should detect expired documents past threshold', () => {
      const oldDate = new Date(Date.now() - 100_000).toISOString();
      const recentDate = new Date(Date.now() - 1_000).toISOString();

      manager.storeDocument('old', {
        key: 'old',
        title: 'Old Doc',
        content: 'outdated',
        tags: [],
        lastUpdated: oldDate,
      });
      manager.storeDocument('recent', {
        key: 'recent',
        title: 'Recent Doc',
        content: 'fresh',
        tags: [],
        lastUpdated: recentDate,
      });

      // threshold = 50 seconds → old doc (100s ago) is expired, recent (1s ago) is not
      const expired = manager.getExpiredDocuments(50_000);
      expect(expired).toHaveLength(1);
      expect(expired[0].key).toBe('old');
    });

    it('should return empty when no documents are expired', () => {
      const recentDate = new Date().toISOString();
      manager.storeDocument('fresh', {
        key: 'fresh',
        title: 'Fresh',
        content: 'new',
        tags: [],
        lastUpdated: recentDate,
      });

      const expired = manager.getExpiredDocuments(999_999_999);
      expect(expired).toHaveLength(0);
    });

    it('should return all documents when threshold is 0', () => {
      manager.storeDocument('a', makeDoc('a'));
      manager.storeDocument('b', makeDoc('b'));

      // threshold 0 means everything older than now is expired
      const expired = manager.getExpiredDocuments(0);
      expect(expired).toHaveLength(2);
    });
  });

  // ─── 8.4: API Change Tracking ───

  describe('trackApiChange / getAffectedCode', () => {
    it('should track an API change and return affected code paths', () => {
      const change: ApiChange = {
        apiName: 'UStaticMeshComponent::SetStaticMesh',
        changeType: 'deprecated',
        description: 'Use SetStaticMeshAsset instead',
        affectedCodePaths: ['/Source/MyGame/Player.cpp', '/Source/MyGame/Enemy.cpp'],
        suggestedReplacement: 'UStaticMeshComponent::SetStaticMeshAsset',
        engineVersion: '5.4',
      };

      manager.trackApiChange(change);

      const affected = manager.getAffectedCode('UStaticMeshComponent::SetStaticMesh');
      expect(affected).toContain('/Source/MyGame/Player.cpp');
      expect(affected).toContain('/Source/MyGame/Enemy.cpp');
      expect(affected).toHaveLength(2);
    });

    it('should return empty array for untracked API', () => {
      expect(manager.getAffectedCode('UnknownAPI')).toEqual([]);
    });

    it('should aggregate affected paths across multiple changes for same API', () => {
      manager.trackApiChange({
        apiName: 'SomeAPI',
        changeType: 'modified',
        description: 'Change 1',
        affectedCodePaths: ['/Source/A.cpp'],
        engineVersion: '5.3',
      });
      manager.trackApiChange({
        apiName: 'SomeAPI',
        changeType: 'deprecated',
        description: 'Change 2',
        affectedCodePaths: ['/Source/B.cpp', '/Source/C.cpp'],
        engineVersion: '5.4',
      });

      const affected = manager.getAffectedCode('SomeAPI');
      expect(affected).toContain('/Source/A.cpp');
      expect(affected).toContain('/Source/B.cpp');
      expect(affected).toContain('/Source/C.cpp');
      expect(affected).toHaveLength(3);
    });

    it('should deduplicate affected code paths', () => {
      manager.trackApiChange({
        apiName: 'DupAPI',
        changeType: 'modified',
        description: 'First',
        affectedCodePaths: ['/Source/Shared.cpp'],
        engineVersion: '5.3',
      });
      manager.trackApiChange({
        apiName: 'DupAPI',
        changeType: 'deprecated',
        description: 'Second',
        affectedCodePaths: ['/Source/Shared.cpp', '/Source/Other.cpp'],
        engineVersion: '5.4',
      });

      const affected = manager.getAffectedCode('DupAPI');
      expect(affected).toHaveLength(2);
    });

    it('should return API change records', () => {
      const change: ApiChange = {
        apiName: 'TestAPI',
        changeType: 'removed',
        description: 'Removed in 5.4',
        affectedCodePaths: ['/Source/Test.cpp'],
        engineVersion: '5.4',
      };

      manager.trackApiChange(change);
      const changes = manager.getApiChanges('TestAPI');
      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('removed');
      expect(changes[0].engineVersion).toBe('5.4');
    });

    it('should list tracked API names', () => {
      manager.trackApiChange({
        apiName: 'API_A',
        changeType: 'added',
        description: 'New',
        affectedCodePaths: [],
        engineVersion: '5.4',
      });
      manager.trackApiChange({
        apiName: 'API_B',
        changeType: 'modified',
        description: 'Changed',
        affectedCodePaths: [],
        engineVersion: '5.4',
      });

      const apis = manager.getTrackedApis();
      expect(apis).toContain('API_A');
      expect(apis).toContain('API_B');
    });
  });

  // ─── Clear ───

  describe('clear', () => {
    it('should remove all documents and API changes', () => {
      manager.storeDocument('doc', makeDoc('doc'));
      manager.trackApiChange({
        apiName: 'API',
        changeType: 'added',
        description: 'test',
        affectedCodePaths: [],
        engineVersion: '5.4',
      });

      manager.clear();

      expect(manager.documentCount).toBe(0);
      expect(manager.getDocument('doc')).toBeNull();
      expect(manager.getAffectedCode('API')).toEqual([]);
      expect(manager.getTrackedApis()).toHaveLength(0);
    });
  });
});

// ─── Helpers ───

function makeDoc(key: string): KnowledgeDocument {
  return {
    key,
    title: `Doc ${key}`,
    content: `Content for ${key}`,
    tags: ['test'],
    lastUpdated: new Date(Date.now() - 10_000).toISOString(),
  };
}
