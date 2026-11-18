package com.kaveh.avenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Provisional neutral/champagne tokens. Replace accent values only after the supplied original brand icon is available.
private val KavehDark = darkColorScheme(
    primary = Color(0xFFD8B873),
    onPrimary = Color(0xFF191714),
    secondary = Color(0xFFB9A779),
    background = Color(0xFF101010),
    onBackground = Color(0xFFF5F1E8),
    surface = Color(0xFF1A1917),
    onSurface = Color(0xFFF5F1E8),
    surfaceVariant = Color(0xFF292722),
    onSurfaceVariant = Color(0xFFC8C1B2),
    error = Color(0xFFFF6B6B)
)

private val KavehLight = lightColorScheme(
    primary = Color(0xFF82672C),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF756342),
    background = Color(0xFFF7F5F0),
    onBackground = Color(0xFF171612),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF171612),
    surfaceVariant = Color(0xFFECE8DE),
    onSurfaceVariant = Color(0xFF5F5A4E),
    error = Color(0xFFBA1A1A)
)

@Composable
fun KavehTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    MaterialTheme(
        colorScheme = if (dark) KavehDark else KavehLight,
        content = content
    )
}
