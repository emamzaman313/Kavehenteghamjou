package com.kaveh.avenger.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationDestinationTest {
    @Test
    fun opensTheRequestedConversation() {
        val id = "8f6d0c8c-f9fd-41fa-a652-8cbd797b5d4a"

        assertEquals(
            NotificationDestination.Conversation(id),
            parseNotificationDestination("/chat?conversation_id=$id"),
        )
    }

    @Test
    fun opensInboxForInboxAndRootRoutes() {
        assertEquals(NotificationDestination.Inbox, parseNotificationDestination("/notifications"))
        assertEquals(NotificationDestination.Inbox, parseNotificationDestination("/"))
    }

    @Test
    fun rejectsExternalAndMalformedRoutes() {
        assertNull(parseNotificationDestination("https://attacker.example/chat?conversation_id=8f6d0c8c-f9fd-41fa-a652-8cbd797b5d4a"))
        assertEquals(NotificationDestination.Inbox, parseNotificationDestination("/chat?conversation_id=not-a-uuid"))
        assertEquals(NotificationDestination.Inbox, parseNotificationDestination("/unknown"))
        assertNull(parseNotificationDestination(null))
    }
}
