package com.kaveh.avenger.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleNonceTest {
    @Test
    fun sha256HexMatchesKnownVector() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            GoogleNonce.sha256Hex("abc")
        )
    }

    @Test
    fun rawNonceIsUrlSafeAndFresh() {
        val first = GoogleNonce.createRawNonce()
        val second = GoogleNonce.createRawNonce()

        assertTrue(first.matches(Regex("^[A-Za-z0-9_-]{43}$")))
        assertTrue(second.matches(Regex("^[A-Za-z0-9_-]{43}$")))
        assertNotEquals(first, second)
        assertEquals(64, GoogleNonce.sha256Hex(first).length)
    }
}
