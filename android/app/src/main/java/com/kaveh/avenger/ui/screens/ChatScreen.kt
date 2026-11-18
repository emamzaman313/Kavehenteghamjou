package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.createChannel
import io.github.jan.supabase.realtime.join
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.removeChannel
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
private data class ProfileRow(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val username: String? = null
)

private data class ChatConversation(
    val id: String,
    val title: String,
    val kind: String,
    val lastMessageAt: String?
)

@Composable
fun ChatScreen(
    supabase: SupabaseClient,
    userId: String,
) {
    val scope = rememberCoroutineScope()
    val conversations = remember { mutableStateListOf<ChatConversation>() }
    val messages = remember { mutableStateListOf<MessageRow>() }
    var activeConversation by remember { mutableStateOf<ChatConversation?>(null) }
    var draft by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var sending by remember { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var realtimeConnected by remember { mutableStateOf(false) }

    suspend fun loadConversations() {
        loading = true
        errorText = null
        try {
            val memberships = supabase.postgrest["conversation_members"].select {
                eq("user_id", userId)
            }.decodeList<ConversationMemberRow>()

            val loaded = memberships.mapNotNull { membership ->
                val conversation = supabase.postgrest["conversations"].select {
                    eq("id", membership.conversationId)
                }.decodeList<ConversationRow>().firstOrNull() ?: return@mapNotNull null

                val otherMember = supabase.postgrest["conversation_members"].select {
                    eq("conversation_id", conversation.id)
                }.decodeList<ConversationMemberRow>().firstOrNull { it.userId != userId }

                val profile = otherMember?.let { member ->
                    supabase.postgrest["profiles"].select {
                        eq("id", member.userId)
                    }.decodeList<ProfileRow>().firstOrNull()
                }

                ChatConversation(
                    id = conversation.id,
                    title = conversation.title ?: profile?.displayName ?: profile?.username?.let { "@$it" }
                        ?: if (conversation.kind == "direct") "گفتگوی خصوصی" else "گفتگو",
                    kind = conversation.kind,
                    lastMessageAt = conversation.lastMessageAt
                )
            }.sortedByDescending { it.lastMessageAt ?: "" }

            conversations.clear()
            conversations.addAll(loaded)
        } catch (exception: Exception) {
            errorText = exception.message ?: "دریافت گفتگوها ناموفق بود."
        } finally {
            loading = false
        }
    }

    suspend fun loadMessages(conversationId: String) {
        try {
            val loaded = supabase.postgrest["messages"].select {
                eq("conversation_id", conversationId)
                isIn("deleted_at", listOf<String?>(null))
                order(column = "created_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(count = 100)
            }.decodeList<MessageRow>().reversed()

            messages.clear()
            messages.addAll(loaded)

            supabase.postgrest["conversation_members"].update({
                set("last_read_at", Instant.now().toString())
            }) {
                eq("conversation_id", conversationId)
                eq("user_id", userId)
            }
        } catch (exception: Exception) {
            errorText = exception.message ?: "دریافت پیام‌ها ناموفق بود."
        }
    }

    LaunchedEffect(userId) {
        loadConversations()
    }

    LaunchedEffect(activeConversation?.id) {
        val conversationId = activeConversation?.id ?: return@LaunchedEffect
        loadMessages(conversationId)

        val channel = supabase.realtime.createChannel("android-chat-$conversationId")
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

        try {
            supabase.realtime.connect()
            channel.join(blockUntilJoined = true)
            realtimeConnected = true
            awaitCancellation()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (exception: Exception) {
            realtimeConnected = false
            errorText = exception.message ?: "اتصال زنده برقرار نشد."
        } finally {
            realtimeConnected = false
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
                        "هنوز گفتگویی وجود ندارد. پس از شروع یک گفتگوی خصوصی در نسخه وب، اینجا نیز نمایش داده می‌شود.",
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
                                Text(
                                    formatMessageTime(message.createdAt),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
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
