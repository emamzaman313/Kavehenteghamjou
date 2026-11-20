package com.kaveh.avenger.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PasswordPolicyTest {
    @Test
    fun normalizesPersianDigitsToAscii() {
        assertEquals("KavehPower9!", normalizePasswordDigits("KavehPower۹!"))
    }

    @Test
    fun normalizesArabicIndicDigitsToAscii() {
        assertEquals("KavehPower4!", normalizePasswordDigits("KavehPower٤!"))
    }

    @Test
    fun acceptsValidPasswordAndMatchingConfirmation() {
        val password = normalizePasswordDigits("KavehPower۹!")
        assertNull(signupPasswordErrorMessage(password, normalizePasswordDigits("KavehPower۹!")))
        assertTrue(signupPasswordChecks(password, password).all { it.passed })
    }

    @Test
    fun rejectsMissingUppercaseAndSymbol() {
        val checks = signupPasswordChecks("kavehpower123", "kavehpower123")
        assertFalse(checks.first { it.id == "uppercase" }.passed)
        assertFalse(checks.first { it.id == "symbol" }.passed)
    }

    @Test
    fun rejectsMismatchedConfirmation() {
        assertTrue(signupPasswordErrorMessage("KavehPower9!", "KavehPower8!")!!.contains("تکرار رمز"))
    }

    @Test
    fun rejectsShortPasswords() {
        assertTrue(signupPasswordErrorMessage("KavEh9!", "KavEh9!")!!.contains("حداقل ۱۰ نویسه"))
    }
}
