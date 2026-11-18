package com.kaveh.avenger.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.OTP

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
}
