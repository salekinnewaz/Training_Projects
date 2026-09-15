/**
 * Typed HTTP errors — HD-003.
 *
 * `HttpError` lets controllers signal "respond with this status +
 * body" without each handler needing its own try/catch. The central
 * errorHandler middleware maps HttpError → res.status(status).json(...).
 *
 * Convention: every error body sent to the client is
 *   { error: <errorCode>, message: <human>, [fields]: {...} }
 * so the Angular side can switch on `error` without parsing messages.
 */

export interface HttpErrorBody {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly errorCode: string;
  public readonly fields?: Record<string, string>;

  constructor(
    status: number,
    errorCode: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.errorCode = errorCode;
    this.fields = fields;
  }

  toBody(): HttpErrorBody {
    const body: HttpErrorBody = {
      error: this.errorCode,
      message: this.message,
    };
    if (this.fields) {
      body.fields = this.fields;
    }
    return body;
  }
}
