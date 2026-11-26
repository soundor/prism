# Soundor Prism logo (final set)

Everything for Soundor Prism: icon, logo, dark-background, single-colour, app-store and social files.

## Spec shared by every Soundor project
- tile 108 units with the brackets as the family mark
- main word: Space Grotesk SemiBold, 88 units; on sub-products the small "Soundor" line above it is Medium, 36 units
- one viewBox height (136) for every lockup, so they render at the same scale at the same pixel height
- text is outlined to paths, no font needed
- colours: ink #10121A, light #F2F4F7, accent orange #FF5A1F, Prism band handles purple #B8A3FF / lime #C4EC6F / amber #FFC043 / orange #FF8F4D, same family as Orbit (deeper shades on the light tile)

## Folders
svg/ (the sources)
- soundor-prism-icon.svg             dark tile, for light backgrounds
- soundor-prism-icon-on-dark.svg     light tile, for dark backgrounds
- soundor-prism-logo.svg             icon + name, for light backgrounds (use 32-64 px tall)
- soundor-prism-logo-on-dark.svg     icon + name, for dark backgrounds
- soundor-prism-icon-mono-black.svg / -mono-white.svg     one colour, symbol knocked out (print, emboss, stamps)
- soundor-prism-logo-mono-black.svg / -mono-white.svg
- soundor-prism-icon-maskable.svg / -maskable-light.svg   full-bleed square with a safe zone, for PWA / Android / app stores

png/ (transparent backgrounds)
- icon 16 to 1024 px (dark tile), icon-on-dark 512, mono icon 512
- logo, logo-on-dark and mono logos at 64 / 128 / 240 px tall
- maskable 192 and 512 (dark and light)

social/
- social-preview-dark and -light (.svg and .png, 1280x640): upload to GitHub, Settings, Social preview

favicon.ico (16/32/48) and apple-touch-icon.png (180) at the top level.
