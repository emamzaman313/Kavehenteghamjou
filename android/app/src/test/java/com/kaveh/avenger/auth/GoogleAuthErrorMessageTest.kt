package com.kaveh.avenger.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleAuthErrorMessageTest {
    @Test
    fun providerDisabledExplainsRequiredSupabaseConfiguration() {
        val message = GoogleAuthErrorMessage.from(
            IllegalStateException("Unsupported provider: provider is not enabled")
        )

        assertTrue(message.contains("Google Provider"))
        assertTrue(message.contains("Supabase"))
    }

    @Test
    fun cancellationOffersRetry() {
        val message = GoogleAuthErrorMessage.from(
            IllegalStateException("User cancelled the credential request")
        )

        assertTrue(message.contains("لغو شد"))
        assertTrue(message.contains("دوباره"))
    }

    @Test
    fun networkFailureSuggestsCheckingConnectivity() {
        val message = GoogleAuthErrorMessage.from(
            IllegalStateException("Unable to resolve host auth.example.supabase.co")
        )

        assertTrue(message.contains("اتصال"))
    }

    @Test
    fun unknownFailureDoesNotLeakRawPayload() {
        val message = GoogleAuthErrorMessage.from(
            IllegalStateException("""{"access_token":"private-token"}""")
        )

        assertFalse(message.contains("access_token"))
        assertFalse(message.contains("private-token"))
    }
}
