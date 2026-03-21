export class ClickUpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthenticationError extends ClickUpError {
  constructor() {
    super(
      "Invalid API key. Check your CLICKUP_API_KEY — generate one in ClickUp Settings > Apps > API Token.",
      401,
    );
  }
}

export class NotFoundError extends ClickUpError {
  constructor(resource = "Resource") {
    super(`${resource} not found. Check the ID and try again.`, 404);
  }
}

export class RateLimitedError extends ClickUpError {
  constructor() {
    super(
      "ClickUp rate limit exceeded (100 req/min on free plans). Wait a moment and try again.",
      429,
    );
  }
}

export class ClickUpApiError extends ClickUpError {
  constructor(status: number, body: string) {
    let message = `ClickUp API error (${status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.err) message = `ClickUp: ${parsed.err}`;
      else if (parsed?.error) message = `ClickUp: ${parsed.error}`;
      else if (parsed?.ECODE) message = `ClickUp error ${parsed.ECODE}: ${parsed.err ?? body}`;
    } catch {
      if (body) message = `ClickUp API error (${status}): ${body.slice(0, 200)}`;
    }
    super(message, status);
  }
}

export function classifyHttpError(status: number, body: string): ClickUpError {
  switch (status) {
    case 401:
      return new AuthenticationError();
    case 404:
      return new NotFoundError();
    case 429:
      return new RateLimitedError();
    default:
      return new ClickUpApiError(status, body);
  }
}
