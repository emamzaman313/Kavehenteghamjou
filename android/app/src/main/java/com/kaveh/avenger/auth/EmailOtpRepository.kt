package com.kaveh.avenger.auth

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.functions.functions
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.put

@Serializable
private data class SetPasswordArgs(val password: String)

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
        val response = supabase.functions("set-account-password", body = SetPasswordArgs(password))
        if (response.status.value !in 200..299) {
            throw IllegalStateException("رمز عبور توسط سرویس امنیتی پذیرفته نشد. حداقل ۱۰ نویسه و ترکیب حروف کوچک و بزرگ انگلیسی، عدد و نماد را رعایت کنید.")
        }
        supabase.auth.updateUser {
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
