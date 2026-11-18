package com.kaveh.avenger.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.OtpType

class EmailOtpRepository(private val supabase: SupabaseClient) {
    suspend fun sendCode(email: String) {
        supabase.auth.sendOtpTo(Email) {
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
