import { extractApiMessage, HttpError } from "../../services/http";

/**
 * Failed requests throw with the raw body appended, e.g.
 * `POST /api/auth/registration/send-otp failed: 400 - {"success":false,...}`.
 * Screens show this text to people, so the backend's own sentence has to be
 * recovered from it and anything unparseable must never reach the UI.
 */
describe("extractApiMessage", () => {
  it("recovers the backend message from a failed request", () => {
    const error = new HttpError(
      'POST /api/auth/registration/send-otp failed: 400 - {"success":false,"message":"An account with this email already exists. Please log in instead.","data":null}',
      400,
    );

    expect(extractApiMessage(error, "fallback")).toBe(
      "An account with this email already exists. Please log in instead.",
    );
  });

  it("keeps the message matchable so the duplicate account case can be detected", () => {
    const error = new HttpError(
      'POST /api/auth/registration/send-otp failed: 400 - {"success":false,"message":"An account with this email already exists. Please log in instead.","data":null}',
      400,
    );

    expect(/already (exists|registered)/i.test(extractApiMessage(error, "fallback"))).toBe(true);
  });

  it("falls back rather than leaking the raw request string when the body is not JSON", () => {
    const error = new HttpError("GET /api/users/4/settings failed: 403 - ", 403);

    expect(extractApiMessage(error, "Something went wrong.")).toBe("Something went wrong.");
  });

  it("falls back when the body is malformed JSON", () => {
    const error = new Error('POST /api/users failed: 500 - {"success":false,"mess');

    expect(extractApiMessage(error, "Could not create account.")).toBe(
      "Could not create account.",
    );
  });

  it("falls back when the body parses but carries no message", () => {
    const error = new Error('POST /api/users failed: 400 - {"success":false,"data":null}');

    expect(extractApiMessage(error, "Could not create account.")).toBe(
      "Could not create account.",
    );
  });

  it("falls back for a non-Error value", () => {
    expect(extractApiMessage("boom", "Please try again.")).toBe("Please try again.");
  });
});
