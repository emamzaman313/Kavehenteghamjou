export const SIGNUP_PASSWORD_MIN_LENGTH = 10;

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};':\"\\\\|<>?,./`~";

/** Convert Persian and Arabic numerals to ASCII so mobile keyboards behave consistently. */
export function normalizePasswordDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export type PasswordCheck = {
  id: string;
  label: string;
  ok: boolean;
};

export function getSignupPasswordChecks(password: string, confirmation: string): PasswordCheck[] {
  return [
    { id: "length", label: `حداقل ${SIGNUP_PASSWORD_MIN_LENGTH} نویسه`, ok: Array.from(password).length >= SIGNUP_PASSWORD_MIN_LENGTH },
    { id: "lowercase", label: "یک حرف کوچک انگلیسی", ok: /[a-z]/.test(password) },
    { id: "uppercase", label: "یک حرف بزرگ انگلیسی", ok: /[A-Z]/.test(password) },
    { id: "digit", label: "یک عدد انگلیسی", ok: /[0-9]/.test(password) },
    { id: "symbol", label: "یک نماد مجاز", ok: Array.from(password).some((character) => PASSWORD_SYMBOLS.includes(character)) },
    { id: "match", label: "تکرار رمز یکسان", ok: password.length > 0 && password === confirmation },
  ];
}

export function getSignupPasswordError(password: string, confirmation: string): string | null {
  const checks = getSignupPasswordChecks(password, confirmation);
  const missing = checks.filter((check) => !check.ok);
  if (missing.length === 0) return null;

  const ruleLabels = missing.filter((check) => check.id !== "match").map((check) => check.label);
  if (ruleLabels.length > 0) {
    return `رمز عبور شرایط زیر را ندارد: ${ruleLabels.join("، ")}.`;
  }
  return "تکرار رمز عبور دقیقاً با رمز اول یکسان نیست.";
}
