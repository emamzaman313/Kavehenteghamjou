package com.kaveh.avenger.ui.screens

import com.kaveh.avenger.ui.progress.OperationProgressController

import android.net.Uri
import android.content.Context
import android.content.Intent
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import android.media.MediaPlayer
import android.media.MediaMetadataRetriever
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.horizontalScroll
import com.kaveh.avenger.BuildConfig
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.GifDecoder

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import io.ktor.utils.io.jvm.javaio.toByteReadChannel
import java.util.UUID
import java.io.File
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonPrimitive

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
private data class ProfileThemeRow(val accent:String="#168bff", val surface:String="#101b2c", val text:String="#f4f1eb")

@Serializable
private data class SocialProfileRow(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null,
    val bio: String = "",
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("cover_path") val coverPath: String? = null,
    @SerialName("profile_visibility") val profileVisibility: String = "public",
    @SerialName("profile_theme") val profileTheme: ProfileThemeRow = ProfileThemeRow(),
    @SerialName("profile_music_path") val profileMusicPath: String? = null,
    @SerialName("profile_music_title") val profileMusicTitle: String? = null,
    @SerialName("featured_badges") val featuredBadges: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
private data class SocialReactionRow(
    @SerialName("post_id") val postId: String,
    @SerialName("user_id") val userId: String,
    val reaction: String
)

@Serializable
private data class SocialCommentRow(
    val id: String,
    @SerialName("post_id") val postId: String,
    @SerialName("author_id") val authorId: String,
    @SerialName("parent_comment_id") val parentCommentId: String? = null,
    val body: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
private data class SocialCommentInsert(
    @SerialName("post_id") val postId: String,
    @SerialName("author_id") val authorId: String,
    val body: String,
    @SerialName("parent_comment_id") val parentCommentId: String? = null
)

@Serializable
private data class SocialFollowRow(
    @SerialName("follower_id") val followerId: String,
    @SerialName("following_id") val followingId: String,
    val status: String = "pending"
)

@Serializable
private data class SocialPostAttachmentRow(
    val id: String,
    @SerialName("post_id") val postId: String,
    @SerialName("bucket_id") val bucketId: String,
    @SerialName("object_path") val objectPath: String,
    @SerialName("original_name") val originalName: String,
    @SerialName("mime_type") val mimeType: String? = null,
    @SerialName("byte_size") val byteSize: Long
)

private data class FeedCardState(
    val post: SocialPostRow,
    val author: String,
    val likeCount: Int,
    val likedByMe: Boolean,
    val followStatus: String? = null,
    val attachments: List<SocialPostAttachmentRow> = emptyList()
)

@Composable
fun ExploreFeedScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val profileImageLoader = remember(context) { ImageLoader.Builder(context).components { add(GifDecoder.Factory()) }.build() }
    val cards = remember { mutableStateListOf<FeedCardState>() }
    var loading by remember { mutableStateOf(true) }
    var busyPost by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedAuthorProfile by remember { mutableStateOf<SocialProfileRow?>(null) }
    var selectedAuthorBadges by remember { mutableStateOf<List<String>>(emptyList()) }
    var authorProfilePlayer by remember { mutableStateOf<MediaPlayer?>(null) }
    var authorProfilePlaying by remember { mutableStateOf(false) }
    val commentsByPost = remember { mutableStateMapOf<String, List<SocialCommentRow>>() }
    val commentDrafts = remember { mutableStateMapOf<String, String>() }
    val expandedComments = remember { mutableStateMapOf<String, Boolean>() }
    val commentBusyByPost = remember { mutableStateMapOf<String, Boolean>() }
    val replyTargets = remember { mutableStateMapOf<String, String?>() }
    val editingComments = remember { mutableStateMapOf<String, String?>() }
    val editDrafts = remember { mutableStateMapOf<String, String>() }
    suspend fun openAuthorProfile(authorId: String) {
        try {
            val loaded = supabase.postgrest["profiles"].select {
                filter { eq("id", authorId) }
                limit(1)
            }.decodeList<SocialProfileRow>().firstOrNull()
            if (loaded == null) {
                error = "این پروفایل خصوصی است یا دسترسی مشاهده آن را نداری."
                return
            }
            selectedAuthorProfile = loaded
            val codes = loaded.featuredBadges
            selectedAuthorBadges = if (codes.isEmpty()) emptyList() else {
                supabase.postgrest["badges"].select { filter { isIn("code", codes) } }
                    .decodeList<JsonObject>().mapNotNull { it["title"]?.jsonPrimitive?.contentOrNull }
            }
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت پروفایل کاربر ناموفق بود."
        }
    }

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
            val attachments = if (posts.isEmpty()) emptyList() else supabase.postgrest["post_attachments"].select {
                filter { isIn("post_id", posts.map { it.id }) }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            }.decodeList<SocialPostAttachmentRow>()
            val attachmentsByPost = attachments.groupBy { it.postId }
            val follows = if (authorIds.isEmpty()) emptyList() else supabase.postgrest["follows"].select {
                filter { eq("follower_id", userId); isIn("following_id", authorIds) }
            }.decodeList<SocialFollowRow>()
            val followByAuthor = follows.associate { it.followingId to it.status }
            val profileNames = profiles.associate { it.id to (it.displayName.ifBlank { it.username ?: "کاربر" }) }
            val reactionsByPost = reactions.groupBy { it.postId }
            cards.clear()
            cards.addAll(posts.map { post ->
                val postReactions = reactionsByPost[post.id].orEmpty()
                FeedCardState(
                    post = post,
                    author = profileNames[post.authorId] ?: "کاربر کاوه",
                    likeCount = postReactions.size,
                    likedByMe = postReactions.any { it.userId == userId },
                    followStatus = followByAuthor[post.authorId],
                    attachments = attachmentsByPost[post.id].orEmpty()
                )
            })
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت فید ناموفق بود."
        } finally {
            loading = false
        }
    }

    suspend fun loadPostComments(postId: String) {
        try {
            commentsByPost[postId] = supabase.postgrest["comments"].select {
                filter { eq("post_id", postId) }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                limit(100)
            }.decodeList<SocialCommentRow>()
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت دیدگاه‌ها ناموفق بود."
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
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                TextButton(onClick = { scope.launch { openAuthorProfile(card.post.authorId) } }) { Text(card.author, fontWeight = FontWeight.Bold) }
                                if (card.post.authorId != userId) {
                                    OutlinedButton(onClick = {
                                        scope.launch {
                                            busyPost = card.post.id
                                            try {
                                                if (card.followStatus != null) {
                                                    supabase.postgrest["follows"].delete {
                                                        filter { eq("follower_id", userId); eq("following_id", card.post.authorId) }
                                                    }
                                                } else {
                                                    supabase.postgrest["follows"].insert(SocialFollowRow(userId, card.post.authorId, "pending"))
                                                }
                                                refresh()
                                            } catch (exception: Exception) {
                                                error = exception.message ?: "تغییر وضعیت دنبال‌کردن ناموفق بود."
                                            } finally { busyPost = null }
                                        }
                                    }, enabled = busyPost != card.post.id) {
                                        Text(when (card.followStatus) {
                                            "accepted" -> "لغو دنبال‌کردن"
                                            "pending" -> "لغو درخواست"
                                            else -> "درخواست دنبال‌کردن"
                                        })
                                    }
                                }
                            }
                            if (card.post.body.isNotBlank()) {
                                Text(card.post.body, style = MaterialTheme.typography.bodyLarge)
                            }
                            card.attachments.forEach { attachment ->
                                val mediaUrl = supabase.storage[attachment.bucketId].publicUrl(attachment.objectPath)
                                val mimeType = attachment.mimeType.orEmpty()
                                if (mimeType.startsWith("video/")) {
                                    AndroidView(
                                        factory = { viewContext ->
                                            val controller = MediaController(viewContext)
                                            VideoView(viewContext).apply {
                                                setMediaController(controller)
                                                controller.setAnchorView(this)
                                                setVideoURI(Uri.parse(mediaUrl))
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth().height(220.dp)
                                    )
                                } else {
                                    TextButton(
                                        onClick = {
                                            try {
                                                val intent = Intent(Intent.ACTION_VIEW).apply {
                                                    setDataAndType(Uri.parse(mediaUrl), mimeType.ifBlank { "*/*" })
                                                }
                                                context.startActivity(intent)
                                            } catch (exception: Exception) {
                                                error = exception.message ?: "باز کردن فایل ناموفق بود."
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("پیوست: ${attachment.originalName} · ${attachment.byteSize / 1024} KB")
                                    }
                                }
                            }
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
                            TextButton(onClick = {
                                val wasExpanded = expandedComments[card.post.id] == true
                                expandedComments[card.post.id] = !wasExpanded
                                if (!wasExpanded && commentsByPost[card.post.id] == null) scope.launch { loadPostComments(card.post.id) }
                            }) { Text(if (expandedComments[card.post.id] == true) "بستن دیدگاه‌ها" else "دیدگاه‌ها") }
                            if (expandedComments[card.post.id] == true) {
                                val allComments = commentsByPost[card.post.id].orEmpty()
                                allComments.filter { it.parentCommentId == null }.forEach { root ->
                                    Column(Modifier.fillMaxWidth().padding(start = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(root.body, style = MaterialTheme.typography.bodyMedium)
                                        Text(if (root.authorId == userId) "شما" else "کاربر", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                            TextButton(onClick = { replyTargets[card.post.id] = root.id }) { Text("پاسخ") }
                                            if (root.authorId == userId) {
                                                TextButton(onClick = { editingComments[root.id] = card.post.id; editDrafts[root.id] = root.body }) { Text("ویرایش") }
                                                TextButton(onClick = { scope.launch {
                                                    try {
                                                        supabase.postgrest["comments"].delete { filter { eq("id", root.id); eq("author_id", userId) } }
                                                        loadPostComments(card.post.id)
                                                    } catch (exception: Exception) { error = exception.message ?: "حذف دیدگاه ناموفق بود." }
                                                } }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
                                            }
                                        }
                                        if (editingComments[root.id] == card.post.id) {
                                            OutlinedTextField(value = editDrafts[root.id].orEmpty(), onValueChange = { editDrafts[root.id] = it.take(10000) }, label = { Text("ویرایش دیدگاه") }, modifier = Modifier.fillMaxWidth())
                                            Row {
                                                TextButton(onClick = { scope.launch {
                                                    val value = editDrafts[root.id].orEmpty().trim()
                                                    if (value.isNotEmpty()) try {
                                                        supabase.postgrest["comments"].update({ set("body", value); set("edited_at", java.time.Instant.now().toString()) }) { filter { eq("id", root.id); eq("author_id", userId) } }
                                                        editingComments.remove(root.id); loadPostComments(card.post.id)
                                                    } catch (exception: Exception) { error = exception.message ?: "ویرایش دیدگاه ناموفق بود." }
                                                } }) { Text("ذخیره") }
                                                TextButton(onClick = { editingComments.remove(root.id) }) { Text("لغو") }
                                            }
                                        }
                                        allComments.filter { it.parentCommentId == root.id }.forEach { reply ->
                                            Column(Modifier.fillMaxWidth().padding(start = 18.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                                Text("↳ ${reply.body}", style = MaterialTheme.typography.bodyMedium)
                                                Text(if (reply.authorId == userId) "شما" else "کاربر", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    TextButton(onClick = { replyTargets[card.post.id] = root.id }) { Text("پاسخ") }
                                                    if (reply.authorId == userId) {
                                                        TextButton(onClick = { editingComments[reply.id] = card.post.id; editDrafts[reply.id] = reply.body }) { Text("ویرایش") }
                                                        TextButton(onClick = { scope.launch {
                                                            try {
                                                                supabase.postgrest["comments"].delete { filter { eq("id", reply.id); eq("author_id", userId) } }
                                                                loadPostComments(card.post.id)
                                                            } catch (exception: Exception) { error = exception.message ?: "حذف پاسخ ناموفق بود." }
                                                        } }) { Text("حذف", color = MaterialTheme.colorScheme.error) }
                                                    }
                                                }
                                                if (editingComments[reply.id] == card.post.id) {
                                                    OutlinedTextField(value = editDrafts[reply.id].orEmpty(), onValueChange = { editDrafts[reply.id] = it.take(10000) }, label = { Text("ویرایش پاسخ") }, modifier = Modifier.fillMaxWidth())
                                                    Row {
                                                        TextButton(onClick = { scope.launch {
                                                            val value = editDrafts[reply.id].orEmpty().trim()
                                                            if (value.isNotEmpty()) try {
                                                                supabase.postgrest["comments"].update({ set("body", value); set("edited_at", java.time.Instant.now().toString()) }) { filter { eq("id", reply.id); eq("author_id", userId) } }
                                                                editingComments.remove(reply.id); loadPostComments(card.post.id)
                                                            } catch (exception: Exception) { error = exception.message ?: "ویرایش پاسخ ناموفق بود." }
                                                        } }) { Text("ذخیره") }
                                                        TextButton(onClick = { editingComments.remove(reply.id) }) { Text("لغو") }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if (replyTargets[card.post.id] != null) {
                                    Text("در حال پاسخ به دیدگاه", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                                    TextButton(onClick = { replyTargets[card.post.id] = null }) { Text("لغو پاسخ") }
                                }
                                OutlinedTextField(
                                    modifier = Modifier.fillMaxWidth(),
                                    value = commentDrafts[card.post.id].orEmpty(),
                                    onValueChange = { commentDrafts[card.post.id] = it.take(10000) },
                                    label = { Text(if (replyTargets[card.post.id] == null) "نوشتن دیدگاه" else "نوشتن پاسخ") },
                                    minLines = 1,
                                    maxLines = 3
                                )
                                Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                                    Button(
                                        enabled = commentDrafts[card.post.id].orEmpty().isNotBlank() && commentBusyByPost[card.post.id] != true,
                                        onClick = {
                                            val body = commentDrafts[card.post.id].orEmpty().trim()
                                            if (body.isNotEmpty()) scope.launch {
                                                commentBusyByPost[card.post.id] = true
                                                try {
                                                    supabase.postgrest["comments"].insert(SocialCommentInsert(card.post.id, userId, body, replyTargets[card.post.id]))
                                                    commentDrafts[card.post.id] = ""
                                                    replyTargets[card.post.id] = null
                                                    loadPostComments(card.post.id)
                                                } catch (exception: Exception) {
                                                    error = exception.message ?: "ارسال دیدگاه ناموفق بود."
                                                } finally { commentBusyByPost[card.post.id] = false }
                                            }
                                        }
                                    ) { Text(if (commentBusyByPost[card.post.id] == true) "در حال ارسال…" else "ارسال دیدگاه") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    selectedAuthorProfile?.let { person ->
        AlertDialog(
            onDismissRequest = {
                authorProfilePlayer?.release(); authorProfilePlayer = null; authorProfilePlaying = false
                selectedAuthorProfile = null
            },
            title = { Text(person.displayName.ifBlank { person.username ?: "پروفایل کاربر" }) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    person.avatarUrl?.let { avatar ->
                        AsyncImage(
                            model = avatar,
                            imageLoader = profileImageLoader,
                            contentDescription = "تصویر پروفایل",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.width(76.dp).height(76.dp)
                        )
                    }
                    Text(person.username?.let { "@$it" } ?: "کاربر کاوه", color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(person.profileTheme.accent)) }.getOrDefault(MaterialTheme.colorScheme.primary))
                    Text(person.bio.ifBlank { "این کاربر هنوز توضیحی برای پروفایل ثبت نکرده است." })
                    person.coverPath?.let { path ->
                        AsyncImage(
                            model = supabase.storage["profile-media"].publicUrl(path),
                            imageLoader = profileImageLoader,
                            contentDescription = "کاور پروفایل",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().height(150.dp)
                        )
                    }
                    Text("حریم خصوصی: " + when(person.profileVisibility) { "private" -> "خصوصی"; "followers" -> "دنبال‌کنندگان"; else -> "عمومی" }, style = MaterialTheme.typography.labelSmall)
                    Text("تم اختصاصی", fontWeight = FontWeight.SemiBold)
                    Surface(
                        color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(person.profileTheme.surface)) }.getOrDefault(MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(Modifier.fillMaxWidth().padding(10.dp)) {
                            Text(person.displayName, color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(person.profileTheme.text)) }.getOrDefault(MaterialTheme.colorScheme.onSurface), fontWeight = FontWeight.Bold)
                            Text(person.bio.ifBlank { "پیش‌نمایش تم پروفایل" }, color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(person.profileTheme.text)) }.getOrDefault(MaterialTheme.colorScheme.onSurface))
                        }
                    }
                    if (person.coverPath != null) Text("کاور اختصاصی فعال است.", style = MaterialTheme.typography.bodySmall)
                    if (selectedAuthorBadges.isNotEmpty()) {
                        Text("ویترین دستاوردها", fontWeight = FontWeight.SemiBold)
                        Text(selectedAuthorBadges.joinToString("  ·  "), style = MaterialTheme.typography.bodySmall)
                    }
                    if (person.profileMusicPath != null) {
                        Text(person.profileMusicTitle?.takeIf { it.isNotBlank() } ?: "موسیقی اختصاصی پروفایل", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        OutlinedButton(onClick = {
                            try {
                                val current = authorProfilePlayer
                                if (current?.isPlaying == true) {
                                    current.pause(); authorProfilePlaying = false
                                } else if (current != null) {
                                    current.start(); authorProfilePlaying = true
                                } else {
                                    val url = supabase.storage["post-media"].publicUrl(person.profileMusicPath)
                                    authorProfilePlayer = MediaPlayer().apply {
                                        setDataSource(context, Uri.parse(url))
                                        setOnPreparedListener { it.start(); authorProfilePlaying = true }
                                        setOnCompletionListener { it.seekTo(0); authorProfilePlaying = false }
                                        prepareAsync()
                                    }
                                }
                            } catch (exception: Exception) {
                                error = exception.message ?: "پخش موسیقی پروفایل ناموفق بود."
                            }
                        }, modifier = Modifier.fillMaxWidth()) {
                            Text(if (authorProfilePlaying) "توقف موسیقی پروفایل" else "پخش موسیقی پروفایل")
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    authorProfilePlayer?.release(); authorProfilePlayer = null; authorProfilePlaying = false
                    selectedAuthorProfile = null
                }) { Text("بستن") }
            }
        )
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
    val incomingRequests = remember { mutableStateListOf<SocialFollowRow>() }
    val requestProfiles = remember { mutableStateListOf<SocialProfileRow>() }
    val followerProfiles = remember { mutableStateListOf<SocialProfileRow>() }
    val followingProfiles = remember { mutableStateListOf<SocialProfileRow>() }
    var showingConnections by remember { mutableStateOf("none") }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedCover by remember { mutableStateOf<Uri?>(null) }
    var selectedMusic by remember { mutableStateOf<Uri?>(null) }
    var profileVisibility by remember { mutableStateOf("public") }
    var themeAccent by remember { mutableStateOf("#168bff") }
    var themeSurface by remember { mutableStateOf("#101b2c") }
    var themeText by remember { mutableStateOf("#f4f1eb") }
    var musicTitle by remember { mutableStateOf("") }
    var removeProfileMusic by remember { mutableStateOf(false) }
    var profilePlayer by remember { mutableStateOf<MediaPlayer?>(null) }
    var profileMusicPlaying by remember { mutableStateOf(false) }
    var featuredBadges by remember { mutableStateOf(setOf<String>()) }
    var availableBadges by remember { mutableStateOf<List<Pair<String,String>>>(emptyList()) }
    val context = LocalContext.current
    val profileImageLoader = remember(context) { ImageLoader.Builder(context).components { add(GifDecoder.Factory()) }.build() }
    val coverPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { selectedCover = it }
    val musicPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        selectedMusic = uri
        removeProfileMusic = false
        profilePlayer?.release()
        profilePlayer = null
        profileMusicPlaying = false
    }

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
            profileVisibility = loaded?.profileVisibility ?: "public"
            themeAccent = loaded?.profileTheme?.accent ?: "#168bff"
            themeSurface = loaded?.profileTheme?.surface ?: "#101b2c"
            themeText = loaded?.profileTheme?.text ?: "#f4f1eb"
            musicTitle = loaded?.profileMusicTitle.orEmpty()
            featuredBadges = loaded?.featuredBadges?.toSet() ?: emptySet()
            val earned = supabase.postgrest["user_badges"].select { filter { eq("user_id", userId) } }
                .decodeList<JsonObject>()
            val earnedCodes = earned.mapNotNull { it["badge_code"]?.jsonPrimitive?.contentOrNull }
            availableBadges = if (earnedCodes.isEmpty()) emptyList() else supabase.postgrest["badges"].select {
                filter { isIn("code", earnedCodes) }
            }.decodeList<JsonObject>().mapNotNull { row ->
                val code = row["code"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val title = row["title"]?.jsonPrimitive?.contentOrNull ?: code
                code to title
            }
            followers = supabase.postgrest["follows"].select {
                filter { eq("following_id", userId); eq("status", "accepted") }
            }.decodeList<SocialFollowRow>().size
            following = supabase.postgrest["follows"].select {
                filter { eq("follower_id", userId); eq("status", "accepted") }
            }.decodeList<SocialFollowRow>().size
            val requests = supabase.postgrest["follows"].select {
                filter { eq("following_id", userId); eq("status", "pending") }
            }.decodeList<SocialFollowRow>()
            val followerRows = supabase.postgrest["follows"].select {
                filter { eq("following_id", userId); eq("status", "accepted") }
            }.decodeList<SocialFollowRow>()
            val followingRows = supabase.postgrest["follows"].select {
                filter { eq("follower_id", userId); eq("status", "accepted") }
            }.decodeList<SocialFollowRow>()
            val connectionIds = (followerRows.map { it.followerId } + followingRows.map { it.followingId }).distinct()
            val connectionProfiles = if (connectionIds.isEmpty()) emptyList() else supabase.postgrest["profiles"].select {
                filter { isIn("id", connectionIds) }
            }.decodeList<SocialProfileRow>()
            followerProfiles.clear()
            followerProfiles.addAll(connectionProfiles.filter { p -> followerRows.any { it.followerId == p.id } })
            followingProfiles.clear()
            followingProfiles.addAll(connectionProfiles.filter { p -> followingRows.any { it.followingId == p.id } })
            incomingRequests.clear()
            incomingRequests.addAll(requests)
            val requestIds = requests.map { it.followerId }.distinct()
            requestProfiles.clear()
            if (requestIds.isNotEmpty()) {
                requestProfiles.addAll(supabase.postgrest["profiles"].select {
                    filter { isIn("id", requestIds) }
                }.decodeList<SocialProfileRow>())
            }
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت پروفایل ناموفق بود."
        } finally {
            loading = false
        }
    }

    DisposableEffect(userId) {
        onDispose { profilePlayer?.release(); profilePlayer = null }
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
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { showingConnections = if (showingConnections == "followers") "none" else "followers" }) { Text("نمایش دنبال‌کنندگان") }
                        TextButton(onClick = { showingConnections = if (showingConnections == "following") "none" else "following" }) { Text("نمایش دنبال‌شوندگان") }
                    }
                    val connectionList = if (showingConnections == "followers") followerProfiles else followingProfiles
                    if (showingConnections != "none") {
                        Text(if (showingConnections == "followers") "دنبال‌کنندگان" else "دنبال‌شوندگان", fontWeight = FontWeight.SemiBold)
                        if (connectionList.isEmpty()) Text("فهرست خالی است.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        connectionList.forEach { person ->
                            Text(person.displayName.ifBlank { person.username ?: "کاربر" })
                        }
                    }
                }
            }
            if (incomingRequests.isNotEmpty()) {
                Text("درخواست‌های دنبال‌کردن", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                incomingRequests.forEach { request ->
                    val requestName = requestProfiles.firstOrNull { it.id == request.followerId }?.displayName ?: "کاربر"
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(requestName)
                        Button(onClick = {
                            scope.launch {
                                try {
                                    supabase.postgrest["follows"].update({ set("status", "accepted") }) {
                                        filter { eq("follower_id", request.followerId); eq("following_id", userId); eq("status", "pending") }
                                    }
                                    loadProfile()
                                } catch (exception: Exception) {
                                    error = exception.message ?: "پذیرش درخواست ناموفق بود."
                                }
                            }
                        }) { Text("پذیرفتن") }
                        TextButton(onClick = {
                            scope.launch {
                                try {
                                    supabase.postgrest["follows"].delete {
                                        filter { eq("follower_id", request.followerId); eq("following_id", userId); eq("status", "pending") }
                                    }
                                    loadProfile()
                                } catch (exception: Exception) {
                                    error = exception.message ?: "رد درخواست ناموفق بود."
                                }
                            }
                        }) { Text("رد کردن", color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
            Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("کاور اختصاصی پروفایل", fontWeight = FontWeight.Bold)
                    val coverModel = selectedCover ?: profile?.coverPath?.let { supabase.storage["profile-media"].publicUrl(it) }
                    if (coverModel != null) {
                        AsyncImage(
                            model = coverModel,
                            imageLoader = profileImageLoader,
                            contentDescription = "پیش‌نمایش کاور پروفایل",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().height(160.dp)
                        )
                    }
                    Text(
                        when { selectedCover != null -> "تصویر جدید انتخاب شده است."; profile?.coverPath != null -> "کاور اختصاصی ذخیره‌شده فعال است."; else -> "برای پروفایلت یک تصویر کاور انتخاب کن." },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedButton(onClick = { coverPicker.launch("image/*") }, enabled = !saving, modifier = Modifier.fillMaxWidth()) {
                        Text(if (selectedCover == null) "انتخاب تصویر کاور" else "تغییر تصویر انتخاب‌شده")
                    }
                }
            }
            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("شخصی‌سازی پروفایل", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("تم اختصاصی", color = MaterialTheme.colorScheme.primary)
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(themeSurface)) }.getOrDefault(MaterialTheme.colorScheme.surface)
                        )
                    ) {
                        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(displayName.ifBlank { "پیش‌نمایش پروفایل" }, color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(themeText)) }.getOrDefault(MaterialTheme.colorScheme.onSurface), fontWeight = FontWeight.Bold)
                            Text(bio.ifBlank { "این نمای آزمایشی تم پروفایل توست." }, color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(themeText)) }.getOrDefault(MaterialTheme.colorScheme.onSurface))
                            Text("کاوه • هویت اختصاصی", color = runCatching { androidx.compose.ui.graphics.Color(android.graphics.Color.parseColor(themeAccent)) }.getOrDefault(MaterialTheme.colorScheme.primary))
                        }
                    }
                    OutlinedTextField(value=themeAccent,onValueChange={themeAccent=it},label={Text("رنگ تأکیدی (#RRGGBB)")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                    OutlinedTextField(value=themeSurface,onValueChange={themeSurface=it},label={Text("پس‌زمینه کارت (#RRGGBB)")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                    OutlinedTextField(value=themeText,onValueChange={themeText=it},label={Text("رنگ نوشته (#RRGGBB)")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                    Text("حریم خصوصی پروفایل", color = MaterialTheme.colorScheme.primary)
                    Row(horizontalArrangement=Arrangement.spacedBy(6.dp)) {
                        TextButton(onClick={profileVisibility="public"}) { Text(if(profileVisibility=="public") "✓ عمومی" else "عمومی") }
                        TextButton(onClick={profileVisibility="followers"}) { Text(if(profileVisibility=="followers") "✓ دنبال‌کنندگان" else "دنبال‌کنندگان") }
                        TextButton(onClick={profileVisibility="private"}) { Text(if(profileVisibility=="private") "✓ خصوصی" else "خصوصی") }
                    }
                    Text("موسیقی پروفایل", color = MaterialTheme.colorScheme.primary)
                    val savedMusicPath = profile?.profileMusicPath
                    if (savedMusicPath != null || selectedMusic != null) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            OutlinedButton(onClick = {
                                try {
                                    val current = profilePlayer
                                    if (current?.isPlaying == true) {
                                        current.pause()
                                        profileMusicPlaying = false
                                    } else if (current != null) {
                                        current.start()
                                        profileMusicPlaying = true
                                    } else {
                                        val source = selectedMusic?.toString()
                                            ?: supabase.storage["post-media"].publicUrl(savedMusicPath!!)
                                        profilePlayer = MediaPlayer().apply {
                                            setDataSource(context, Uri.parse(source))
                                            setOnPreparedListener { media ->
                                                media.start()
                                                profileMusicPlaying = true
                                            }
                                            setOnCompletionListener { media ->
                                                media.seekTo(0)
                                                profileMusicPlaying = false
                                            }
                                            setOnErrorListener { _, _, _ ->
                                                profileMusicPlaying = false
                                                profilePlayer?.release()
                                                profilePlayer = null
                                                true
                                            }
                                            prepareAsync()
                                        }
                                    }
                                } catch (exception: Exception) {
                                    error = exception.message ?: "پخش موسیقی پروفایل ناموفق بود."
                                }
                            }, modifier = Modifier.weight(1f)) {
                                Text(if (profileMusicPlaying) "توقف موسیقی" else "پیش‌شنوی موسیقی")
                            }
                            TextButton(onClick = {
                                profilePlayer?.release()
                                profilePlayer = null
                                profileMusicPlaying = false
                                selectedMusic = null
                                removeProfileMusic = true
                                musicTitle = ""
                            }) { Text("حذف موسیقی", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                    OutlinedTextField(value=musicTitle,onValueChange={musicTitle=it.take(120)},label={Text("نام قطعه")},modifier=Modifier.fillMaxWidth(),singleLine=true)
                    OutlinedButton(onClick={musicPicker.launch("audio/*")},modifier=Modifier.fillMaxWidth()) { Text(if(selectedMusic==null) "انتخاب فایل موسیقی" else "فایل موسیقی انتخاب شد") }
                    Text("ویترین دستاوردها (حداکثر ۶ نشان)", color = MaterialTheme.colorScheme.primary)
                    if(availableBadges.isEmpty()) Text("هنوز نشانی برای نمایش دریافت نکرده‌ای.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                    if (featuredBadges.isNotEmpty()) {
                        Text("ویترین فعلی: " + availableBadges.filter { featuredBadges.contains(it.first) }.joinToString(" · ") { it.second }, style=MaterialTheme.typography.bodySmall, color=MaterialTheme.colorScheme.primary)
                    }
                    availableBadges.forEach { (code,title) ->
                        Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically) {
                            Checkbox(checked=featuredBadges.contains(code),onCheckedChange={checked->featuredBadges=if(checked&&featuredBadges.size<6) featuredBadges+code else featuredBadges-code})
                            Text(title,style=MaterialTheme.typography.bodySmall)
                        }
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
                            OperationProgressController.run("ذخیره هویت پروفایل") { progress ->
                            progress.advance(10, "اعتبارسنجی اطلاعات و تنظیمات هویت")
                            var coverPath = profile?.coverPath
                            selectedCover?.let { uri ->
                                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                                require(mime in setOf("image/jpeg", "image/png", "image/webp", "image/avif", "image/gif")) { "فرمت تصویر کاور پشتیبانی نمی‌شود." }
                                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                    ?: throw IllegalStateException("خواندن تصویر کاور ناموفق بود.")
                                require(bytes.size in 1..5_000_000) { "حجم کاور باید حداکثر ۵ مگابایت باشد." }
                                coverPath = "$userId/profile-covers/${UUID.randomUUID()}"
                                supabase.storage.from("profile-media").upload(coverPath!!, bytes) {
                                    contentType = ContentType.parse(mime)
                                    upsert = false
                                }
                                progress.advance(42, "تصویر کاور در فضای رسانه ذخیره شد")
                            }
                            var profileMusicPath = if (removeProfileMusic) null else profile?.profileMusicPath
                            if (!removeProfileMusic) selectedMusic?.let { uri ->
                                val mime = context.contentResolver.getType(uri) ?: "audio/mpeg"
                                require(mime.startsWith("audio/")) { "فایل موسیقی معتبر نیست." }
                                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                    ?: throw IllegalStateException("خواندن موسیقی پروفایل ناموفق بود.")
                                require(bytes.size in 1..20_000_000) { "حجم موسیقی باید حداکثر ۲۰ مگابایت باشد." }
                                profileMusicPath = userId + "/profile-music/" + UUID.randomUUID().toString()
                                supabase.storage.from("post-media").upload(profileMusicPath!!, bytes) {
                                    contentType = ContentType.parse(mime)
                                    upsert = false
                                }
                                progress.advance(68, "موسیقی پروفایل بارگذاری شد")
                            }
                            require(themeAccent.matches(Regex("^#[0-9a-fA-F]{6}$")) && themeSurface.matches(Regex("^#[0-9a-fA-F]{6}$")) && themeText.matches(Regex("^#[0-9a-fA-F]{6}$"))) { "کد رنگ باید به شکل #RRGGBB باشد." }
                            progress.advance(78, "تنظیمات پروفایل آماده ثبت نهایی است")
                            supabase.postgrest["profiles"].update({
                                set("display_name", displayName.trim())
                                set("bio", bio.trim())
                                set("cover_path", coverPath)
                                set("profile_visibility", profileVisibility)
                                set("profile_theme", buildJsonObject {
                                    put("accent", JsonPrimitive(themeAccent))
                                    put("surface", JsonPrimitive(themeSurface))
                                    put("text", JsonPrimitive(themeText))
                                })
                                set("profile_music_path", profileMusicPath)
                                set("profile_music_title", if (profileMusicPath == null) null else musicTitle.trim().take(120))
                                set("featured_badges", JsonArray(featuredBadges.take(6).map { JsonPrimitive(it) }))
                            }) {
                                filter { eq("id", userId) }
                            }
                            progress.advance(92, "تغییرات هویت در سرور ذخیره شد")
                            selectedCover = null
                            selectedMusic = null
                            removeProfileMusic = false
                            profilePlayer?.release(); profilePlayer = null; profileMusicPlaying = false
                            message = "پروفایل ذخیره شد."
                            loadProfile()
                            }
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


@Serializable
private data class ReelRow(
    val id: String,
    @SerialName("author_id") val authorId: String,
    val caption: String,
    @SerialName("video_path") val videoPath: String,
    @SerialName("views_count") val viewsCount: Long = 0,
    @SerialName("allow_comments") val allowComments: Boolean = true,
    @SerialName("published_at") val publishedAt: String,
    @SerialName("cover_path") val coverPath: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null
)

@Serializable
private data class ReelInsertRow(
    @SerialName("author_id") val authorId: String,
    val caption: String,
    @SerialName("video_path") val videoPath: String,
    @SerialName("mime_type") val mimeType: String,
    val visibility: String = "public",
    @SerialName("cover_path") val coverPath: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Int? = null
)

@Serializable
private data class ReelViewInsertRow(
    @SerialName("reel_id") val reelId: String,
    @SerialName("viewer_id") val viewerId: String
)

@Serializable
private data class ReelReactionRow(
    @SerialName("reel_id") val reelId: String,
    @SerialName("user_id") val userId: String,
    val reaction: String
)

@Serializable
private data class ReelCommentRow(
    val id: String,
    @SerialName("reel_id") val reelId: String,
    @SerialName("author_id") val authorId: String,
    val body: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
private data class ReelCommentInsertRow(
    @SerialName("reel_id") val reelId: String,
    @SerialName("author_id") val authorId: String,
    val body: String
)

@Serializable
private data class ReelReportInsertRow(
    @SerialName("reporter_id") val reporterId: String,
    @SerialName("target_type") val targetType: String = "reel",
    @SerialName("target_id") val targetId: String,
    val reason: String = "گزارش ریلز نامناسب",
    val status: String = "open"
)

private data class ReelCardState(
    val reel: ReelRow,
    val author: String,
    val likeCount: Int,
    val likedByMe: Boolean,
    val comments: List<ReelCommentRow> = emptyList()
)

@Composable
fun ReelsScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val cards = remember { mutableStateListOf<ReelCardState>() }
    var loading by remember { mutableStateOf(true) }
    var busyReel by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val viewedReels = remember { mutableSetOf<String>() }

    var caption by remember { mutableStateOf("") }
    var selectedVideo by remember { mutableStateOf<Uri?>(null) }
    var uploading by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { selectedVideo = it }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            val reels = supabase.postgrest["reels"].select {
                order(column = "published_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(40)
            }.decodeList<ReelRow>()
            val authors = reels.map { it.authorId }.distinct()
            val profiles = if (authors.isEmpty()) emptyList() else supabase.postgrest["profiles"].select {
                filter { isIn("id", authors) }
            }.decodeList<SocialProfileRow>()
            val reactions = if (reels.isEmpty()) emptyList() else supabase.postgrest["reel_reactions"].select {
                filter { isIn("reel_id", reels.map { it.id }) }
            }.decodeList<ReelReactionRow>()
            val comments = if (reels.isEmpty()) emptyList() else supabase.postgrest["reel_comments"].select {
                filter { isIn("reel_id", reels.map { it.id }) }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                limit(200)
            }.decodeList<ReelCommentRow>()
            val names = profiles.associate { it.id to (it.displayName.ifBlank { it.username ?: "کاربر" }) }
            val byReel = reactions.groupBy { it.reelId }
            val commentsByReel = comments.groupBy { it.reelId }
            cards.clear()
            cards.addAll(reels.map { reel ->
                val list = byReel[reel.id].orEmpty()
                ReelCardState(reel, names[reel.authorId] ?: "کاربر کاوه", list.size, list.any { it.userId == userId }, commentsByReel[reel.id].orEmpty())
            })
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت ریلز ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId) { refresh() }

    val myReels = cards.filter { it.reel.authorId == userId }
    val myReelViews = myReels.sumOf { it.reel.viewsCount }
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
            Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Text(myReels.size.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text("ویدئوهای من", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Text(myReelViews.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text("بازدید ویدئوهای من", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Text(cards.size.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text("ویدئوهای قابل مشاهده", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Text("استودیوی سازندگان · انتشار عمومی", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text("برای هر ویدئو به‌صورت خودکار تصویر جلد ساخته می‌شود؛ حداکثر ۵۰ مگابایت و ۱۰ دقیقه.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(value = caption, onValueChange = { caption = it.take(2200) }, label = { Text("توضیح ریلز") }, modifier = Modifier.fillMaxWidth(), maxLines = 3)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { videoPicker.launch("video/*") }, enabled = !uploading) { Text(if (selectedVideo == null) "انتخاب ویدئو" else "تغییر ویدئو") }
            Button(onClick = {
                val uri = selectedVideo ?: return@Button
                scope.launch {
                    uploading = true
                    error = null
                    try {
                        OperationProgressController.run("انتشار ریلز") { progress ->
                        progress.advance(12, "اعتبارسنجی ویدئو و سقف حجم")
                        val mime = context.contentResolver.getType(uri) ?: "video/mp4"
                        require(mime.startsWith("video/")) { "فایل انتخاب‌شده ویدئو نیست." }
                        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: throw IllegalStateException("خواندن ویدئو ناموفق بود.")
                        require(bytes.size <= 50_000_000) { "حداکثر حجم ویدئو ۵۰ مگابایت است." }
                        progress.advance(30, "خواندن رسانه و استخراج مدت و کاور")
                        var durationSeconds: Int? = null
                        var coverBytes: ByteArray? = null
                        val retriever = MediaMetadataRetriever()
                        try {
                            retriever.setDataSource(context, uri)
                            durationSeconds = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                                ?.toLongOrNull()?.div(1000)?.toInt()
                            if (durationSeconds != null) require(durationSeconds in 1..600) { "مدت ریلز باید حداکثر ۱۰ دقیقه باشد." }
                            retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)?.let { frame ->
                                val output = ByteArrayOutputStream()
                                frame.compress(Bitmap.CompressFormat.JPEG, 82, output)
                                coverBytes = output.toByteArray()
                                frame.recycle()
                            }
                        } finally {
                            retriever.release()
                        }
                        val path = "$userId/reels/${UUID.randomUUID()}"
                        val uploadedPaths = mutableListOf<String>()
                        try {
                            progress.advance(48, "انتقال ویدئو به مخزن رسانه")
                            supabase.storage.from("post-media").upload(path, bytes) {
                                contentType = ContentType.parse(mime)
                                upsert = false
                            }
                            uploadedPaths.add(path)
                            progress.advance(74, "ویدئو منتقل شد؛ ذخیره کاور")
                            val coverPath = if (coverBytes != null) "$userId/reel-covers/${UUID.randomUUID()}.jpg" else null
                            if (coverPath != null && coverBytes != null) {
                                supabase.storage.from("post-media").upload(coverPath, coverBytes!!) {
                                    contentType = ContentType.parse("image/jpeg")
                                    upsert = false
                                }
                                uploadedPaths.add(coverPath)
                            }
                            progress.advance(88, "ثبت metadata ریلز")
                            supabase.postgrest["reels"].insert(
                                ReelInsertRow(userId, caption.trim(), path, mime, "public", coverPath, durationSeconds)
                            )
                            progress.advance(96, "ریلز در سرور منتشر شد")
                            selectedVideo = null
                            caption = ""
                            refresh()
                        } catch (exception: Exception) {
                            if (uploadedPaths.isNotEmpty()) {
                                runCatching { supabase.storage["post-media"].delete(*uploadedPaths.toTypedArray()) }
                            }
                            throw exception
                        }
                        }
                    } catch (exception: Exception) {
                        error = exception.message ?: "انتشار ریلز ناموفق بود."
                    } finally {
                        uploading = false
                    }
                }
            }, enabled = selectedVideo != null && !uploading) { Text(if (uploading) "در حال بارگذاری…" else "انتشار ریلز") }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("ویدئوهای کوتاه", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { scope.launch { refresh() } }) {
                Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی")
            }
        }
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (!loading && cards.isEmpty() && error == null) Text("هنوز ریلزی منتشر نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            items(cards, key = { it.reel.id }) { card ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(card.author, fontWeight = FontWeight.SemiBold)
                        val videoUrl = BuildConfig.SUPABASE_URL.trimEnd('/') + "/storage/v1/object/public/post-media/" + card.reel.videoPath
                        card.reel.coverPath?.let { coverPath ->
                            AsyncImage(
                                model = BuildConfig.SUPABASE_URL.trimEnd('/') + "/storage/v1/object/public/post-media/" + coverPath,
                                contentDescription = "تصویر جلد ریلز",
                                modifier = Modifier.fillMaxWidth().height(110.dp),
                                contentScale = ContentScale.Crop
                            )
                        }
                        AndroidView(
                            modifier = Modifier.fillMaxWidth().height(250.dp),
                            factory = { viewContext ->
                                VideoView(viewContext).apply {
                                    tag = videoUrl
                                    val controller = MediaController(viewContext)
                                    controller.setAnchorView(this)
                                    setMediaController(controller)
                                    setOnPreparedListener { player ->
                                        player.isLooping = true
                                        player.start()
                                        if (viewedReels.add(card.reel.id)) {
                                            scope.launch {
                                                try {
                                                    supabase.postgrest["reel_views"].insert(ReelViewInsertRow(card.reel.id, userId))
                                                } catch (_: Exception) {
                                                    // A duplicate view is expected when the same reel is revisited.
                                                }
                                            }
                                        }
                                    }
                                    setVideoURI(Uri.parse(videoUrl))
                                }
                            },
                            update = { view ->
                                if (view.tag != videoUrl) {
                                    view.tag = videoUrl
                                    view.setVideoURI(Uri.parse(videoUrl))
                                }
                            },
                            onRelease = { view -> view.stopPlayback() }
                        )
                        card.reel.durationSeconds?.let { duration -> Text("مدت ویدئو: ${duration / 60}:${(duration % 60).toString().padStart(2, '0')}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        if (card.reel.caption.isNotBlank()) Text(card.reel.caption)
                        if (card.reel.allowComments) {
                            Text("دیدگاه‌ها (" + card.comments.size + ")", fontWeight = FontWeight.SemiBold)
                            card.comments.takeLast(8).forEach { comment ->
                                Text(comment.body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            var commentDraft by remember(card.reel.id) { mutableStateOf("") }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(value = commentDraft, onValueChange = { commentDraft = it.take(1000) }, label = { Text("نوشتن دیدگاه") }, modifier = Modifier.weight(1f), maxLines = 2)
                                TextButton(onClick = {
                                    val body = commentDraft.trim()
                                    if (body.isNotEmpty()) scope.launch {
                                        busyReel = card.reel.id
                                        try {
                                            supabase.postgrest["reel_comments"].insert(ReelCommentInsertRow(card.reel.id, userId, body))
                                            commentDraft = ""
                                            refresh()
                                        } catch (exception: Exception) {
                                            error = exception.message ?: "ارسال دیدگاه ناموفق بود."
                                        } finally { busyReel = null }
                                    }
                                }, enabled = commentDraft.trim().isNotEmpty() && busyReel != card.reel.id) { Text("ارسال") }
                            }
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${card.reel.viewsCount} بازدید", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("${card.likeCount} پسند", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = {
                            scope.launch {
                                busyReel = card.reel.id
                                try {
                                    supabase.postgrest["reports"].insert(ReelReportInsertRow(userId, targetId = card.reel.id))
                                    error = null
                                } catch (exception: Exception) {
                                    error = exception.message ?: "ثبت گزارش ناموفق بود."
                                } finally { busyReel = null }
                            }
                        }, enabled = busyReel != card.reel.id) { Text("گزارش ریلز") }
                        Button(
                            onClick = {
                                scope.launch {
                                    busyReel = card.reel.id
                                    try {
                                        if (card.likedByMe) {
                                            supabase.postgrest["reel_reactions"].delete {
                                                filter { eq("reel_id", card.reel.id); eq("user_id", userId) }
                                            }
                                        } else {
                                            supabase.postgrest["reel_reactions"].insert(ReelReactionRow(card.reel.id, userId, "❤️"))
                                        }
                                        refresh()
                                    } catch (exception: Exception) {
                                        error = exception.message ?: "ثبت پسند ناموفق بود."
                                    } finally {
                                        busyReel = null
                                    }
                                }
                            },
                            enabled = busyReel != card.reel.id
                        ) {
                            Icon(Icons.Outlined.Favorite, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text(if (card.likedByMe) "لغو پسند" else "پسندیدن")
                        }
                    }
                }
            }
        }
    }
}


@Serializable
private data class AudioTrackRow(
    val id: String,
    val title: String,
    val artist: String,
    @SerialName("audio_path") val audioPath: String
)

@Serializable
private data class PlaylistRow(
    val id: String,
    val title: String,
    val description: String = "",
    @SerialName("is_public") val isPublic: Boolean = false
)

@Serializable
private data class PlaylistInsertRow(
    @SerialName("owner_id") val ownerId: String,
    val title: String
)

@Serializable
private data class PlaylistTrackInsertRow(
    @SerialName("playlist_id") val playlistId: String,
    @SerialName("track_id") val trackId: String,
    val position: Int = 0
)

@Serializable
private data class PlaylistTrackRow(
    @SerialName("playlist_id") val playlistId: String,
    @SerialName("track_id") val trackId: String,
    val position: Int
)

@Serializable
private data class DailyTitleRow(
    val id: String,
    val title: String,
    val body: String,
    val category: String,
    @SerialName("starts_at") val startsAt: String
)

@Composable
fun AudioAndDailyScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val tracks = remember { mutableStateListOf<AudioTrackRow>() }
    val titles = remember { mutableStateListOf<DailyTitleRow>() }
    val playlists = remember { mutableStateListOf<PlaylistRow>() }
    val playlistTrackIds = remember { mutableStateListOf<String>() }
    var playlistTitle by remember { mutableStateOf("") }
    var selectedPlaylistId by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var playingTrack by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var player by remember { mutableStateOf<MediaPlayer?>(null) }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            val loadedTracks = supabase.postgrest["audio_tracks"].select {
                filter { eq("is_active", true) }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(60)
            }.decodeList<AudioTrackRow>()
            val loadedPlaylists = supabase.postgrest["playlists"].select {
                filter { eq("owner_id", userId) }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            }.decodeList<PlaylistRow>()
            val loadedTitles = supabase.postgrest["daily_titles"].select {
                filter { eq("is_published", true); lte("starts_at", java.time.Instant.now().toString()) }
                order(column = "starts_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(30)
            }.decodeList<DailyTitleRow>()
            tracks.clear(); tracks.addAll(loadedTracks)
            playlists.clear(); playlists.addAll(loadedPlaylists)
            if (selectedPlaylistId == null || playlists.none { it.id == selectedPlaylistId }) selectedPlaylistId = playlists.firstOrNull()?.id
            titles.clear(); titles.addAll(loadedTitles)
            val activePlaylistId = selectedPlaylistId
            val loadedPlaylistTracks = if (activePlaylistId == null) emptyList() else supabase.postgrest["playlist_tracks"].select {
                filter { eq("playlist_id", activePlaylistId) }
                order(column = "position", order = io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            }.decodeList<PlaylistTrackRow>()
            playlistTrackIds.clear()
            playlistTrackIds.addAll(loadedPlaylistTracks.map { it.trackId })
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت رسانه و عنوان‌های روزانه ناموفق بود."
        } finally {
            loading = false
        }
    }

    DisposableEffect(Unit) {
        onDispose { player?.release(); player = null }
    }
    LaunchedEffect(Unit) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("موسیقی و عنوان‌های روزانه", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Text("کتابخانه موسیقی", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            OutlinedTextField(value = playlistTitle, onValueChange = { playlistTitle = it.take(120) }, label = { Text("نام فهرست پخش") }, modifier = Modifier.weight(1f), singleLine = true)
            Button(onClick = {
                val title = playlistTitle.trim()
                if (title.isNotEmpty()) scope.launch {
                    try {
                        supabase.postgrest["playlists"].insert(PlaylistInsertRow(userId, title))
                        playlistTitle = ""
                        refresh()
                    } catch (exception: Exception) { error = exception.message ?: "ساخت فهرست پخش ناموفق بود." }
                }
            }, enabled = playlistTitle.trim().isNotEmpty()) { Text("ساخت") }
        }
        if (playlists.isNotEmpty()) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                playlists.forEach { playlist ->
                    Button(onClick = { selectedPlaylistId = playlist.id; scope.launch { refresh() } }) {
                        Text(if (selectedPlaylistId == playlist.id) "✓ ${playlist.title}" else playlist.title)
                    }
                }
            }
            Text("آهنگ‌های این فهرست: ${playlistTrackIds.size}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (tracks.isEmpty() && !loading) Text("هنوز آهنگی اضافه نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(tracks, key = { it.id }) { track ->
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(track.title, fontWeight = FontWeight.SemiBold)
                            Text(track.artist, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Button(onClick = {
                            if (playingTrack == track.id) {
                                player?.pause()
                                playingTrack = null
                            } else {
                                player?.release()
                                val url = BuildConfig.SUPABASE_URL.trimEnd('/') + "/storage/v1/object/public/post-media/" + track.audioPath
                                player = MediaPlayer().apply {
                                    setOnPreparedListener { start(); playingTrack = track.id }
                                    setOnCompletionListener { playingTrack = null }
                                    setOnErrorListener { _, _, _ -> playingTrack = null; true }
                                    try { setDataSource(url); prepareAsync() } catch (exception: Exception) { error = exception.message }
                                }
                            }
                        }) { Text(if (playingTrack == track.id) "توقف" else "پخش") }
                        if (selectedPlaylistId != null) {
                            Button(
                                enabled = track.id !in playlistTrackIds,
                                onClick = {
                                    scope.launch {
                                        try {
                                            supabase.postgrest["playlist_tracks"].insert(
                                                PlaylistTrackInsertRow(selectedPlaylistId!!, track.id, playlistTrackIds.size)
                                            )
                                            playlistTrackIds.add(track.id)
                                        } catch (exception: Exception) {
                                            error = exception.message ?: "افزودن آهنگ به فهرست ناموفق بود."
                                        }
                                    }
                                }
                            ) { Text(if (track.id in playlistTrackIds) "افزوده شد" else "افزودن به فهرست") }
                        }
                    }
                }
            }
            item { Text("عنوان‌های روزانه و اطلاعیه‌ها", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp)) }
            if (titles.isEmpty() && !loading) item { Text("اطلاعیه‌ای منتشر نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(titles, key = { it.id }) { title ->
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(title.title, fontWeight = FontWeight.Bold)
                        if (title.body.isNotBlank()) Text(title.body)
                        Text(title.category, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}


@Serializable
private data class NotificationRow(
    val id: String,
    val kind: String,
    val payload: JsonObject = JsonObject(emptyMap()),
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
private data class UserNotificationSettingsRow(
    @SerialName("user_id") val userId: String,
    val notifications: JsonObject = JsonObject(emptyMap())
)

@Composable
fun NotificationsScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val rows = remember { mutableStateListOf<NotificationRow>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var pushEnabled by remember { mutableStateOf(true) }
    var emailEnabled by remember { mutableStateOf(false) }
    var savingPreferences by remember { mutableStateOf(false) }

    suspend fun savePreferences(push: Boolean = pushEnabled, email: Boolean = emailEnabled) {
        savingPreferences = true
        error = null
        try {
            val current = supabase.postgrest["user_settings"].select {
                filter { eq("user_id", userId) }
                limit(1)
            }.decodeList<UserNotificationSettingsRow>().firstOrNull()
                ?: throw IllegalStateException("تنظیمات حساب پیدا نشد؛ یک‌بار از حساب خارج و دوباره وارد شوید.")
            val merged = buildJsonObject {
                current.notifications.forEach { (key, value) -> put(key, value) }
                put("push", JsonPrimitive(push))
                put("email", JsonPrimitive(email))
            }
            supabase.postgrest["user_settings"].update({ set("notifications", merged) }) {
                filter { eq("user_id", userId) }
            }
            pushEnabled = push
            emailEnabled = email
        } catch (exception: Exception) {
            error = exception.message ?: "ذخیره تنظیمات اعلان ناموفق بود."
        } finally { savingPreferences = false }
    }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            val preferences = supabase.postgrest["user_settings"].select {
                filter { eq("user_id", userId) }
                limit(1)
            }.decodeList<UserNotificationSettingsRow>().firstOrNull()?.notifications
            pushEnabled = preferences?.get("push")?.jsonPrimitive?.booleanOrNull ?: true
            emailEnabled = preferences?.get("email")?.jsonPrimitive?.booleanOrNull ?: false
            val result = supabase.postgrest["notifications"].select {
                filter { eq("recipient_id", userId) }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(50)
            }.decodeList<NotificationRow>()
            rows.clear()
            rows.addAll(result)
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت اعلان‌ها ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("اعلان‌ها", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { scope.launch { refresh() } }) { Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی") }
        }
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (!loading && rows.isEmpty() && error == null) Text("اعلان تازه‌ای ندارید.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("تنظیمات دریافت اعلان", fontWeight = FontWeight.Bold)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("اعلان‌های فوری")
                                Text("دریافت اعلان‌های درون‌برنامه‌ای و Push", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Switch(checked = pushEnabled, onCheckedChange = { value -> scope.launch { savePreferences(push = value) } }, enabled = !savingPreferences)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("اعلان ایمیلی")
                                Text("ارسال اعلان‌های پشتیبانی‌شده به ایمیل", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Switch(checked = emailEnabled, onCheckedChange = { value -> scope.launch { savePreferences(email = value) } }, enabled = !savingPreferences)
                        }
                        if (savingPreferences) Text("در حال ذخیره تنظیمات…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
            items(rows, key = { it.id }) { item ->
                val title = when (item.kind) {
                    "chat_message" -> "پیام جدید"
                    "admin_warning" -> "اخطار مدیریتی"
                    "admin_ban" -> "محدودیت حساب"
                    "admin_unban" -> "رفع محدودیت"
                    "scheduled_announcement" -> item.payload["title"]?.jsonPrimitive?.contentOrNull ?: "اعلان زمان‌بندی‌شده"
                    "join_request_approved" -> "پذیرش درخواست عضویت"
                    "join_request_rejected" -> "رد درخواست عضویت"
                    "group_join_request" -> "درخواست عضویت جدید"
                    "mission_completed" -> item.payload["title"]?.jsonPrimitive?.contentOrNull ?: "تکمیل مأموریت"
                    "event_reward" -> item.payload["title"]?.jsonPrimitive?.contentOrNull ?: "جایزه رویداد"
                    else -> item.kind
                }
                val message = item.payload["message"]?.jsonPrimitive?.contentOrNull
                    ?: item.payload["body"]?.jsonPrimitive?.contentOrNull
                    ?: "یک رویداد جدید برای حساب شما ثبت شده است."
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(title, fontWeight = FontWeight.Bold)
                        Text(message, style = MaterialTheme.typography.bodyMedium)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(item.createdAt, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (item.readAt == null) Button(onClick = {
                                scope.launch {
                                    try {
                                        supabase.postgrest["notifications"].update({ set("read_at", java.time.Instant.now().toString()) }) {
                                            filter { eq("id", item.id); eq("recipient_id", userId) }
                                        }
                                        refresh()
                                    } catch (exception: Exception) { error = exception.message ?: "علامت‌گذاری اعلان ناموفق بود." }
                                }
                            }) { Text("خوانده شد") }
                        }
                    }
                }
            }
        }
    }
}


@Serializable
private data class CommunityRow(
    @SerialName("conversation_id") val conversationId: String,
    val title: String,
    val description: String,
    val kind: String,
    val username: String? = null,
    @SerialName("join_approval_required") val joinApprovalRequired: Boolean,
    @SerialName("member_count") val memberCount: Long
)

@Serializable
private data class CommunityConversationInsert(
    val kind: String,
    val title: String,
    @SerialName("created_by") val createdBy: String
)

@Serializable
private data class CommunityConversationIdRow(val id: String)

@Serializable
private data class CommunityOwnerMemberInsert(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("user_id") val userId: String,
    @SerialName("member_role") val memberRole: String = "owner"
)

@Serializable
private data class GroupSpaceInsert(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("owner_id") val ownerId: String,
    val description: String,
    @SerialName("join_approval_required") val joinApprovalRequired: Boolean
)

@Serializable
private data class ChannelSpaceInsert(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("owner_id") val ownerId: String,
    val description: String,
    val visibility: String = "public"
)

@Serializable
private data class JoinCommunityArgs(
    @SerialName("p_conversation_id") val conversationId: String
)

@Serializable
private data class CommunityMemberRow(
    @SerialName("conversation_id") val conversationId: String
)

@Serializable
private data class CommunityRequestRow(
    @SerialName("conversation_id") val conversationId: String
)

@Serializable
private data class CommunityJoinRequestRow(
    val id: String,
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("requester_id") val requesterId: String,
    @SerialName("requested_at") val requestedAt: String
)

@Composable
fun CommunitiesScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val communities = remember { mutableStateListOf<CommunityRow>() }
    val pendingRequests = remember { mutableStateListOf<CommunityJoinRequestRow>() }
    val members = remember { mutableStateOf<Set<String>>(emptySet()) }
    val pending = remember { mutableStateOf<Set<String>>(emptySet()) }
    var loading by remember { mutableStateOf(true) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var communityQuery by remember { mutableStateOf("") }
    var communityFilter by remember { mutableStateOf("all") }
    var showCreateSpace by remember { mutableStateOf(false) }
    var createSpaceType by remember { mutableStateOf("group") }
    var createSpaceTitle by remember { mutableStateOf("") }
    var createSpaceDescription by remember { mutableStateOf("") }
    var createSpaceApproval by remember { mutableStateOf(false) }
    var creatingSpace by remember { mutableStateOf(false) }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            val found = supabase.postgrest.rpc("discover_communities").decodeList<CommunityRow>()
            val myMembers = supabase.postgrest["conversation_members"].select {
                filter { eq("user_id", userId) }
            }.decodeList<CommunityMemberRow>()
            val myRequests = supabase.postgrest["conversation_join_requests"].select {
                filter { eq("requester_id", userId); eq("status", "pending") }
            }.decodeList<CommunityRequestRow>()
            val managerRequests = supabase.postgrest["conversation_join_requests"].select {
                filter { eq("status", "pending") }
                order(column = "requested_at", order = io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                limit(40)
            }.decodeList<CommunityJoinRequestRow>().filter { it.requesterId != userId }
            communities.clear()
            communities.addAll(found)
            pendingRequests.clear()
            pendingRequests.addAll(managerRequests)
            members.value = myMembers.map { it.conversationId }.toSet()
            pending.value = myRequests.map { it.conversationId }.toSet()
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت گروه‌ها و کانال‌ها ناموفق بود."
        } finally {
            loading = false
        }
    }


    suspend fun createCommunitySpace() {
        val title = createSpaceTitle.trim()
        val description = createSpaceDescription.trim()
        if (title.length !in 3..60 || description.length > 500) {
            error = "نام باید ۳ تا ۶۰ نویسه و توضیحات حداکثر ۵۰۰ نویسه باشد."
            return
        }
        creatingSpace = true
        error = null
        var createdConversationId: String? = null
        try {
            OperationProgressController.run(if (createSpaceType == "group") "ساخت گروه جدید" else "ساخت کانال عمومی") { progress ->
                progress.advance(14, "اعتبارسنجی نام، توضیحات و نوع فضا")
                val conversation = supabase.postgrest["conversations"].insert(
                    CommunityConversationInsert(createSpaceType, title, userId)
                ) { select() }.decodeList<CommunityConversationIdRow>().single()
                createdConversationId = conversation.id
                progress.advance(40, "ساخت فضای گفتگو در سرور")
                supabase.postgrest["conversation_members"].insert(
                    CommunityOwnerMemberInsert(conversation.id, userId)
                )
                progress.advance(64, "ثبت مالک و دسترسی سازنده")
                if (createSpaceType == "group") {
                    supabase.postgrest["group_spaces"].insert(
                        GroupSpaceInsert(conversation.id, userId, description, createSpaceApproval)
                    )
                } else {
                    supabase.postgrest["channel_spaces"].insert(
                        ChannelSpaceInsert(conversation.id, userId, description)
                    )
                }
                progress.advance(92, "تنظیمات و عضویت مالک ثبت شد")
            }
            showCreateSpace = false
            createSpaceTitle = ""
            createSpaceDescription = ""
            createSpaceApproval = false
            refresh()
        } catch (exception: Exception) {
            createdConversationId?.let { conversationId ->
                runCatching {
                    supabase.postgrest["conversations"].delete {
                        filter { eq("id", conversationId); eq("created_by", userId) }
                    }
                }
            }
            error = exception.message ?: "ساخت گروه یا کانال ناموفق بود."
        } finally {
            creatingSpace = false
        }
    }

    LaunchedEffect(userId) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("گروه‌ها و کانال‌ها", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { scope.launch { refresh() } }) { Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی") }
        }
        Text("فضاهای موردعلاقه‌ات را پیدا کن و به جامعه‌های کاوه بپیوند.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        Button(
            onClick = { showCreateSpace = !showCreateSpace },
            enabled = !creatingSpace,
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (showCreateSpace) "بستن فرم ساخت فضا" else "ساخت گروه یا کانال جدید") }
        if (showCreateSpace) {
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("ساخت فضای اجتماعی", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (createSpaceType == "group") Button(onClick = { createSpaceType = "group" }, enabled = !creatingSpace) { Text("گروه") }
                        else OutlinedButton(onClick = { createSpaceType = "group" }, enabled = !creatingSpace) { Text("گروه") }
                        if (createSpaceType == "channel") Button(onClick = { createSpaceType = "channel" }, enabled = !creatingSpace) { Text("کانال عمومی") }
                        else OutlinedButton(onClick = { createSpaceType = "channel" }, enabled = !creatingSpace) { Text("کانال عمومی") }
                    }
                    OutlinedTextField(
                        value = createSpaceTitle,
                        onValueChange = { createSpaceTitle = it.take(60) },
                        label = { Text(if (createSpaceType == "group") "نام گروه" else "نام کانال") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !creatingSpace
                    )
                    OutlinedTextField(
                        value = createSpaceDescription,
                        onValueChange = { createSpaceDescription = it.take(500) },
                        label = { Text("توضیحات (اختیاری)") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                        enabled = !creatingSpace
                    )
                    if (createSpaceType == "group") {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Checkbox(checked = createSpaceApproval, onCheckedChange = { createSpaceApproval = it }, enabled = !creatingSpace)
                            Text("عضویت با تأیید مدیر")
                        }
                    }
                    Button(
                        onClick = { scope.launch { createCommunitySpace() } },
                        enabled = !creatingSpace && createSpaceTitle.trim().length in 3..60,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (creatingSpace) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                        else Text(if (createSpaceType == "group") "ساخت گروه" else "ساخت کانال")
                    }
                }
            }
        }
        OutlinedTextField(
            value = communityQuery,
            onValueChange = { communityQuery = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("جست‌وجوی نام یا موضوع اجتماع") }
        )
        Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("all" to "همه", "group" to "گروه‌ها", "channel" to "کانال‌ها", "joined" to "عضویت‌های من").forEach { (key, label) ->
                if (communityFilter == key) {
                    Button(onClick = { communityFilter = key }) { Text(label) }
                } else {
                    OutlinedButton(onClick = { communityFilter = key }) { Text(label) }
                }
            }
        }
        val visibleCommunities = communities.filter { community ->
            val matchesQuery = (community.title + " " + community.description + " " + (community.username ?: "")).contains(communityQuery.trim(), ignoreCase = true)
            val isMember = community.conversationId in members.value
            val isPending = community.conversationId in pending.value
            val matchesFilter = when (communityFilter) {
                "group" -> community.kind == "group"
                "channel" -> community.kind == "channel"
                "joined" -> isMember || isPending
                else -> true
            }
            matchesQuery && matchesFilter
        }
        if (pendingRequests.isNotEmpty()) {
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("درخواست‌های عضویت برای فضاهای تحت مدیریت", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    pendingRequests.forEach { request ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text("درخواست عضویت جدید", fontWeight = FontWeight.SemiBold)
                                Text("شناسه کاربر: ${request.requesterId.take(8)}…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            OutlinedButton(enabled = busyId != request.id, onClick = {
                                scope.launch {
                                    busyId = request.id
                                    try {
                                        OperationProgressController.run("تأیید درخواست عضویت") { progress ->
                                            progress.advance(24, "بررسی مجوز مدیر و وضعیت درخواست")
                                            supabase.postgrest["conversation_join_requests"].update({
                                                set("status", "approved")
                                                set("reviewed_at", java.time.Instant.now().toString())
                                                set("reviewed_by", userId)
                                            }) { filter { eq("id", request.id); eq("status", "pending") } }
                                            progress.advance(90, "عضویت کاربر در سرور تأیید شد")
                                        }
                                        pendingRequests.removeAll { it.id == request.id }
                                        refresh()
                                    } catch (exception: Exception) { error = exception.message ?: "تأیید درخواست ناموفق بود." }
                                    finally { busyId = null }
                                }
                            }) { Text("تأیید") }
                            TextButton(enabled = busyId != request.id, onClick = {
                                scope.launch {
                                    busyId = request.id
                                    try {
                                        OperationProgressController.run("رد درخواست عضویت") { progress ->
                                            progress.advance(24, "بررسی مجوز مدیر و وضعیت درخواست")
                                            supabase.postgrest["conversation_join_requests"].update({
                                                set("status", "rejected")
                                                set("reviewed_at", java.time.Instant.now().toString())
                                                set("reviewed_by", userId)
                                            }) { filter { eq("id", request.id); eq("status", "pending") } }
                                            progress.advance(90, "رد درخواست در سرور ثبت شد")
                                        }
                                        pendingRequests.removeAll { it.id == request.id }
                                    } catch (exception: Exception) { error = exception.message ?: "رد درخواست ناموفق بود." }
                                    finally { busyId = null }
                                }
                            }) { Text("رد") }
                        }
                    }
                }
            }
        }
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (!loading && communities.isEmpty() && error == null) Text("هنوز گروه یا کانال عمومی‌ای ساخته نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (!loading && communities.isNotEmpty() && visibleCommunities.isEmpty()) Text("اجتماعی با این جست‌وجو یا فیلتر پیدا نشد.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("${visibleCommunities.size} اجتماع", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(visibleCommunities, key = { it.conversationId }) { community ->
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(community.title, fontWeight = FontWeight.Bold)
                        Text(if (community.kind == "channel") "کانال" else "گروه", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                        if (community.description.isNotBlank()) Text(community.description)
                        Text("${community.memberCount} عضو", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        when {
                            community.conversationId in members.value -> Text("عضو هستید", color = MaterialTheme.colorScheme.primary)
                            community.conversationId in pending.value -> Text("درخواست عضویت ارسال شده است.", color = MaterialTheme.colorScheme.secondary)
                            else -> Button(enabled = busyId != community.conversationId, onClick = {
                                scope.launch {
                                    busyId = community.conversationId
                                    try {
                                        val result = OperationProgressController.run("پیوستن به اجتماع",) { progress ->
                                            progress.advance(20, "بررسی وضعیت عضویت و دسترسی اجتماع")
                                            progress.advance(48, "ارسال درخواست عضویت به سرور")
                                            val response = supabase.postgrest.rpc("join_community", JoinCommunityArgs(community.conversationId)).decodeAs<String>()
                                            progress.advance(90, if (response == "pending") "درخواست عضویت برای مدیر ثبت شد" else "عضویت توسط سرور ثبت شد")
                                            response
                                        }
                                        if (result == "pending") pending.value = pending.value + community.conversationId
                                        else members.value = members.value + community.conversationId
                                    } catch (exception: Exception) {
                                        error = exception.message ?: "عضویت ناموفق بود."
                                    } finally { busyId = null }
                                }
                            }) { Text(if (busyId == community.conversationId) "در حال ارسال…" else if (community.joinApprovalRequired) "درخواست عضویت" else "پیوستن") }
                        }
                    }
                }
            }
        }
    }
}


private const val MAX_SOCIAL_ATTACHMENT_BYTES = 50_000_000L

private fun contentDisplayName(context: Context, uri: Uri, fallback: String): String {
    return runCatching {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (cursor.moveToFirst() && index >= 0) cursor.getString(index)?.take(180) else null
        }
    }.getOrNull()?.takeIf { it.isNotBlank() } ?: fallback
}

private fun copyUriToBoundedCacheFile(context: Context, uri: Uri, mimeType: String): File {
    val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "bin"
    val tempFile = File.createTempFile("kaveh-post-", ".$extension", context.cacheDir)
    try {
        val input = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("خواندن فایل انتخاب‌شده ممکن نیست.")
        input.use { source ->
            tempFile.outputStream().buffered().use { destination ->
                val buffer = ByteArray(64 * 1024)
                var totalBytes = 0L
                while (true) {
                    val count = source.read(buffer)
                    if (count < 0) break
                    totalBytes += count
                    require(totalBytes <= MAX_SOCIAL_ATTACHMENT_BYTES) {
                        "حجم هر فایل نباید بیشتر از ۵۰ مگابایت باشد."
                    }
                    destination.write(buffer, 0, count)
                }
            }
        }
        require(tempFile.length() > 0L) { "فایل انتخاب‌شده خالی است." }
        return tempFile
    } catch (exception: Exception) {
        tempFile.delete()
        throw exception
    }
}

@Serializable
private data class SocialPostInsert(
    val id: String,
    @SerialName("author_id") val authorId: String,
    val body: String,
    val visibility: String,
    @SerialName("comments_enabled") val commentsEnabled: Boolean = true,
    @SerialName("published_at") val publishedAt: String
)

@Serializable
private data class SocialPostAttachmentInsert(
    @SerialName("post_id") val postId: String,
    @SerialName("author_id") val authorId: String,
    @SerialName("bucket_id") val bucketId: String,
    @SerialName("object_path") val objectPath: String,
    @SerialName("original_name") val originalName: String,
    @SerialName("mime_type") val mimeType: String,
    @SerialName("byte_size") val byteSize: Long
)

@Composable
fun PublishPostScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    var body by remember { mutableStateOf("") }
    var selectedMedia by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var publishing by remember { mutableStateOf(false) }
    var uploadProgress by remember { mutableStateOf<Float?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val mediaPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { selected ->
        val combined = (selectedMedia + selected).distinct()
        if (combined.size > 4) message = "حداکثر ۴ فایل می‌توانی پیوست کنی."
        selectedMedia = combined.take(4)
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("CREATE · SHARE · CONNECT", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Text("یک اتفاق تازه منتشر کن", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("فکرها، تجربه‌ها و خبرهایت را با جامعه کاوه به اشتراک بگذار.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(26.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)) {
                        Text("✦", modifier = Modifier.padding(horizontal = 13.dp, vertical = 9.dp), color = MaterialTheme.colorScheme.primary)
                    }
                    Column {
                        Text("پست جدید", fontWeight = FontWeight.Bold)
                        Text("حداکثر ۵۰۰۰ نویسه", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                OutlinedTextField(
                    value = body,
                    onValueChange = { if (it.length <= 5000) { body = it; message = null } },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 7,
                    maxLines = 12,
                    placeholder = { Text("چه چیزی در ذهن داری؟") },
                    supportingText = { Text("${body.length} / 5000") }
                )
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)) {
                    Text("انتشار عمومی", modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                }
                OutlinedButton(onClick = { mediaPicker.launch(arrayOf("image/*", "video/*")) }, enabled = !publishing && selectedMedia.size < 4, modifier = Modifier.fillMaxWidth()) {
                    Text("افزودن عکس یا ویدئو · ${selectedMedia.size}/4")
                }
                selectedMedia.forEachIndexed { index, uri ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(context.contentResolver.getType(uri) ?: "رسانه ${index + 1}", style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { selectedMedia = selectedMedia.filterIndexed { itemIndex, _ -> itemIndex != index } }, enabled = !publishing) { Text("حذف") }
                    }
                }
                if (publishing && uploadProgress != null) {
                    Text("پیشرفت بارگذاری رسانه: ${(uploadProgress!! * 100).toInt()}٪", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
                if (message != null) {
                    Text(message!!, color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                }
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !publishing && (body.isNotBlank() || selectedMedia.isNotEmpty()),
                    onClick = {
                        scope.launch {
                            publishing = true
                            message = null
                            failed = false
                            val postId = UUID.randomUUID().toString()
                            val uploadedPaths = mutableListOf<String>()
                            var postCreated = false
                            try {
                                OperationProgressController.run("انتشار پست و رسانه‌ها") { progress ->
                                progress.advance(12, "اعتبارسنجی متن و رسانه‌های انتخاب‌شده")
                                require(body.isNotBlank() || selectedMedia.isNotEmpty()) { "متن یا رسانه‌ای برای انتشار انتخاب کن." }
                                progress.advance(28, "ثبت پست اولیه در سرور")
                                supabase.postgrest["posts"].insert(
                                    SocialPostInsert(
                                        id = postId,
                                        authorId = userId,
                                        body = body.trim(),
                                        visibility = "public",
                                        publishedAt = java.time.Instant.now().toString()
                                    )
                                )
                                postCreated = true
                                progress.advance(38, "پست ثبت شد؛ آماده‌سازی پیوست‌ها")
                                selectedMedia.forEachIndexed { index, uri ->
                                    val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
                                    require(mime.startsWith("image/") || mime.startsWith("video/")) { "فقط عکس و ویدئو قابل پیوست است." }
                                    val tempFile = copyUriToBoundedCacheFile(context, uri, mime)
                                    try {
                                        val path = "$userId/$postId/${UUID.randomUUID()}"
                                        val resumableUpload = supabase.storage["post-media"].resumable.createOrContinueUpload(
                                            channel = { offset ->
                                                val input = tempFile.inputStream()
                                                var remaining = offset
                                                while (remaining > 0L) {
                                                    val skipped = input.skip(remaining)
                                                    if (skipped > 0L) {
                                                        remaining -= skipped
                                                    } else {
                                                        if (input.read() < 0) break
                                                        remaining -= 1L
                                                    }
                                                }
                                                input.toByteReadChannel()
                                            },
                                            source = uri.toString(),
                                            size = tempFile.length(),
                                            path = path
                                        ) {
                                            contentType = ContentType.parse(mime)
                                        }
                                        val progressMonitor = scope.launch {
                                            resumableUpload.stateFlow.collect { state ->
                                                uploadProgress = state.progress
                                                val mediaPercent = (state.progress.toDouble() * 100).toInt().coerceIn(0, 100)
                                                val overall = 40 + (((index + state.progress.toDouble()) / selectedMedia.size.coerceAtLeast(1)) * 48).toInt()
                                                progress.advance(overall, "انتقال رسانه ${index + 1} از ${selectedMedia.size} · ${mediaPercent.toPersianProgressDigits()}٪")
                                            }
                                        }
                                        try {
                                            resumableUpload.startOrResumeUploading()
                                        } finally {
                                            progressMonitor.cancel()
                                        }
                                        uploadedPaths.add(path)
                                        val displayName = contentDisplayName(context, uri, "media-${index + 1}")
                                        progress.advance(91, "رسانه منتقل شد؛ ثبت مشخصات پیوست")
                                        supabase.postgrest["post_attachments"].insert(
                                            SocialPostAttachmentInsert(postId, userId, "post-media", path, displayName, mime, tempFile.length())
                                        )
                                    } finally {
                                        tempFile.delete()
                                    }
                                }
                                body = ""
                                selectedMedia = emptyList()
                                uploadProgress = null
                                progress.advance(97, "پست و تمام رسانه‌ها با موفقیت منتشر شدند")
                                message = "پست و رسانه‌های پیوست‌شده با موفقیت منتشر شدند."
                                }
                            } catch (exception: Exception) {
                                var cleanupFailed = false
                                if (uploadedPaths.isNotEmpty()) {
                                    try {
                                        supabase.storage["post-media"].delete(*uploadedPaths.toTypedArray())
                                    } catch (_: Exception) {
                                        cleanupFailed = true
                                    }
                                }
                                if (postCreated) {
                                    try {
                                        supabase.postgrest["posts"].delete {
                                            filter { eq("id", postId); eq("author_id", userId) }
                                        }
                                    } catch (_: Exception) {
                                        cleanupFailed = true
                                    }
                                }
                                failed = true
                                uploadProgress = null
                                val baseMessage = exception.message ?: "انتشار پست انجام نشد. دوباره تلاش کن."
                                message = if (cleanupFailed) {
                                    "$baseMessage پاک‌سازی خودکار کامل نشد؛ لطفاً این عملیات را دوباره بررسی کن."
                                } else baseMessage
                            } finally {
                                publishing = false
                            }
                        }
                    }
                ) {
                    if (publishing) CircularProgressIndicator(modifier = Modifier.width(18.dp), strokeWidth = 2.dp)
                    else Text("انتشار در کاوه")
                }
            }
        }
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.45f))
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("یادآوری حریم خصوصی", fontWeight = FontWeight.SemiBold)
                Text("این نسخه پست را به‌صورت عمومی منتشر می‌کند؛ محتوا می‌تواند در اکتشاف و فید جامعه نمایش داده شود.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}


private fun Int.toPersianProgressDigits(): String =
    toString().map { digit ->
        if (digit in '0'..'9') ('۰'.code + (digit - '0')).toChar() else digit
    }.joinToString("")
