package com.kaveh.avenger.notifications

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

sealed interface NotificationDestination {
    data class Conversation(val id: String) : NotificationDestination
    data object Inbox : NotificationDestination
}

private val conversationIdPattern = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", RegexOption.IGNORE_CASE)

fun parseNotificationDestination(value: String?): NotificationDestination? {
    if (value.isNullOrBlank()) return null
    val uri = runCatching { URI(value) }.getOrNull() ?: return null
    if (uri.isAbsolute || uri.rawAuthority != null || uri.rawFragment != null) return null

    return when (uri.rawPath) {
        "/", "/notifications" -> NotificationDestination.Inbox
        "/chat" -> {
            val query = runCatching {
                uri.rawQuery.orEmpty().split('&').mapNotNull { part ->
                    val separator = part.indexOf('=')
                    if (separator < 0) null else {
                        val key = URLDecoder.decode(part.substring(0, separator), StandardCharsets.UTF_8)
                        val decodedValue = URLDecoder.decode(part.substring(separator + 1), StandardCharsets.UTF_8)
                        key to decodedValue
                    }
                }.toMap()
            }.getOrElse { return NotificationDestination.Inbox }
            val id = query["conversation_id"] ?: return NotificationDestination.Inbox
            if (conversationIdPattern.matches(id)) NotificationDestination.Conversation(id)
            else NotificationDestination.Inbox
        }
        else -> NotificationDestination.Inbox
    }
}
