/**
 * Analysis Cache Unit Tests
 * 
 * 增量分析快取單元測試
 * 
 * Validates: Requirements 18.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisCacheManager } from '../../utils/cache.js';

describe('AnalysisCacheManager', () => {
  let cache: AnalysisCacheManager;

  beforeEach(() => {
    cache = new AnalysisCacheManager();
  });

  describe('computeHash', () => {
    it('should return consistent hash for same content', () => {
      const content = 'test content';
      const hash1 = cache.computeHash(content);
      const hash2 = cache.computeHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different content', () => {
      const hash1 = cache.computeHash('content A');
      const hash2 = cache.computeHash('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a hex string', () => {
      const hash = cache.computeHash('test');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle empty string', () => {
      const hash = cache.computeHash('');
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });
  });

  describe('set and get', () => {
    it('should store and retrieve cached analysis', () => {
      const assetPath = '/Game/Textures/T_Test';
      const hash = cache.computeHash('file content');
      const result = { issues: [], score: 95 };

      cache.set(assetPath, hash, result);
      const cached = cache.get(assetPath);

      expect(cached).not.toBeNull();
      expect(cached!.assetPath).toBe(assetPath);
      expect(cached!.hash).toBe(hash);
      expect(cached!.result).toEqual(result);
      expect(cached!.timestamp).toBeTruthy();
    });

    it('should return null for non-existent path', () => {
      const cached = cache.get('/Game/NonExistent');
      expect(cached).toBeNull();
    });

    it('should overwrite existing entry', () => {
      const assetPath = '/Game/Textures/T_Test';
      const hash1 = cache.computeHash('v1');
      const hash2 = cache.computeHash('v2');

      cache.set(assetPath, hash1, { version: 1 });
      cache.set(assetPath, hash2, { version: 2 });

      const cached = cache.get(assetPath);
      expect(cached).not.toBeNull();
      expect(cached!.hash).toBe(hash2);
      expect(cached!.result).toEqual({ version: 2 });
    });
  });

  describe('invalidate', () => {
    it('should remove cached entry', () => {
      const assetPath = '/Game/Textures/T_Test';
      cache.set(assetPath, 'hash123', { data: true });
      
      cache.invalidate(assetPath);
      
      expect(cache.get(assetPath)).toBeNull();
      expect(cache.has(assetPath)).toBe(false);
    });

    it('should not throw for non-existent path', () => {
      expect(() => cache.invalidate('/Game/NonExistent')).not.toThrow();
    });
  });

  describe('isValid', () => {
    it('should return true when hash matches', () => {
      const assetPath = '/Game/Meshes/SM_Test';
      const hash = cache.computeHash('mesh data');
      cache.set(assetPath, hash, { triangles: 1000 });

      expect(cache.isValid(assetPath, hash)).toBe(true);
    });

    it('should return false when hash differs', () => {
      const assetPath = '/Game/Meshes/SM_Test';
      cache.set(assetPath, 'old_hash', { triangles: 1000 });

      expect(cache.isValid(assetPath, 'new_hash')).toBe(false);
    });

    it('should return false for non-existent path', () => {
      expect(cache.isValid('/Game/NonExistent', 'any_hash')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('/Game/A', 'h1', {});
      cache.set('/Game/B', 'h2', {});
      cache.set('/Game/C', 'h3', {});

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('/Game/A')).toBeNull();
      expect(cache.get('/Game/B')).toBeNull();
    });

    it('should reset stats', () => {
      cache.set('/Game/A', 'h1', {});
      cache.get('/Game/A');
      cache.get('/Game/Missing');

      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.entries).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should track hits and misses', () => {
      const hash = cache.computeHash('content');
      cache.set('/Game/A', hash, { ok: true });

      cache.get('/Game/A');       // hit
      cache.get('/Game/Missing'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.entries).toBe(1);
    });

    it('should start with zero stats', () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.entries).toBe(0);
    });
  });

  describe('toJSON / fromJSON', () => {
    it('should serialize and deserialize correctly', () => {
      const assetPath = '/Game/Textures/T_Test';
      const hash = cache.computeHash('content');
      const result = { issues: [], score: 100 };

      cache.set(assetPath, hash, result);

      const json = cache.toJSON();
      const restored = AnalysisCacheManager.fromJSON(json);

      const cached = restored.get(assetPath);
      expect(cached).not.toBeNull();
      expect(cached!.assetPath).toBe(assetPath);
      expect(cached!.hash).toBe(hash);
      expect(cached!.result).toEqual(result);
    });

    it('should return empty cache for version mismatch', () => {
      cache.set('/Game/A', 'hash', { data: true });
      const json = cache.toJSON();
      json.version = '0.0.1'; // mismatch

      const restored = AnalysisCacheManager.fromJSON(json);
      expect(restored.size).toBe(0);
    });

    it('should preserve version and lastFullScan', () => {
      const json = cache.toJSON();
      expect(json.version).toBe('1.0.0');
      expect(json.lastFullScan).toBeTruthy();
    });
  });

  describe('getInvalidatedPaths', () => {
    it('should return paths with changed hashes', () => {
      cache.set('/Game/A', 'hash_a', {});
      cache.set('/Game/B', 'hash_b', {});
      cache.set('/Game/C', 'hash_c', {});

      const invalidated = cache.getInvalidatedPaths({
        '/Game/A': 'hash_a',       // unchanged
        '/Game/B': 'hash_b_new',   // changed
        '/Game/C': 'hash_c',       // unchanged
        '/Game/D': 'hash_d',       // new file
      });

      expect(invalidated).toContain('/Game/B');
      expect(invalidated).toContain('/Game/D');
      expect(invalidated).not.toContain('/Game/A');
      expect(invalidated).not.toContain('/Game/C');
    });
  });

  describe('batchSet', () => {
    it('should store multiple entries at once', () => {
      cache.batchSet([
        { assetPath: '/Game/A', hash: 'h1', result: { a: 1 } },
        { assetPath: '/Game/B', hash: 'h2', result: { b: 2 } },
      ]);

      expect(cache.size).toBe(2);
      expect(cache.has('/Game/A')).toBe(true);
      expect(cache.has('/Game/B')).toBe(true);
    });
  });

  describe('getCachedPaths', () => {
    it('should return all cached asset paths', () => {
      cache.set('/Game/A', 'h1', {});
      cache.set('/Game/B', 'h2', {});

      const paths = cache.getCachedPaths();
      expect(paths).toHaveLength(2);
      expect(paths).toContain('/Game/A');
      expect(paths).toContain('/Game/B');
    });
  });

  describe('has', () => {
    it('should return true for existing entry', () => {
      cache.set('/Game/A', 'h1', {});
      expect(cache.has('/Game/A')).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(cache.has('/Game/Missing')).toBe(false);
    });
  });

  describe('size', () => {
    it('should reflect number of cached entries', () => {
      expect(cache.size).toBe(0);
      cache.set('/Game/A', 'h1', {});
      expect(cache.size).toBe(1);
      cache.set('/Game/B', 'h2', {});
      expect(cache.size).toBe(2);
      cache.invalidate('/Game/A');
      expect(cache.size).toBe(1);
    });
  });
});
