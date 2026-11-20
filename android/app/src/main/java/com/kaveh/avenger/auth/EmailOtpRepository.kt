package com.kaveh.avenger.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.OTP
import kotlinx.serialization.json.put

class EmailOtpRepository(private val supabase: SupabaseClient) {
    suspend fun sendCode(email: String) {
        supabase.auth.signInWith(OTP) {
            this.email = email.trim().lowercase()
        }
    }

    suspend fun verifyCode(email: String, token: String) {
        supabase.auth.verifyEmailOtp(
            type = OtpType.Email.EMAIL,
            email = email.trim().lowercase(),
            token = token
        )
    }

    suspend fun setAccountPassword(password: String) {
        supabase.auth.updateUser {
            this.password = password
            data {
                put("account_password_ready", true)
            }
        }
        // Refresh the authenticated session so MainActivity receives the
        // server-confirmed account_password_ready metadata and opens the app.
        supabase.auth.refreshCurrentSession()
    }

    suspend fun loginWithPassword(email: String, password: String) {
        val normalizedPassword = normalizePasswordDigits(password)
        try {
            supabase.auth.signInWith(Email) {
                this.email = email.trim().lowercase()
                this.password = normalizedPassword
            }
        } catch (error: Exception) {
            val message = error.message.orEmpty().lowercase()
            val invalidCredentials = message.contains("invalid_credentials") ||
                message.contains("invalid login credentials")
            // Preserve passwords saved verbatim by older app versions.
            if (!invalidCredentials || normalizedPassword == password) throw error
            supabase.auth.signInWith(Email) {
                this.email = email.trim().lowercase()
                this.password = password
            }
        }
    }
}
