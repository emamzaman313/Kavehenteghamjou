package com.kaveh.avenger.files

import java.security.MessageDigest

/**
 * Verifies both the declared byte length and SHA-256 digest before a downloaded
 * private file is written to the user's destination.
 */
internal fun verifyFileIntegrity(bytes: ByteArray, expectedSize: Long, expectedSha256: String): Boolean {
    if (bytes.size.toLong() != expectedSize || expectedSha256.isBlank()) return false
    val actualSha256 = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
    return MessageDigest.isEqual(
        actualSha256.lowercase().toByteArray(Charsets.US_ASCII),
        expectedSha256.lowercase().toByteArray(Charsets.US_ASCII)
    )
}
