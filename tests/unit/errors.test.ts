import {
  ClickUpError,
  AuthenticationError,
  NotFoundError,
  RateLimitedError,
  ClickUpApiError,
  classifyHttpError,
} from "../../src/errors.js";

// ---------------------------------------------------------------------------
// Error class behavior
// ---------------------------------------------------------------------------

describe("Error classes", () => {
  it("ClickUpError has statusCode and extends Error", () => {
    const err = new ClickUpError("boom", 500);
    expect(err.message).toBe("boom");
    expect(err.statusCode).toBe(500);
    expect(err).toBeInstanceOf(Error);
  });

  it("AuthenticationError is 401 with actionable message", () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toContain("CLICKUP_API_KEY");
  });

  it("NotFoundError is 404 with customizable resource name", () => {
    expect(new NotFoundError().message).toContain("Resource not found");
    expect(new NotFoundError("Task").message).toContain("Task not found");
  });

  it("RateLimitedError is 429", () => {
    const err = new RateLimitedError();
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain("100 req/min");
  });

  it("ClickUpApiError parses err field from ClickUp response", () => {
    const body = JSON.stringify({ err: "Team not found" });
    const err = new ClickUpApiError(400, body);
    expect(err.message).toContain("Team not found");
  });

  it("ClickUpApiError parses error field from ClickUp response", () => {
    const body = JSON.stringify({ error: "Invalid request" });
    const err = new ClickUpApiError(400, body);
    expect(err.message).toContain("Invalid request");
  });

  it("ClickUpApiError handles non-JSON body gracefully", () => {
    const err = new ClickUpApiError(500, "Internal Server Error");
    expect(err.message).toContain("500");
    expect(err.message).toContain("Internal Server Error");
  });

  it("ClickUpApiError truncates long bodies", () => {
    const longBody = "x".repeat(500);
    const err = new ClickUpApiError(500, longBody);
    expect(err.message.length).toBeLessThan(300);
  });
});

// ---------------------------------------------------------------------------
// classifyHttpError
// ---------------------------------------------------------------------------

describe("classifyHttpError", () => {
  it("maps 401 to AuthenticationError", () => {
    expect(classifyHttpError(401, "")).toBeInstanceOf(AuthenticationError);
  });

  it("maps 404 to NotFoundError", () => {
    expect(classifyHttpError(404, "")).toBeInstanceOf(NotFoundError);
  });

  it("maps 429 to RateLimitedError", () => {
    expect(classifyHttpError(429, "")).toBeInstanceOf(RateLimitedError);
  });

  it("maps other status codes to ClickUpApiError", () => {
    const err = classifyHttpError(403, JSON.stringify({ err: "Forbidden" }));
    expect(err).toBeInstanceOf(ClickUpApiError);
    expect(err.statusCode).toBe(403);
  });

  it("maps 500 to ClickUpApiError", () => {
    expect(classifyHttpError(500, "")).toBeInstanceOf(ClickUpApiError);
  });
});
