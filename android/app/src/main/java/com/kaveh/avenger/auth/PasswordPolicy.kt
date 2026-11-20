package com.kaveh.avenger.auth

internal const val SIGNUP_PASSWORD_MIN_LENGTH = 10

private const val PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};':\"\\\\|<>?,./`~"

internal data class SignupPasswordCheck(
    val id: String,
    val label: String,
    val passed: Boolean
)

/** Convert Persian and Arabic numerals to ASCII for consistent server validation. */
internal fun normalizePasswordDigits(value: String): String = buildString(value.length) {
    value.forEach { character ->
        val normalized = when (character) {
            in '\u06F0'..'\u06F9' -> ('0'.code + character.code - '\u06F0'.code).toChar()
            in '\u0660'..'\u0669' -> ('0'.code + character.code - '\u0660'.code).toChar()
            else -> character
        }
        append(normalized)
    }
}

internal fun signupPasswordChecks(password: String, confirmation: String): List<SignupPasswordCheck> = listOf(
    SignupPasswordCheck("length", "حداقل ۱۰ نویسه", password.codePointCount(0, password.length) >= SIGNUP_PASSWORD_MIN_LENGTH),
    SignupPasswordCheck("lowercase", "یک حرف کوچک انگلیسی", password.any { it in 'a'..'z' }),
    SignupPasswordCheck("uppercase", "یک حرف بزرگ انگلیسی", password.any { it in 'A'..'Z' }),
    SignupPasswordCheck("digit", "یک عدد انگلیسی", password.any { it in '0'..'9' }),
    SignupPasswordCheck("symbol", "یک نماد مجاز", password.any { it in PASSWORD_SYMBOLS }),
    SignupPasswordCheck("match", "تکرار رمز یکسان", password.isNotEmpty() && password == confirmation)
)

internal fun signupPasswordErrorMessage(password: String, confirmation: String): String? {
    val checks = signupPasswordChecks(password, confirmation)
    val missingRules = checks.filter { !it.passed && it.id != "match" }
    if (missingRules.isNotEmpty()) {
        return "رمز عبور شرایط زیر را ندارد: ${missingRules.joinToString("، ") { it.label }}."
    }
    if (checks.none { it.id == "match" && it.passed }) {
        return "تکرار رمز عبور دقیقاً با رمز اول یکسان نیست."
    }
    return null
}
