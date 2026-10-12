/**
 * authController — HD-018 spec.
 *
 * Pins the contract for `changePassword`:
 *   - 204 happy path: currentPassword matches, newPassword is hashed
 *     and written; the existing JWT cookie stays valid.
 *   - 400 validation_error: the body fails the validator; the
 *     controller re-throws so the errorHandler serializes the
 *     400 + `fields` map (no res cycle modeled).
 *   - 401 account_inactive: the user is missing or isActive=false
 *     between the middleware check and the controller — same
 *     shape as /me's account_inactive path. Cookie is cleared.
 *   - 403 invalid_credentials: currentPassword doesn't match the
 *     stored hash.
 *   - 401 unauthenticated: authMiddleware fails upstream (covered
 *     by the middleware spec, but pinned here too so the route
 *     shape is documented end-to-end).
 *
 * `User` is mocked. The default mock user is a real User (id: 7)
 * with a known `passwordHash`. The mock `bcrypt.compare` and
 * `bcrypt.hash` are wired so happy-path tests can predict the
 * update call without exercising the real algorithm.
 */

import type { NextFunction, Request, Response } from 'express';

import { changePassword } from './authController';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    (req as Request & { user?: unknown }).user = {
      id: 7,
      email: 'eli@example.com',
      displayName: 'Eli',
      role: 'User',
    };
    next();
  },
}));

const KNOWN_HASH = '$2b$10$knownHashForOldPassword';

let mockFindByPk: jest.Mock;
let mockUpdate: jest.Mock;
let mockClearAuthCookie: jest.Mock;
let mockVerify: jest.Mock;
let mockHash: jest.Mock;

jest.mock('../models', () => ({
  User: {
    scope: jest.fn().mockReturnThis(),
    findByPk: (...args: unknown[]) =>
      (mockFindByPk as unknown as (...a: unknown[]) => unknown)(...args),
  },
}));

jest.mock('../utils/cookies', () => ({
  clearAuthCookie: (...args: unknown[]) =>
    (mockClearAuthCookie as unknown as (...a: unknown[]) => unknown)(...args),
  setAuthCookie: jest.fn(),
}));

jest.mock('../utils/password', () => ({
  DUMMY_HASH: 'unused-hash',
  verifyPassword: (...args: unknown[]) =>
    (mockVerify as unknown as (...a: unknown[]) => unknown)(...args),
}));

jest.mock('bcrypt', () => ({
  hash: (...args: unknown[]) =>
    (mockHash as unknown as (...a: unknown[]) => unknown)(...args),
}));

function makeFakeUser(overrides: {
  id?: number;
  isActive?: boolean;
  passwordHash?: string;
} = {}) {
  const update = (...args: unknown[]) =>
    (mockUpdate as unknown as (...a: unknown[]) => unknown)(...args);
  return {
    id: overrides.id ?? 7,
    isActive: overrides.isActive ?? true,
    passwordHash: overrides.passwordHash ?? KNOWN_HASH,
    update,
  };
}

function makeRes() {
  const statusMock = jest.fn();
  const sendMock = jest.fn();
  const res = {
    status: (n: number) => {
      statusMock(n);
      return { send: (b?: unknown) => sendMock(b) };
    },
  } as unknown as Response;
  return { res, statusMock, sendMock };
}

function makeReq(body: unknown): Request {
  return {
    body,
    user: { id: 7, email: 'eli@example.com', displayName: 'Eli', role: 'User' },
  } as unknown as Request;
}

beforeEach(() => {
  mockFindByPk = jest.fn();
  mockUpdate = jest.fn().mockResolvedValue(undefined);
  mockClearAuthCookie = jest.fn();
  mockVerify = jest.fn();
  mockHash = jest.fn();
});

describe('authController.changePassword (HD-018)', () => {
  it('returns 204 when the current password is correct and writes the new hash', async () => {
    mockFindByPk.mockResolvedValue(makeFakeUser());
    mockVerify.mockResolvedValue(true);
    mockHash.mockResolvedValue('$2b$10$newHashForNewPassword');

    const req = makeReq({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });
    const { res, statusMock, sendMock } = makeRes();

    await changePassword(req, res, jest.fn() as NextFunction);

    expect(mockFindByPk).toHaveBeenCalledWith(7);
    expect(mockVerify).toHaveBeenCalledWith('oldPassword123', KNOWN_HASH);
    expect(mockHash).toHaveBeenCalledWith('newPassword456', 10);
    expect(mockUpdate).toHaveBeenCalledWith({
      passwordHash: '$2b$10$newHashForNewPassword',
    });
    expect(statusMock).toHaveBeenCalledWith(204);
    expect(sendMock).toHaveBeenCalledWith(undefined);
  });

  it('throws HttpError(400, validation_error) when the body has an empty newPassword', async () => {
    const req = makeReq({ currentPassword: 'oldPassword123', newPassword: '' });
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await changePassword(req, res, next);

    expect(mockFindByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields?.newPassword).toBe('Enter a new password.');
  });

  it('throws HttpError(400, validation_error) when the body is a non-object (array)', async () => {
    const req = makeReq([]) as unknown as Request;
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await changePassword(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe('validation_error');
    expect(err.fields?._body).toBe('Request body must be a JSON object.');
  });

  it('throws HttpError(403, invalid_credentials) and does NOT update when the current password is wrong', async () => {
    mockFindByPk.mockResolvedValue(makeFakeUser());
    mockVerify.mockResolvedValue(false);

    const req = makeReq({
      currentPassword: 'wrongPassword',
      newPassword: 'newPassword456',
    });
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await changePassword(req, res, next);

    expect(mockHash).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.status).toBe(403);
    expect(err.errorCode).toBe('invalid_credentials');
    expect(err.message).toBe('Your current password is incorrect.');
  });

  it('clears the cookie and throws HttpError(401, account_inactive) when the user is no longer active', async () => {
    mockFindByPk.mockResolvedValue(makeFakeUser({ isActive: false }));

    const req = makeReq({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await changePassword(req, res, next);

    expect(mockClearAuthCookie).toHaveBeenCalledWith(res);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.errorCode).toBe('account_inactive');
  });

  it('clears the cookie and throws HttpError(401, account_inactive) when the user is missing', async () => {
    mockFindByPk.mockResolvedValue(null);

    const req = makeReq({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction & jest.Mock;

    await changePassword(req, res, next);

    expect(mockClearAuthCookie).toHaveBeenCalledWith(res);
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as jest.Mock).mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.errorCode).toBe('account_inactive');
  });
});
