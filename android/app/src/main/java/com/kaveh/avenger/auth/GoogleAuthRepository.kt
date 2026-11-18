package com.kaveh.avenger.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.kaveh.avenger.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.IDToken

/** Native Google Credential Manager flow. ID token is verified by Supabase Auth. */
class GoogleAuthRepository(private val supabase: SupabaseClient) {

    suspend fun signIn(context: Context) {
        require(BuildConfig.GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com")) {
            "GOOGLE_WEB_CLIENT_ID is not configured in local.properties."
        }

        val rawNonce = GoogleNonce.createRawNonce()
        val hashedNonce = GoogleNonce.sha256Hex(rawNonce)
        val googleOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setNonce(hashedNonce)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleOption)
            .build()

        val result = CredentialManager.create(context).getCredential(context, request)
        val credential = result.credential
        require(
            credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) { "Google did not return an ID token credential." }

        val googleToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
        supabase.auth.signInWith(IDToken) {
            idToken = googleToken
            provider = Google
            nonce = rawNonce
        }
    }
}
