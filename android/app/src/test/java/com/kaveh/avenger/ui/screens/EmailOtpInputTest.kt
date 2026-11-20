package com.kaveh.avenger.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Test

class EmailOtpInputTest {
    @Test
    fun normalizesPersianDigitsToAscii() {
        assertEquals("123456", normalizeEmailOtpInput("۱۲۳۴۵۶"))
    }

    @Test
    fun normalizesArabicIndicDigitsToAscii() {
        assertEquals("123456", normalizeEmailOtpInput("١٢٣٤٥٦"))
    }

    @Test
    fun removesSeparatorsAndNonDigits() {
        assertEquals("123456", normalizeEmailOtpInput("کد: ۱۲۳-۴۵۶"))
    }

    @Test
    fun limitsInputToSixDigits() {
        assertEquals("123456", normalizeEmailOtpInput("123456789"))
    }

    @Test
    fun emptyOrNonNumericInputProducesEmptyCode() {
        assertEquals("", normalizeEmailOtpInput("abc --"))
    }
}
