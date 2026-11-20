import { describe, expect, it } from "vitest";
import {
  getSignupPasswordChecks,
  getSignupPasswordError,
  normalizePasswordDigits,
} from "../lib/password-policy";

describe("signup password policy", () => {
  it("normalizes Persian and Arabic numerals to ASCII digits", () => {
    expect(normalizePasswordDigits("KavehPower۹!")).toBe("KavehPower9!");
    expect(normalizePasswordDigits("KavehPower٤!")).toBe("KavehPower4!");
  });

  it("accepts a password that meets the policy and matches its confirmation", () => {
    const password = normalizePasswordDigits("KavehPower۹!");
    expect(getSignupPasswordError(password, normalizePasswordDigits("KavehPower۹!"))).toBeNull();
    expect(getSignupPasswordChecks(password, password).every((check) => check.ok)).toBe(true);
  });

  it("rejects passwords missing uppercase, lowercase, digits, or symbols", () => {
    const checks = getSignupPasswordChecks("kavehpower123", "kavehpower123");
    expect(checks.find((check) => check.id === "uppercase")?.ok).toBe(false);
    expect(checks.find((check) => check.id === "symbol")?.ok).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    expect(getSignupPasswordError("KavehPower9!", "KavehPower8!")).toContain("تکرار رمز");
  });

  it("rejects passwords shorter than ten characters", () => {
    expect(getSignupPasswordError("KavEh9!", "KavEh9!")).toContain("حداقل 10 نویسه");
  });
});
