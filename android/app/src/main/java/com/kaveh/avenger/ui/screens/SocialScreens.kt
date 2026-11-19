package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
private data class SocialPostRow(
    val id: String,
    @SerialName("author_id") val authorId: String,
    val body: String,
    val visibility: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("published_at") val publishedAt: String? = null
)

@Serializable
private data class SocialProfileRow(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null,
    val bio: String = "",
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("profile_visibility") val profileVisibility: String = "public",
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
private data class SocialReactionRow(
    @SerialName("post_id") val postId: String,
    @SerialName("user_id") val userId: String,
    val reaction: String
)

@Serializable
private data class SocialFollowRow(
    @SerialName("follower_id") val followerId: String,
    @SerialName("following_id") val followingId: String
)

private data class FeedCardState(
    val post: SocialPostRow,
    val author: String,
    val likeCount: Int,
    val likedByMe: Boolean
)

@Composable
fun ExploreFeedScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val cards = remember { mutableStateListOf<FeedCardState>() }
    var loading by remember { mutableStateOf(true) }
    var busyPost by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            val posts = supabase.postgrest["posts"].select {
                order(column = "published_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(40)
            }.decodeList<SocialPostRow>()
            val authorIds = posts.map { it.authorId }.distinct()
            val profiles = if (authorIds.isEmpty()) emptyList() else supabase.postgrest["profiles"].select {
                filter { isIn("id", authorIds) }
            }.decodeList<SocialProfileRow>()
            val reactions = if (posts.isEmpty()) emptyList() else supabase.postgrest["post_reactions"].select {
                filter { isIn("post_id", posts.map { it.id }) }
            }.decodeList<SocialReactionRow>()
            val profileNames = profiles.associate { it.id to (it.displayName.ifBlank { it.username ?: "کاربر" }) }
            val reactionsByPost = reactions.groupBy { it.postId }
            cards.clear()
            cards.addAll(posts.map { post ->
                val postReactions = reactionsByPost[post.id].orEmpty()
                FeedCardState(post, profileNames[post.authorId] ?: "کاربر کاوه", postReactions.size, postReactions.any { it.userId == userId })
            })
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت فید ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("اکتشاف", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("پست‌های قابل مشاهده از سرور مرکزی", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = { scope.launch { refresh() } }, enabled = !loading) {
                Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی")
            }
        }
        if (loading) {
            CircularProgressIndicator()
        } else if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error)
            Button(onClick = { scope.launch { refresh() } }) { Text("تلاش دوباره") }
        } else if (cards.isEmpty()) {
            Text("هنوز محتوای قابل نمایشی وجود ندارد.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(cards, key = { it.post.id }) { card ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(card.author, fontWeight = FontWeight.Bold)
                            Text(card.post.body, style = MaterialTheme.typography.bodyLarge)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                IconButton(
                                    onClick = {
                                        scope.launch {
                                            busyPost = card.post.id
                                            try {
                                                if (card.likedByMe) {
                                                    supabase.postgrest["post_reactions"].delete {
                                                        filter {
                                                            eq("post_id", card.post.id)
                                                            eq("user_id", userId)
                                                        }
                                                    }
                                                } else {
                                                    supabase.postgrest["post_reactions"].insert(
                                                        SocialReactionRow(card.post.id, userId, "❤️")
                                                    )
                                                }
                                                refresh()
                                            } catch (exception: Exception) {
                                                error = exception.message ?: "ثبت واکنش ناموفق بود."
                                            } finally {
                                                busyPost = null
                                            }
                                        }
                                    },
                                    enabled = busyPost != card.post.id
                                ) {
                                    Icon(Icons.Outlined.Favorite, contentDescription = "پسندیدن", tint = if (card.likedByMe) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Text("${card.likeCount} پسند", modifier = Modifier.padding(top = 12.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EditableProfileScreen(supabase: SupabaseClient, userId: String, email: String?) {
    val scope = rememberCoroutineScope()
    var profile by remember { mutableStateOf<SocialProfileRow?>(null) }
    var displayName by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var followers by remember { mutableStateOf(0) }
    var following by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun loadProfile() {
        loading = true
        error = null
        try {
            val loaded = supabase.postgrest["profiles"].select {
                filter { eq("id", userId) }
                limit(1)
            }.decodeList<SocialProfileRow>().firstOrNull()
            profile = loaded
            displayName = loaded?.displayName.orEmpty()
            bio = loaded?.bio.orEmpty()
            followers = supabase.postgrest["follows"].select {
                filter { eq("following_id", userId); eq("status", "accepted") }
            }.decodeList<SocialFollowRow>().size
            following = supabase.postgrest["follows"].select {
                filter { eq("follower_id", userId); eq("status", "accepted") }
            }.decodeList<SocialFollowRow>().size
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت پروفایل ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId) { loadProfile() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("پروفایل من", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        if (loading) {
            CircularProgressIndicator()
        } else if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error)
            Button(onClick = { scope.launch { loadProfile() } }) { Text("تلاش دوباره") }
        } else {
            Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(email ?: "حساب کاربری", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("@${profile?.username ?: "بدون‌نام‌کاربری"}", fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        Text("$followers دنبال‌کننده")
                        Text("$following دنبال‌شونده")
                    }
                }
            }
            OutlinedTextField(value = displayName, onValueChange = { displayName = it }, label = { Text("نام نمایشی") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(value = bio, onValueChange = { bio = it.take(300) }, label = { Text("درباره من") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
            Button(
                onClick = {
                    scope.launch {
                        saving = true
                        message = null
                        error = null
                        try {
                            supabase.postgrest["profiles"].update({
                                set("display_name", displayName.trim())
                                set("bio", bio.trim())
                            }) {
                                filter { eq("id", userId) }
                            }
                            message = "پروفایل ذخیره شد."
                            loadProfile()
                        } catch (exception: Exception) {
                            error = exception.message ?: "ذخیره پروفایل ناموفق بود."
                        } finally {
                            saving = false
                        }
                    }
                },
                enabled = !saving && displayName.trim().isNotEmpty(),
                modifier = Modifier.fillMaxWidth()
            ) { Text(if (saving) "در حال ذخیره…" else "ذخیره تغییرات") }
            message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}
