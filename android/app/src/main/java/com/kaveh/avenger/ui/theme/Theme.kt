package com.kaveh.avenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Electric blue and cyan brand palette aligned with the supplied Kaveh emblem.
private val KavehDark = darkColorScheme(
    primary = Color(0xFF168BFF),
    onPrimary = Color(0xFF03101F),
    secondary = Color(0xFF80D8FF),
    background = Color(0xFF050912),
    onBackground = Color(0xFFF2F8FF),
    surface = Color(0xFF0D1728),
    onSurface = Color(0xFFF5F1E8),
    surfaceVariant = Color(0xFF18263A),
    onSurfaceVariant = Color(0xFFB5C5D9),
    error = Color(0xFFFF6B6B)
)

private val KavehLight = lightColorScheme(
    primary = Color(0xFF075BC7),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF167CA8),
    background = Color(0xFFF2F7FD),
    onBackground = Color(0xFF101C2C),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF171612),
    surfaceVariant = Color(0xFFE2ECF7),
    onSurfaceVariant = Color(0xFF53677F),
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
