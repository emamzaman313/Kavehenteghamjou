package com.kaveh.avenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Premium Kaveh palette: midnight navy, aurora blue, and restrained champagne.
private val KavehDark = darkColorScheme(
    primary = Color(0xFF65B9FF),
    onPrimary = Color(0xFF061626),
    primaryContainer = Color(0xFF163A5D),
    onPrimaryContainer = Color(0xFFD8EDFF),
    secondary = Color(0xFFE7BA78),
    onSecondary = Color(0xFF26190A),
    secondaryContainer = Color(0xFF49331B),
    onSecondaryContainer = Color(0xFFFFE8C5),
    tertiary = Color(0xFF7BD8BE),
    onTertiary = Color(0xFF06251D),
    background = Color(0xFF070D19),
    onBackground = Color(0xFFF2F6FC),
    surface = Color(0xFF101B2D),
    onSurface = Color(0xFFF1F5FB),
    surfaceVariant = Color(0xFF1A2A42),
    onSurfaceVariant = Color(0xFFB1C1D5),
    outline = Color(0xFF3B526D),
    outlineVariant = Color(0xFF293C55),
    error = Color(0xFFFF777F)
)

private val KavehLight = lightColorScheme(
    primary = Color(0xFF155C99),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFD7EAFE),
    onPrimaryContainer = Color(0xFF092A49),
    secondary = Color(0xFF95652F),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFF7E6CC),
    onSecondaryContainer = Color(0xFF39230B),
    tertiary = Color(0xFF16755F),
    onTertiary = Color(0xFFFFFFFF),
    background = Color(0xFFF1F5FA),
    onBackground = Color(0xFF142238),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF17263B),
    surfaceVariant = Color(0xFFE7EEF6),
    onSurfaceVariant = Color(0xFF536780),
    outline = Color(0xFF9BAEC3),
    outlineVariant = Color(0xFFD1DDE9),
    error = Color(0xFFB32632)
)

@Composable
fun KavehTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    MaterialTheme(
        colorScheme = if (dark) KavehDark else KavehLight,
        shapes = Shapes(
            small = RoundedCornerShape(KavehRadius.small),
            medium = RoundedCornerShape(KavehRadius.medium),
            large = RoundedCornerShape(KavehRadius.large)
        ),
        content = content
    )
}
