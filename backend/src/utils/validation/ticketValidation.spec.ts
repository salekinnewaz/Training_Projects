/**
 * ticketValidation — unit spec (HD-008 review).
 *
 * P7 closes the test gap on `validateCreateTicketBody`: every field's
 * success path + each documented failure mode (empty, wrong-type,
 * over-cap, bad-enum, non-positive attachmentId) is pinned here.
 *
 * The validator is a pure function so there is no model or service
 * to mock — just import + call + assert. The throw-vs-return shape
 * is exercised directly (the controller hands validation errors to
 * asyncHandler which forwards to `next(error)`, so we don't model
 * the res cycle for the 400 path).
 */

import { HttpError } from '../errors';
import {
  validateCreateTicketBody,
  type CreateTicketInput,
} from './ticketValidation';

function expectHttpError(
  fn: () => unknown,
  predicate: (err: HttpError) => boolean,
): HttpError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    const httpErr = err as HttpError;
    expect(predicate(httpErr)).toBe(true);
    return httpErr;
  }
  throw new Error('expected validateCreateTicketBody to throw');
}

describe('validateCreateTicketBody', () => {
  it('returns a normalized input on the happy path with all fields', () => {
    const result: CreateTicketInput = validateCreateTicketBody({
      title: 'VPN drops hourly',
      description: 'ever since the office wifi swap',
      category: 'IT',
      priority: 'High',
      attachmentId: 42,
    });
    expect(result).toEqual({
      title: 'VPN drops hourly',
      description: 'ever since the office wifi swap',
      category: 'IT',
      priority: 'High',
      attachmentId: 42,
    });
  });

  it('returns a normalized input on the happy path with only required fields', () => {
    const result = validateCreateTicketBody({
      title: 'VPN drops hourly',
      description: 'ever since the office wifi swap',
      priority: 'Medium',
    });
    expect(result).toEqual({
      title: 'VPN drops hourly',
      description: 'ever since the office wifi swap',
      category: null,
      priority: 'Medium',
      attachmentId: null,
    });
  });

  it('rejects an empty title with fields.title = "Enter a title."', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: '',
          description: 'long enough description',
          priority: 'Medium',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.title === 'Enter a title.',
    );
  });

  it('rejects a non-string title with fields.title = "Enter a title."', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 42,
          description: 'long enough description',
          priority: 'Medium',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.title === 'Enter a title.',
    );
  });

  it('rejects a title over 120 chars with the long-title message', () => {
    const longTitle = 'a'.repeat(121);
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: longTitle,
          description: 'long enough description',
          priority: 'Medium',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.title === 'Keep the title under 120 characters.',
    );
  });

  it('rejects an empty description with fields.description = "Describe the issue."', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: '',
          priority: 'Medium',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.description === 'Describe the issue.',
    );
  });

  it('rejects a description over 5000 chars with the long-description message', () => {
    const longDesc = 'a'.repeat(5001);
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: longDesc,
          priority: 'Medium',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.description === 'Description is limited to 5000 characters.',
    );
  });

  it('rejects an invalid category enum string with the category-enum message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
          category: 'Marketing',
          priority: 'Medium',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.category ===
          'Category must be one of: IT, HR, Finance, General.',
    );
  });

  it('normalizes an absent category to null on the returned input', () => {
    const result = validateCreateTicketBody({
      title: 'short',
      description: 'long enough',
      priority: 'Medium',
    });
    expect(result.category).toBeNull();
  });

  it('normalizes an empty-string category to null on the returned input', () => {
    const result = validateCreateTicketBody({
      title: 'short',
      description: 'long enough',
      category: '',
      priority: 'Medium',
    });
    expect(result.category).toBeNull();
  });

  it('rejects an invalid priority enum with the priority-enum message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
          priority: 'Urgent',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.priority === 'Priority must be one of: Low, Medium, High.',
    );
  });

  it('rejects a missing priority with the priority-enum message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.priority === 'Priority must be one of: Low, Medium, High.',
    );
  });

  it('normalizes a missing attachmentId to null on the returned input', () => {
    const result = validateCreateTicketBody({
      title: 'short',
      description: 'long enough',
      priority: 'Medium',
    });
    expect(result.attachmentId).toBeNull();
  });

  it('rejects a negative attachmentId with the positive-integer message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
          priority: 'Medium',
          attachmentId: -1,
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.attachmentId === 'Attachment id must be a positive integer.',
    );
  });

  it('rejects an attachmentId of 0 with the positive-integer message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
          priority: 'Medium',
          attachmentId: 0,
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.attachmentId === 'Attachment id must be a positive integer.',
    );
  });

  it('rejects a non-integer attachmentId (1.5) with the positive-integer message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
          priority: 'Medium',
          attachmentId: 1.5,
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.attachmentId === 'Attachment id must be a positive integer.',
    );
  });

  it('rejects a string attachmentId with the positive-integer message', () => {
    expectHttpError(
      () =>
        validateCreateTicketBody({
          title: 'short',
          description: 'long enough',
          priority: 'Medium',
          attachmentId: '42',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.attachmentId === 'Attachment id must be a positive integer.',
    );
  });

  it('rejects a body that is an array with fields._body = "Request body must be a JSON object."', () => {
    expectHttpError(
      () => validateCreateTicketBody([]),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?._body === 'Request body must be a JSON object.',
    );
  });

  it('rejects a null body with fields._body = "Request body must be a JSON object."', () => {
    expectHttpError(
      () => validateCreateTicketBody(null),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?._body === 'Request body must be a JSON object.',
    );
  });
});
