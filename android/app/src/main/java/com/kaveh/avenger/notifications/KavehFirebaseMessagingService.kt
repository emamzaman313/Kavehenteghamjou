package com.kaveh.avenger.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.net.URL
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.kaveh.avenger.MainActivity
import com.kaveh.avenger.R

class KavehFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title ?: message.data["title"] ?: "کاوه انتقامجو"
        val body = message.notification?.body ?: message.data["body"] ?: "اعلان تازه‌ای دریافت کردید."
        val imageUrl = message.notification?.imageUrl?.toString()
        val priority = message.data["priority"] ?: "normal"
        val clickUrl = message.data["click_url"] ?: "/"
        val notificationId = message.data["notification_id"] ?: ""
        showNotification(title, body, imageUrl, priority, clickUrl, notificationId)
    }

    private fun showNotification(title: String, body: String, imageUrl: String?, priority: String, clickUrl: String, notificationId: String) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val urgent = priority == "high"
        val channelId = if (urgent) "kaveh_urgent_notifications" else "kaveh_general_notifications"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(channelId, if (urgent) "اعلان‌های فوری کاوه" else "اعلان‌های کاوه", if (urgent) NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("kaveh_notification_click_url", clickUrl)
            putExtra("kaveh_notification_id", notificationId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(if (urgent) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
        val image: Bitmap? = imageUrl?.let { url ->
            runCatching { URL(url).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull()
        }
        if (image != null) {
            builder.setLargeIcon(image)
            builder.setStyle(NotificationCompat.BigPictureStyle().bigPicture(image).bigLargeIcon(null as Bitmap?))
        }
        val notification = builder.build()
        NotificationManagerCompat.from(this).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }
}
