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
    }

    suspend fun loginWithPassword(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email = email.trim().lowercase()
            this.password = password
        }
        supabase.auth.updateUser {
            data {
                put("account_password_ready", true)
            }
        }
    }
}
