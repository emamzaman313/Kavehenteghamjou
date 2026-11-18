package com.kaveh.avenger.auth

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/** Cryptographic nonce helpers shared by the native Google sign-in flow and unit tests. */
internal object GoogleNonce {
    private val secureRandom = SecureRandom()

    fun createRawNonce(): String {
        val bytes = ByteArray(32)
        secureRandom.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    fun sha256Hex(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        return digest.joinToString(separator = "") { byte -> "%02x".format(byte) }
    }
}
