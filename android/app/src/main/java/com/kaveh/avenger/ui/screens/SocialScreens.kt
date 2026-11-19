package com.kaveh.avenger.ui.screens

import android.net.Uri
import android.media.MediaPlayer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.layout.height
import com.kaveh.avenger.BuildConfig

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
import androidx.compose.runtime.DisposableEffect
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
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import java.util.UUID
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

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


@Serializable
private data class ReelRow(
    val id: String,
    @SerialName("author_id") val authorId: String,
    val caption: String,
    @SerialName("video_path") val videoPath: String,
    @SerialName("views_count") val viewsCount: Long = 0,
    @SerialName("published_at") val publishedAt: String
)

@Serializable
private data class ReelInsertRow(
    @SerialName("author_id") val authorId: String,
    val caption: String,
    @SerialName("video_path") val videoPath: String,
    @SerialName("mime_type") val mimeType: String,
    val visibility: String = "public"
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

private data class ReelCardState(
    val reel: ReelRow,
    val author: String,
    val likeCount: Int,
    val likedByMe: Boolean
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
            val names = profiles.associate { it.id to (it.displayName.ifBlank { it.username ?: "کاربر" }) }
            val byReel = reactions.groupBy { it.reelId }
            cards.clear()
            cards.addAll(reels.map { reel ->
                val list = byReel[reel.id].orEmpty()
                ReelCardState(reel, names[reel.authorId] ?: "کاربر کاوه", list.size, list.any { it.userId == userId })
            })
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت ریلز ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        OutlinedTextField(value = caption, onValueChange = { caption = it.take(2200) }, label = { Text("توضیح ریلز") }, modifier = Modifier.fillMaxWidth(), maxLines = 3)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { videoPicker.launch("video/*") }, enabled = !uploading) { Text(if (selectedVideo == null) "انتخاب ویدئو" else "تغییر ویدئو") }
            Button(onClick = {
                val uri = selectedVideo ?: return@Button
                scope.launch {
                    uploading = true
                    error = null
                    try {
                        val mime = context.contentResolver.getType(uri) ?: "video/mp4"
                        require(mime.startsWith("video/")) { "فایل انتخاب‌شده ویدئو نیست." }
                        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                            ?: throw IllegalStateException("خواندن ویدئو ناموفق بود.")
                        require(bytes.size <= 50_000_000) { "حداکثر حجم ویدئو ۵۰ مگابایت است." }
                        val path = "$userId/reels/${UUID.randomUUID()}"
                        supabase.storage.from("post-media").upload(path, bytes) {
                            contentType = ContentType.parse(mime)
                            upsert = false
                        }
                        supabase.postgrest["reels"].insert(ReelInsertRow(userId, caption.trim(), path, mime))
                        selectedVideo = null
                        caption = ""
                        refresh()
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
                        if (card.reel.caption.isNotBlank()) Text(card.reel.caption)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${card.reel.viewsCount} بازدید", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("${card.likeCount} پسند", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
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

@Composable
fun NotificationsScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val rows = remember { mutableStateListOf<NotificationRow>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        loading = true
        error = null
        try {
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

@Composable
fun CommunitiesScreen(supabase: SupabaseClient, userId: String) {
    val scope = rememberCoroutineScope()
    val communities = remember { mutableStateListOf<CommunityRow>() }
    val members = remember { mutableStateOf<Set<String>>(emptySet()) }
    val pending = remember { mutableStateOf<Set<String>>(emptySet()) }
    var loading by remember { mutableStateOf(true) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

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
            communities.clear()
            communities.addAll(found)
            members.value = myMembers.map { it.conversationId }.toSet()
            pending.value = myRequests.map { it.conversationId }.toSet()
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت گروه‌ها و کانال‌ها ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("گروه‌ها و کانال‌ها", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { scope.launch { refresh() } }) { Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی") }
        }
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (!loading && communities.isEmpty() && error == null) Text("هنوز گروه یا کانال عمومی‌ای ساخته نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(communities, key = { it.conversationId }) { community ->
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
                                        val result = supabase.postgrest.rpc("join_community", JoinCommunityArgs(community.conversationId)).decodeAs<String>()
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
