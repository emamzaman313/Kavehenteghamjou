package com.kaveh.avenger.files

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

class FileIntegrityTest {
    private val bytes = "کاوه انتقامجو".toByteArray(Charsets.UTF_8)
    private val sha256 = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }

    @Test
    fun acceptsMatchingSizeAndSha256() {
        assertTrue(verifyFileIntegrity(bytes, bytes.size.toLong(), sha256))
    }

    @Test
    fun rejectsIncorrectByteSize() {
        assertFalse(verifyFileIntegrity(bytes, bytes.size.toLong() + 1, sha256))
    }

    @Test
    fun rejectsIncorrectSha256() {
        assertFalse(verifyFileIntegrity(bytes, bytes.size.toLong(), "0".repeat(64)))
    }

    @Test
    fun rejectsMissingSha256() {
        assertFalse(verifyFileIntegrity(bytes, bytes.size.toLong(), ""))
    }
}
