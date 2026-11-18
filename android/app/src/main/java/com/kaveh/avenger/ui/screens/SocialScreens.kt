package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
private data class SocialProfileRow(
    val id: String,
    val username: String? = null,
    @SerialName("display_name") val displayName: String,
    val bio: String = "",
    @SerialName("profile_visibility") val profileVisibility: String = "public"
)

@Serializable
private data class SocialFollowRow(
    @SerialName("follower_id") val followerId: String,
    @SerialName("following_id") val followingId: String,
    val status: String
)

@Serializable
private data class SocialFollowInsert(
    @SerialName("follower_id") val followerId: String,
    @SerialName("following_id") val followingId: String
)

@Composable
fun ExploreScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var profiles by remember { mutableStateOf<List<SocialProfileRow>>(emptyList()) }
    var followedIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var loading by remember { mutableStateOf(true) }
    var actionUserId by remember { mutableStateOf<String?>(null) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var infoText by remember { mutableStateOf<String?>(null) }

    suspend fun search(term: String) {
        val normalized = term.trim()
        if (normalized.isNotEmpty() && normalized.length < 2) {
            errorText = "برای جست‌وجو حداقل دو نویسه وارد کنید."
            return
        }

        loading = true
        errorText = null
        infoText = null
        try {
            val safeTerm = normalized.replace("%", "\\%").replace("_", "\\_")
            val found = supabase.postgrest["profiles"].select {
                filter {
                    neq("id", userId)
                    if (safeTerm.isNotEmpty()) {
                        or {
                            ilike("username", "%$safeTerm%")
                            ilike("display_name", "%$safeTerm%")
                        }
                    }
                }
                order(column = "display_name", order = Order.ASCENDING)
                limit(20)
            }.decodeList<SocialProfileRow>()

            val ids = found.map { it.id }
            val following = if (ids.isEmpty()) {
                emptyList()
            } else {
                supabase.postgrest["follows"].select {
                    filter {
                        eq("follower_id", userId)
                        isIn("following_id", ids)
                    }
                }.decodeList<SocialFollowRow>()
            }

            profiles = found
            followedIds = following.map { it.followingId }.toSet()
            if (found.isEmpty()) {
                infoText = if (normalized.isBlank()) {
                    "در حال حاضر کاربر عمومی قابل‌نمایشی پیدا نشد."
                } else {
                    "نتیجه‌ای برای این جست‌وجو پیدا نشد."
                }
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "دریافت کاربران ممکن نشد. اتصال اینترنت و دسترسی حساب را بررسی کنید."
        } finally {
            loading = false
        }
    }

    suspend fun toggleFollow(profile: SocialProfileRow) {
        if (actionUserId != null) return
        actionUserId = profile.id
        errorText = null
        try {
            if (profile.id in followedIds) {
                supabase.postgrest.from("follows").delete {
                    filter {
                        eq("follower_id", userId)
                        eq("following_id", profile.id)
                    }
                }
                followedIds = followedIds - profile.id
            } else {
                // The database default is "accepted" for public-profile follows.
                // RLS binds follower_id to auth.uid() and rejects self-following.
                supabase.postgrest.from("follows").insert(
                    SocialFollowInsert(followerId = userId, followingId = profile.id)
                )
                followedIds = followedIds + profile.id
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "تغییر وضعیت دنبال‌کردن انجام نشد. ممکن است رابطه قبلاً تغییر کرده باشد."
        } finally {
            actionUserId = null
        }
    }

    LaunchedEffect(userId) { search("") }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("کشف کاربران عمومی", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "نتایج جست‌وجو با سیاست حریم خصوصی Supabase محدود می‌شوند؛ حساب خصوصی در این فهرست افشا نمی‌شود.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it.take(80) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("نام یا نام کاربری") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { scope.launch { search(query) } })
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { scope.launch { search(query) } },
                enabled = !loading
            ) { Text("جست‌وجو") }
            TextButton(
                onClick = { query = ""; scope.launch { search("") } },
                enabled = !loading
            ) { Text("نمایش همه") }
        }
        errorText?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        infoText?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        if (loading) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalArrangement = Arrangement.Center
            ) { CircularProgressIndicator() }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(profiles, key = { it.id }) { profile ->
                    OutlinedCard(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(profile.displayName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                profile.username?.let {
                                    Text("@$it", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                                }
                                if (profile.bio.isNotBlank()) {
                                    Text(profile.bio, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Button(
                                onClick = { scope.launch { toggleFollow(profile) } },
                                enabled = actionUserId == null
                            ) {
                                if (actionUserId == profile.id) {
                                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                                } else {
                                    Text(if (profile.id in followedIds) "دنبال‌شده" else "دنبال‌کردن")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProfileScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var displayName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var visibility by remember { mutableStateOf("public") }
    var errorText by remember { mutableStateOf<String?>(null) }
    var statusText by remember { mutableStateOf<String?>(null) }

    suspend fun loadProfile() {
        loading = true
        errorText = null
        try {
            val profile = supabase.postgrest["profiles"].select {
                filter { eq("id", userId) }
                limit(1)
            }.decodeList<SocialProfileRow>().firstOrNull()
            if (profile == null) {
                errorText = "پروفایل این حساب در Backend پیدا نشد. ساخت پروفایل باید از مسیر امن Auth/Trigger انجام شود."
            } else {
                displayName = profile.displayName
                username = profile.username.orEmpty()
                bio = profile.bio
                visibility = profile.profileVisibility
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "دریافت پروفایل ممکن نشد. اتصال اینترنت و دسترسی حساب را بررسی کنید."
        } finally {
            loading = false
        }
    }

    suspend fun saveProfile() {
        val name = displayName.trim()
        val handle = username.trim()
        val about = bio.trim()
        if (name.isEmpty() || name.length > 60) {
            errorText = "نام نمایشی باید بین ۱ تا ۶۰ نویسه باشد."
            return
        }
        if (handle.isNotEmpty() && !handle.matches(Regex("[A-Za-z0-9_]{3,30}"))) {
            errorText = "نام کاربری باید ۳ تا ۳۰ نویسه و فقط شامل حروف انگلیسی، عدد یا زیرخط باشد."
            return
        }
        if (about.length > 300) {
            errorText = "متن درباره من نباید بیشتر از ۳۰۰ نویسه باشد."
            return
        }

        saving = true
        errorText = null
        statusText = null
        try {
            supabase.postgrest.from("profiles").update({
                set("display_name", name)
                set("username", handle.ifBlank { null })
                set("bio", about)
                set("profile_visibility", visibility)
            }) {
                filter { eq("id", userId) }
            }
            statusText = "تغییرات پروفایل در Supabase ذخیره شد."
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "ذخیره پروفایل انجام نشد. نام کاربری ممکن است تکراری باشد یا سیاست دسترسی آن را رد کرده باشد."
        } finally {
            saving = false
        }
    }

    LaunchedEffect(userId) { loadProfile() }

    if (loading) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) { CircularProgressIndicator() }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("پروفایل من", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "اطلاعات عمومی و حریم خصوصی حساب خود را ویرایش کنید. رتبه و نشان‌ها از سمت سرور کنترل می‌شوند.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        OutlinedCard(shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it.take(60) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("نام نمایشی") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = username,
                    onValueChange = { value -> username = value.filter { it.isLetterOrDigit() || it == '_' }.take(30) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("نام کاربری") },
                    placeholder = { Text("kaveh_user") },
                    singleLine = true
                )
                OutlinedTextField(
                    value = bio,
                    onValueChange = { bio = it.take(300) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("درباره من") },
                    minLines = 3,
                    maxLines = 5
                )
            }
        }
        Text("حریم خصوصی پروفایل", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        listOf(
            "public" to "عمومی",
            "followers" to "فقط دنبال‌کنندگان تأییدشده",
            "private" to "خصوصی"
        ).forEach { (value, label) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = visibility == value, onClick = { visibility = value })
                Text(label, style = MaterialTheme.typography.bodyMedium)
            }
        }
        errorText?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        statusText?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
        Button(
            onClick = { scope.launch { saveProfile() } },
            enabled = !saving,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (saving) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text("در حال ذخیره…")
            } else Text("ذخیره تغییرات")
        }
        Spacer(Modifier.height(18.dp))
    }
}
