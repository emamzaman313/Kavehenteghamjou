package com.kaveh.avenger.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Send
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
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.rpc
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.storage.storage
import com.kaveh.avenger.files.FileUploadRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Serializable
private data class ConversationMemberRow(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("user_id") val userId: String = "",
    @SerialName("last_read_at") val lastReadAt: String? = null
)

@Serializable
private data class ConversationRow(
    val id: String,
    val kind: String,
    val title: String? = null,
    @SerialName("created_by") val createdBy: String,
    @SerialName("last_message_at") val lastMessageAt: String? = null
)

@Serializable
private data class MessageRow(
    val id: String,
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("sender_id") val senderId: String,
    val body: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
private data class MessageInsert(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("sender_id") val senderId: String,
    val body: String,
    val format: String = "plain"
)

@Serializable
private data class MessageIdRow(val id: String)

@Serializable
private data class MessageAttachmentRow(
    @SerialName("message_id") val messageId: String,
    @SerialName("file_asset_id") val fileAssetId: String,
    @SerialName("display_order") val displayOrder: Int = 0
)

@Serializable
private data class MessageAttachmentInsert(
    @SerialName("message_id") val messageId: String,
    @SerialName("file_asset_id") val fileAssetId: String,
    @SerialName("display_order") val displayOrder: Int = 0
)

@Serializable
private data class FileAssetRow(
    val id: String,
    @SerialName("bucket_id") val bucketId: String,
    @SerialName("object_path") val objectPath: String,
    @SerialName("original_name") val originalName: String,
    @SerialName("mime_type") val mimeType: String? = null,
    @SerialName("byte_size") val byteSize: Long
)

@Serializable
private data class ProfileRow(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null
)

@Serializable
private data class DirectConversationParams(
    @SerialName("p_other_user_id") val otherUserId: String
)

private data class ChatConversation(
    val id: String,
    val title: String,
    val kind: String,
    val lastMessageAt: String?,
    val peerReadAt: String?
)

@Composable
fun ChatScreen(
    supabase: SupabaseClient,
    userId: String,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val conversations = remember { mutableStateListOf<ChatConversation>() }
    val messages = remember { mutableStateListOf<MessageRow>() }
    var activeConversation by remember { mutableStateOf<ChatConversation?>(null) }
    var draft by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var realtimeConnected by remember { mutableStateOf(false) }
    var hasOlderMessages by remember { mutableStateOf(false) }
    var loadingOlderMessages by remember { mutableStateOf(false) }
    var showNewConversation by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    val searchResults = remember { mutableStateListOf<ProfileRow>() }
    var searchingPeople by remember { mutableStateOf(false) }
    var creatingConversationFor by remember { mutableStateOf<String?>(null) }
    var uploadingAttachment by remember { mutableStateOf(false) }
    var downloadingFilePath by remember { mutableStateOf<String?>(null) }
    var pendingDownloadBytes by remember { mutableStateOf<ByteArray?>(null) }
    val attachmentsByMessage = remember { mutableStateMapOf<String, List<FileAssetRow>>() }

    suspend fun loadConversations() {
        loading = true
        errorText = null
        try {
            val memberships = supabase.postgrest["conversation_members"].select {
                filter { eq("user_id", userId) }
            }.decodeList<ConversationMemberRow>()

            val loaded = memberships.mapNotNull { membership ->
                val conversation = supabase.postgrest["conversations"].select {
                    filter { eq("id", membership.conversationId) }
                }.decodeList<ConversationRow>().firstOrNull() ?: return@mapNotNull null

                val otherMember = supabase.postgrest["conversation_members"].select {
                    filter { eq("conversation_id", conversation.id) }
                }.decodeList<ConversationMemberRow>().firstOrNull { it.userId != userId }

                val profile = otherMember?.let { member ->
                    supabase.postgrest["profiles"].select {
                        filter { eq("id", member.userId) }
                    }.decodeList<ProfileRow>().firstOrNull()
                }

                ChatConversation(
                    id = conversation.id,
                    title = conversation.title ?: profile?.displayName ?: profile?.username?.let { "@$it" }
                        ?: if (conversation.kind == "direct") "گفتگوی خصوصی" else "گفتگو",
                    kind = conversation.kind,
                    lastMessageAt = conversation.lastMessageAt,
                    peerReadAt = otherMember?.lastReadAt
                )
            }.sortedByDescending { it.lastMessageAt ?: "" }

            conversations.clear()
            conversations.addAll(loaded)
            activeConversation = activeConversation?.let { active ->
                loaded.firstOrNull { it.id == active.id } ?: active
            }
        } catch (exception: Exception) {
            errorText = exception.message ?: "دریافت گفتگوها ناموفق بود."
        } finally {
            loading = false
        }
    }

    suspend fun searchPeople(query: String) {
        val term = query.trim().removePrefix("@")
        if (term.length < 2) {
            searchResults.clear()
            return
        }
        searchingPeople = true
        try {
            val safeTerm = term.replace("%", "\\%").replace("_", "\\_")
            val found = supabase.postgrest["profiles"].select {
                filter {
                    neq("id", userId)
                    or {
                        ilike("username", "%$safeTerm%")
                        ilike("display_name", "%$safeTerm%")
                    }
                }
                limit(12)
            }.decodeList<ProfileRow>()
            searchResults.clear()
            searchResults.addAll(found)
        } catch (exception: Exception) {
            errorText = exception.message ?: "جست‌وجوی کاربران ناموفق بود."
        } finally {
            searchingPeople = false
        }
    }

    suspend fun startDirectConversation(profile: ProfileRow) {
        creatingConversationFor = profile.id
        errorText = null
        try {
            val conversationId = supabase.postgrest.rpc(
                "create_direct_conversation",
                DirectConversationParams(profile.id)
            ).decodeAs<String>()
            loadConversations()
            activeConversation = conversations.firstOrNull { it.id == conversationId }
                ?: ChatConversation(
                    id = conversationId,
                    title = profile.displayName.ifBlank { profile.username?.let { "@$it" } ?: "گفتگوی خصوصی" },
                    kind = "direct",
                    lastMessageAt = null,
                    peerReadAt = null
                )
            showNewConversation = false
            searchQuery = ""
            searchResults.clear()
        } catch (exception: Exception) {
            errorText = exception.message ?: "ساخت گفتگوی خصوصی ناموفق بود."
        } finally {
            creatingConversationFor = null
        }
    }

    suspend fun loadMessages(conversationId: String) {
        try {
            val loaded = supabase.postgrest["messages"].select {
                filter {
                    eq("conversation_id", conversationId)
                    exact("deleted_at", null)
                }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(count = 100)
            }.decodeList<MessageRow>().reversed()

            messages.clear()
            messages.addAll(loaded)
            hasOlderMessages = loaded.size == 100
            attachmentsByMessage.clear()
            if (loaded.isNotEmpty()) {
                val attachmentRows = supabase.postgrest["message_attachments"].select {
                    filter { isIn("message_id", loaded.map { it.id }) }
                }.decodeList<MessageAttachmentRow>()
                val fileIds = attachmentRows.map { it.fileAssetId }.distinct()
                if (fileIds.isNotEmpty()) {
                    val fileRows = supabase.postgrest["file_assets"].select {
                        filter { isIn("id", fileIds) }
                    }.decodeList<FileAssetRow>()
                    val filesById = fileRows.associateBy { it.id }
                    attachmentRows.groupBy { it.messageId }.forEach { (messageId, rows) ->
                        attachmentsByMessage[messageId] = rows.mapNotNull { filesById[it.fileAssetId] }
                    }
                }
            }

            // Advance the read cursor only through the latest message actually
            // fetched from the server; do not use the device clock.
            loaded.lastOrNull()?.createdAt?.let { latestFetchedAt ->
                supabase.postgrest["conversation_members"].update({
                    set("last_read_at", latestFetchedAt)
                }) {
                    filter {
                        eq("conversation_id", conversationId)
                        eq("user_id", userId)
                    }
                }
            }
        } catch (exception: Exception) {
            errorText = exception.message ?: "دریافت پیام‌ها ناموفق بود."
        }
    }

    suspend fun loadOlderMessages(conversationId: String) {
        val oldest = messages.firstOrNull()?.createdAt ?: return
        if (!hasOlderMessages || loadingOlderMessages) return
        loadingOlderMessages = true
        try {
            val older = supabase.postgrest["messages"].select {
                filter {
                    eq("conversation_id", conversationId)
                    exact("deleted_at", null)
                    lt("created_at", oldest)
                }
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(count = 100)
            }.decodeList<MessageRow>().reversed()
            val existingIds = messages.map { it.id }.toSet()
            val uniqueOlder = older.filterNot { it.id in existingIds }
            messages.addAll(0, uniqueOlder)
            if (uniqueOlder.isNotEmpty()) {
                val attachmentRows = supabase.postgrest["message_attachments"].select {
                    filter { isIn("message_id", uniqueOlder.map { it.id }) }
                }.decodeList<MessageAttachmentRow>()
                val fileIds = attachmentRows.map { it.fileAssetId }.distinct()
                if (fileIds.isNotEmpty()) {
                    val fileRows = supabase.postgrest["file_assets"].select {
                        filter { isIn("id", fileIds) }
                    }.decodeList<FileAssetRow>()
                    val filesById = fileRows.associateBy { it.id }
                    attachmentRows.groupBy { it.messageId }.forEach { (messageId, rows) ->
                        attachmentsByMessage[messageId] = rows.mapNotNull { filesById[it.fileAssetId] }
                    }
                }
            }
            hasOlderMessages = older.size == 100
        } catch (exception: Exception) {
            errorText = exception.message ?: "بارگذاری پیام‌های قدیمی ناموفق بود."
        } finally {
            loadingOlderMessages = false
        }
    }

    suspend fun uploadAttachment(uri: Uri) {
        val conversationId = activeConversation?.id ?: return
        uploadingAttachment = true
        errorText = null
        try {
            val uploaded = FileUploadRepository(supabase).upload(context, userId, uri)
            val message = supabase.postgrest.from("messages").insert(
                MessageInsert(
                    conversationId = conversationId,
                    senderId = userId,
                    body = "📎 ${uploaded.originalName}"
                )
            ) {
                select()
            }.decodeList<MessageIdRow>().single()
            supabase.postgrest.from("message_attachments").insert(
                MessageAttachmentInsert(
                    messageId = message.id,
                    fileAssetId = uploaded.fileAssetId
                )
            )
            loadMessages(conversationId)
            loadConversations()
        } catch (exception: Exception) {
            errorText = exception.message ?: "ارسال فایل ناموفق بود."
        } finally {
            uploadingAttachment = false
        }
    }

    val saveFileLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("*/*")
    ) { uri ->
        val bytes = pendingDownloadBytes
        if (uri != null && bytes != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: error("ذخیره فایل در مقصد انتخاب‌شده ممکن نشد.")
            }.onFailure { exception ->
                errorText = exception.message ?: "ذخیره فایل ناموفق بود."
            }
        }
        pendingDownloadBytes = null
    }

    suspend fun downloadAttachment(file: FileAssetRow) {
        downloadingFilePath = file.objectPath
        errorText = null
        try {
            pendingDownloadBytes = supabase.storage.from(file.bucketId).downloadAuthenticated(file.objectPath)
            saveFileLauncher.launch(file.originalName)
        } catch (exception: Exception) {
            errorText = exception.message ?: "دریافت فایل ناموفق بود."
            pendingDownloadBytes = null
        } finally {
            downloadingFilePath = null
        }
    }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) scope.launch { uploadAttachment(uri) }
    }

    LaunchedEffect(userId) {
        loadConversations()
        // Keep the inbox and unread counters current for conversations that
        // are not currently open, without subscribing to a single chat only.
        val listChannel = supabase.channel("android-chat-list-$userId")
        val messageChanges = listChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "messages"
        }
        val memberChanges = listChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "conversation_members"
        }
        val messageCollector = launch {
            messageChanges.collect { loadConversations() }
        }
        val memberCollector = launch {
            memberChanges.collect { loadConversations() }
        }
        try {
            listChannel.subscribe(blockUntilSubscribed = true)
            awaitCancellation()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (exception: Exception) {
            errorText = exception.message ?: "به‌روزرسانی فهرست گفتگوها ناموفق بود."
        } finally {
            messageCollector.cancel()
            memberCollector.cancel()
            supabase.realtime.removeChannel(listChannel)
        }
    }

    LaunchedEffect(activeConversation?.id) {
        val conversationId = activeConversation?.id ?: return@LaunchedEffect
        loadMessages(conversationId)

        val channel = supabase.channel("android-chat-$conversationId")
        val changes = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "messages"
            filter = "conversation_id=eq.$conversationId"
        }
        val collector = launch {
            changes.collect {
                loadMessages(conversationId)
                loadConversations()
            }
        }
        val memberChanges = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "conversation_members"
            filter = "conversation_id=eq.$conversationId"
        }
        val memberCollector = launch {
            memberChanges.collect {
                loadConversations()
            }
        }
        val statusCollector = launch {
            channel.status.collect { status ->
                realtimeConnected = status == RealtimeChannel.Status.SUBSCRIBED
                if (realtimeConnected) {
                    loadMessages(conversationId)
                    loadConversations()
                }
            }
        }

        try {
            channel.subscribe(blockUntilSubscribed = true)
            realtimeConnected = true
            awaitCancellation()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (exception: Exception) {
            realtimeConnected = false
            errorText = exception.message ?: "اتصال زنده برقرار نشد."
        } finally {
            realtimeConnected = false
            statusCollector.cancel()
            memberCollector.cancel()
            collector.cancel()
            supabase.realtime.removeChannel(channel)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (activeConversation != null) {
                    IconButton(onClick = {
                        activeConversation = null
                        messages.clear()
                        errorText = null
                        scope.launch { loadConversations() }
                    }) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "بازگشت")
                    }
                }
                Column {
                    Text(
                        activeConversation?.title ?: "گفتگوها",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        if (activeConversation != null) {
                            if (realtimeConnected) "اتصال زنده برقرار است" else "در حال اتصال به گفتگو…"
                        } else "پیام‌رسان کاوه انتقامجو",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (activeConversation == null) {
                IconButton(onClick = { showNewConversation = !showNewConversation }) {
                    Icon(Icons.Outlined.Add, contentDescription = "گفتگوی جدید")
                }
            }
            IconButton(
                onClick = {
                    scope.launch {
                        refreshing = true
                        if (activeConversation == null) loadConversations()
                        else loadMessages(activeConversation!!.id)
                        refreshing = false
                    }
                },
                enabled = !refreshing
            ) {
                if (refreshing) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                else Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی")
            }
        }

        if (showNewConversation && activeConversation == null) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    label = { Text("جست‌وجوی نام یا نام کاربری") },
                    placeholder = { Text("حداقل دو نویسه وارد کن…") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {
                        scope.launch { searchPeople(searchQuery) }
                    })
                )
                Button(
                    onClick = { scope.launch { searchPeople(searchQuery) } },
                    enabled = searchQuery.trim().length >= 2 && !searchingPeople
                ) {
                    if (searchingPeople) CircularProgressIndicator(modifier = Modifier.height(16.dp), strokeWidth = 2.dp)
                    else Text("جست‌وجوی کاربران")
                }
                searchResults.forEach { profile ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            if (creatingConversationFor == null) {
                                scope.launch { startDirectConversation(profile) }
                            }
                        },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(profile.displayName, fontWeight = FontWeight.SemiBold)
                                Text(
                                    profile.username?.let { "@$it" } ?: "کاربر کاوه",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (creatingConversationFor == profile.id) {
                                CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                            } else {
                                Text("شروع گفتگو", color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
                if (!searchingPeople && searchQuery.trim().length >= 2 && searchResults.isEmpty()) {
                    Text("کاربری با این مشخصات پیدا نشد.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        if (errorText != null) {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                Text(
                    errorText.orEmpty(),
                    modifier = Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }

        if (activeConversation == null) {
            when {
                loading -> CircularProgressIndicator()
                conversations.isEmpty() -> Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Text(
                        "هنوز گفتگویی وجود ندارد. برای شروع، دکمه + را بزن و مخاطب را جست‌وجو کن.",
                        modifier = Modifier.padding(18.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(conversations, key = { it.id }) { conversation ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                messages.clear()
                                hasOlderMessages = false
                                activeConversation = conversation
                            },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text(conversation.title, fontWeight = FontWeight.SemiBold)
                                Text(
                                    if (conversation.kind == "direct") "گفتگوی خصوصی" else conversation.kind,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        } else {
            if (hasOlderMessages) {
                Button(
                    onClick = {
                        val conversationId = activeConversation?.id
                        if (conversationId != null) scope.launch { loadOlderMessages(conversationId) }
                    },
                    enabled = !loadingOlderMessages
                ) {
                    if (loadingOlderMessages) CircularProgressIndicator(modifier = Modifier.height(16.dp), strokeWidth = 2.dp)
                    else Text("بارگذاری پیام‌های قدیمی‌تر")
                }
            }
            LazyColumn(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                reverseLayout = false,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(messages, key = { it.id }) { message ->
                    val mine = message.senderId == userId
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start
                    ) {
                        Surface(
                            shape = RoundedCornerShape(18.dp),
                            color = if (mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                        ) {
                            Column(Modifier.padding(horizontal = 13.dp, vertical = 9.dp)) {
                                Text(
                                    message.body,
                                    color = if (mine) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                attachmentsByMessage[message.id].orEmpty().forEach { file ->
                                    Button(
                                        onClick = { scope.launch { downloadAttachment(file) } },
                                        enabled = downloadingFilePath != file.objectPath
                                    ) {
                                        Text(
                                            if (downloadingFilePath == file.objectPath) "در حال دریافت…"
                                            else "دریافت ${file.originalName}"
                                        )
                                    }
                                }
                                Text(
                                    formatMessageTime(message.createdAt),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (mine) {
                                    val read = activeConversation?.kind == "direct" &&
                                        activeConversation?.peerReadAt?.let { it >= message.createdAt } == true
                                    Text(
                                        if (read) "✓✓ خوانده شد" else "✓ ارسال شد",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                IconButton(
                    enabled = !uploadingAttachment && !sending,
                    onClick = { filePickerLauncher.launch(arrayOf("*/*")) }
                ) {
                    if (uploadingAttachment) CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Outlined.AttachFile, contentDescription = "پیوست فایل")
                }
                OutlinedTextField(
                    modifier = Modifier.weight(1f),
                    value = draft,
                    onValueChange = { draft = it },
                    placeholder = { Text("پیامت را بنویس…") },
                    maxLines = 4,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = {
                        val active = activeConversation
                        val text = draft.trim()
                        if (active != null && text.isNotEmpty() && !sending) {
                            scope.launch { sendChatMessage(supabase, active.id, userId, text, { sending = it }, { errorText = it }, { draft = it }, { loadMessages(active.id); loadConversations() }) }
                        }
                    })
                )
                IconButton(
                    enabled = draft.isNotBlank() && !sending,
                    onClick = {
                        val active = activeConversation
                        val text = draft.trim()
                        if (active != null && text.isNotEmpty() && !sending) {
                            scope.launch { sendChatMessage(supabase, active.id, userId, text, { sending = it }, { errorText = it }, { draft = it }, { loadMessages(active.id); loadConversations() }) }
                        }
                    }
                ) {
                    if (sending) CircularProgressIndicator(modifier = Modifier.height(20.dp), strokeWidth = 2.dp)
                    else Icon(Icons.Outlined.Send, contentDescription = "ارسال پیام")
                }
            }
        }
    }
}

private suspend fun sendChatMessage(
    supabase: SupabaseClient,
    conversationId: String,
    userId: String,
    text: String,
    setSending: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    restoreDraft: (String) -> Unit,
    refresh: suspend () -> Unit
) {
    setSending(true)
    setError(null)
    try {
        supabase.postgrest["messages"].insert(
            MessageInsert(
                conversationId = conversationId,
                senderId = userId,
                body = text
            )
        )
        refresh()
    } catch (exception: Exception) {
        restoreDraft(text)
        setError(exception.message ?: "ارسال پیام ناموفق بود.")
    } finally {
        setSending(false)
    }
}

private fun formatMessageTime(value: String): String = try {
    DateTimeFormatter.ofPattern("HH:mm")
        .withZone(ZoneId.systemDefault())
        .format(Instant.parse(value))
} catch (_: Exception) {
    value
}
