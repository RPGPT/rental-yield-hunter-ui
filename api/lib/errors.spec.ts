import { describe, it, expect, vi } from 'vitest';
import { sendError } from './errors';
import { MockRes } from '../test/mock-res';

describe('api/lib/errors - sendError', () => {
  it('returns 500 with message for a plain Error', () => {
    const res = new MockRes();
    sendError(res as any, new Error('something went wrong'));
    expect(res._status).toBe(500);
    expect((res._body as any).error.message).toBe('something went wrong');
    expect((res._body as any).error.status).toBe(500);
  });

  it('includes code when the Error has a code property', () => {
    const err = Object.assign(new Error('coded error'), { code: 'ERR_CODE' });
    const res = new MockRes();
    sendError(res as any, err);
    expect((res._body as any).error.code).toBe('ERR_CODE');
    expect((res._body as any).error.message).toBe('coded error');
  });

  it('omits code when the Error has no code property', () => {
    const res = new MockRes();
    sendError(res as any, new Error('no code'));
    expect((res._body as any).error.code).toBeUndefined();
  });

  it('handles non-Error values by stringifying them', () => {
    const res = new MockRes();
    sendError(res as any, 'a plain string error');
    expect((res._body as any).error.message).toBe('a plain string error');
  });

  it('handles numeric non-Error value', () => {
    const res = new MockRes();
    sendError(res as any, 42);
    expect((res._body as any).error.message).toBe('42');
  });

  it('uses the provided custom status code', () => {
    const res = new MockRes();
    sendError(res as any, new Error('not found'), 404);
    expect(res._status).toBe(404);
    expect((res._body as any).error.status).toBe(404);
  });

  it('defaults to status 500 when no status provided', () => {
    const res = new MockRes();
    sendError(res as any, new Error('oops'));
    expect(res._status).toBe(500);
  });
});
