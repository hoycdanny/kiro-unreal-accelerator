import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger } from '../../utils/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    Logger.resetInstance();
    vi.restoreAllMocks();
  });

  it('should create a singleton instance', () => {
    const a = Logger.getInstance();
    const b = Logger.getInstance();
    expect(a).toBe(b);
  });

  it('should reset singleton instance', () => {
    const a = Logger.getInstance();
    Logger.resetInstance();
    const b = Logger.getInstance();
    expect(a).not.toBe(b);
  });

  it('should log at info level by default', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger();

    logger.info('test info');
    expect(spy).toHaveBeenCalledTimes(1);

    logger.debug('test debug');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('should log debug when level is set to debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger({ level: 'debug' });

    logger.debug('test debug');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should log warn and error at all levels', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new Logger({ level: 'error' });

    logger.warn('test warn');
    expect(warnSpy).not.toHaveBeenCalled();

    logger.error('test error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('should create child logger with merged context', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const parent = new Logger({ level: 'info' }, { module: 'parent' });
    const child = parent.withContext({ tool: 'manage_asset' });

    child.info('test');
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain('parent');
    expect(output).toContain('manage_asset');
  });

  it('should allow changing log level', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new Logger({ level: 'info' });

    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();

    logger.setLevel('debug');
    logger.debug('should appear');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should include context in output', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = new Logger({ level: 'info', enableContext: true });

    logger.info('test', { module: 'TestModule' });
    const output = spy.mock.calls[0]?.[0] as string;
    expect(output).toContain('TestModule');
  });
});
