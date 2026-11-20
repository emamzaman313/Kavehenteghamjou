# Kaveh Design System

Status: foundational tokens added; component-by-component adoption and visual regression coverage remain in progress.

## Brand and product constraints

- Keep the existing Kaveh Enteghamjou name and brand icon.
- Persian and RTL are the default for product-facing interfaces.
- Preserve the current midnight/navy + blue identity with restrained warm-gold accents.
- Both light and dark surfaces must remain legible; user-selected theme must not be silently overwritten by remote appearance settings.
- Remote appearance may adjust only the approved accent, background, surface and radius values.

## Shared token scale

| Token family | Web CSS | Android Compose | Purpose |
|---|---|---|---|
| Spacing | `--space-1` … `--space-10` | `KavehSpacing.x1` … `x10` | Consistent layout rhythm |
| Radius | `--radius-sm` … `--radius-2xl` | `KavehRadius.small` … `extraLarge` | Inputs, cards and surfaces |
| Elevation | `--shadow`, `--shadow-raised` | Material 3 tonal elevation/shadows | Layer hierarchy |
| Motion | `--motion-fast`, `--motion-standard`, `--motion-emphasis` | Compose animation defaults | Short, purposeful transitions |
| Typography | `--font-body`, `--font-size-*` | Material 3 typography | Persian-first hierarchy |
| Color | `--accent`, `--surface`, `--text`, semantic states | Material color schemes | Theme-aware contrast |

### Spacing

- 1 = 4 px/dp
- 2 = 8 px/dp
- 3 = 12 px/dp
- 4 = 16 px/dp
- 5 = 20 px/dp
- 6 = 24 px/dp
- 8 = 32 px/dp
- 10 = 40 px/dp

### Shape

- Small: 8
- Medium: 12
- Large: 16 (web) / 20 (native card shape)
- Extra large: 26
- Pill: 999

Web tokens live in `web/app/globals.css`. Android tokens live in `android/.../ui/theme/KavehTokens.kt`; Material 3 small/medium/large shapes are configured in `Theme.kt`.

## Component contract

Every reusable component should define:
- Default, hover/focus, pressed, disabled and loading states where applicable.
- Loading, empty, error/retry and permission-denied states for data-backed surfaces.
- Keyboard and screen-reader labels on web; semantics and content descriptions on Android.
- Minimum 44 px/dp touch targets on compact mobile controls.
- Reduced-motion behavior and visible focus indication.
- RTL-safe alignment and direction-aware icons/text.

## Responsive behavior

- Compact mobile: single-column content and bottom navigation; preserve safe-area insets.
- Tablet: collapsible navigation and two-column content where useful.
- Desktop: persistent navigation, constrained content width and optional contextual rail.
- Avoid horizontal overflow; tables and media must have deliberate compact layouts.

## Accessibility

- Maintain visible focus indicators.
- Honor `prefers-reduced-motion` on web and system animation settings on Android.
- Support forced-colors/high-contrast modes.
- Never communicate status by color alone.
- Use Persian-friendly number/date formatting and meaningful accessible labels.

## Adoption status

- [x] Web spacing, radius, motion, typography and elevation tokens declared.
- [x] Android spacing and radius token objects added.
- [x] Android Material 3 shape scale connected to native tokens.
- [x] Existing brand palette retained.
- [ ] Replace legacy one-off values incrementally in high-traffic screens.
- [ ] Build shared component primitives for web and Android.
- [ ] Add visual regression snapshots for login, feed, chat, reels, world, vault, profile and admin.
- [ ] Validate contrast and layout on real mobile devices.

A token being defined does not mean every screen has adopted it. Do not mark the design system complete until adoption and regression checks are demonstrated on both platforms.
