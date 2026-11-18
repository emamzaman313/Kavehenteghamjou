package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

private const val FEED_PAGE_SIZE = 30

@Serializable
private data class FeedPostRow(
    val id: String,
    @SerialName("author_id") val authorId: String,
    val body: String,
    val visibility: String,
    @SerialName("comments_enabled") val commentsEnabled: Boolean = true,
    @SerialName("published_at") val publishedAt: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
private data class FeedAuthorRow(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null
)

@Serializable
private data class FeedReactionRow(
    @SerialName("post_id") val postId: String,
    @SerialName("user_id") val userId: String,
    val reaction: String
)

@Serializable
private data class FeedPostInsert(
    @SerialName("author_id") val authorId: String,
    val body: String,
    val visibility: String,
    @SerialName("comments_enabled") val commentsEnabled: Boolean = true
)

@Serializable
private data class FeedReactionInsert(
    @SerialName("post_id") val postId: String,
    @SerialName("user_id") val userId: String,
    val reaction: String = "❤️"
)

@Composable
fun SocialFeedScreen(
    supabase: SupabaseClient,
    userId: String,
    composerOnly: Boolean = false,
    onPublished: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var posts by remember { mutableStateOf<List<FeedPostRow>>(emptyList()) }
    var authors by remember { mutableStateOf<Map<String, FeedAuthorRow>>(emptyMap()) }
    var reactions by remember { mutableStateOf<List<FeedReactionRow>>(emptyList()) }
    var body by remember { mutableStateOf("") }
    var visibility by remember { mutableStateOf("public") }
    var loading by remember { mutableStateOf(!composerOnly) }
    var publishing by remember { mutableStateOf(false) }
    var actingOnPost by remember { mutableStateOf<String?>(null) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var statusText by remember { mutableStateOf<String?>(null) }

    suspend fun refreshFeed() {
        loading = true
        errorText = null
        try {
            val loaded = supabase.postgrest["posts"].select {
                order(column = "published_at", order = Order.DESCENDING)
                order(column = "created_at", order = Order.DESCENDING)
                limit(FEED_PAGE_SIZE)
            }.decodeList<FeedPostRow>()

            val ids = loaded.map { it.id }
            val authorIds = loaded.map { it.authorId }.distinct()
            val people = if (authorIds.isEmpty()) {
                emptyList()
            } else {
                supabase.postgrest["profiles"].select {
                    filter { isIn("id", authorIds) }
                }.decodeList<FeedAuthorRow>()
            }
            val postReactions = if (ids.isEmpty()) {
                emptyList()
            } else {
                supabase.postgrest["post_reactions"].select {
                    filter { isIn("post_id", ids) }
                }.decodeList<FeedReactionRow>()
            }

            posts = loaded
            authors = people.associateBy { it.id }
            reactions = postReactions
            if (loaded.isEmpty()) {
                statusText = "هنوز پست قابل‌نمایشی وجود ندارد. اولین پست را منتشر کنید."
            } else {
                statusText = null
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "دریافت فید انجام نشد. اتصال اینترنت یا مجوز مشاهده محتوا را بررسی کنید."
        } finally {
            loading = false
        }
    }

    suspend fun publishPost() {
        val text = body.trim()
        if (text.isEmpty()) {
            errorText = "متن پست را وارد کنید."
            return
        }
        if (text.length > 4000) {
            errorText = "متن پست نباید بیشتر از ۴۰۰۰ نویسه باشد."
            return
        }

        publishing = true
        errorText = null
        statusText = null
        try {
            // The server supplies id and timestamps; RLS validates author_id = auth.uid().
            supabase.postgrest.from("posts").insert(
                FeedPostInsert(
                    authorId = userId,
                    body = text,
                    visibility = visibility
                )
            )
            body = ""
            statusText = "پست در Supabase منتشر شد."
            if (!composerOnly) refreshFeed()
            onPublished()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "انتشار پست انجام نشد. دسترسی حساب یا اتصال اینترنت را بررسی کنید."
        } finally {
            publishing = false
        }
    }

    suspend fun toggleReaction(post: FeedPostRow) {
        if (actingOnPost != null) return
        actingOnPost = post.id
        errorText = null
        try {
            val isLiked = reactions.any { it.postId == post.id && it.userId == userId }
            if (isLiked) {
                supabase.postgrest.from("post_reactions").delete {
                    filter {
                        eq("post_id", post.id)
                        eq("user_id", userId)
                    }
                }
                reactions = reactions.filterNot { it.postId == post.id && it.userId == userId }
            } else {
                // The unique post/user key and RLS prevent duplicate or foreign reactions.
                supabase.postgrest.from("post_reactions").insert(
                    FeedReactionInsert(postId = post.id, userId = userId)
                )
                reactions = reactions + FeedReactionRow(post.id, userId, "❤️")
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            errorText = "ثبت واکنش انجام نشد. ممکن است این پست دیگر قابل‌دسترسی نباشد."
        } finally {
            actingOnPost = null
        }
    }

    LaunchedEffect(userId, composerOnly) {
        if (!composerOnly) refreshFeed()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        if (composerOnly) "انتشار محتوا" else "فید کاوه",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "محتوای واقعی و قابل‌مشاهده برای حساب شما",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (!composerOnly) {
                    TextButton(onClick = { scope.launch { refreshFeed() } }, enabled = !loading) {
                        Text("تازه‌سازی")
                    }
                }
            }
        }

        item {
            OutlinedCard(shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        "پست جدید",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    OutlinedTextField(
                        value = body,
                        onValueChange = { body = it.take(4000) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("چه چیزی می‌خواهید به اشتراک بگذارید؟") },
                        minLines = 3,
                        maxLines = 6,
                        supportingText = { Text("${body.length}/۴۰۰۰") }
                    )
                    Text("میزان دسترسی", style = MaterialTheme.typography.labelLarge)
                    listOf(
                        "public" to "عمومی",
                        "followers" to "دنبال‌کنندگان",
                        "private" to "فقط خودم"
                    ).forEach { (value, title) ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = visibility == value,
                                onClick = { visibility = value }
                            )
                            Text(title, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    errorText?.let {
                        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    statusText?.let {
                        Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                    }
                    Button(
                        onClick = { scope.launch { publishPost() } },
                        enabled = !publishing && body.isNotBlank(),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (publishing) {
                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("در حال انتشار…")
                        } else {
                            Text("انتشار پست")
                        }
                    }
                }
            }
        }

        if (!composerOnly) {
            if (loading) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(24.dp),
                        horizontalArrangement = Arrangement.Center
                    ) { CircularProgressIndicator() }
                }
            } else if (posts.isEmpty()) {
                item {
                    Text(
                        statusText ?: "فید خالی است.",
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                items(posts, key = { it.id }) { post ->
                    val author = authors[post.authorId]
                    val likes = reactions.count { it.postId == post.id }
                    val likedByMe = reactions.any { it.postId == post.id && it.userId == userId }
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(9.dp)
                        ) {
                            Text(
                                author?.displayName ?: "کاربر",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                            author?.username?.let {
                                Text("@$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                            }
                            Text(post.body, style = MaterialTheme.typography.bodyLarge)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "${if (post.visibility == "public") "عمومی" else if (post.visibility == "followers") "دنبال‌کنندگان" else "خصوصی"} · $likes پسند",
                                    modifier = Modifier.weight(1f),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                TextButton(
                                    onClick = { scope.launch { toggleReaction(post) } },
                                    enabled = actingOnPost == null
                                ) {
                                    Text(if (likedByMe) "❤️ پسندیدم" else "♡ پسندیدن")
                                }
                            }
                            Text(
                                post.publishedAt.take(16).replace("T", " "),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            if (posts.size >= FEED_PAGE_SIZE) {
                item {
                    Text(
                        "برای دیدن پست‌های قدیمی‌تر، فید را تازه‌سازی کنید. صفحه‌بندی پایدار در نسخه بعد تکمیل می‌شود.",
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
