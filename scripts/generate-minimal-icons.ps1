Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\waymo\.gemini\antigravity-ide\brain\c9f7bcad-7327-4cb5-893c-8dfa428a441d\minimal_browser_north_1793108784779.jpg"
$assetsDir = "c:\Users\waymo\Documents\dev\Projects\browser\assets"

$src = [System.Drawing.Bitmap]::FromFile($sourcePath)

$centerX = 512.0
$centerY = 512.0
$outerRingRadius = 308.0
# The red tip extends to ~322px at roughly 45 degrees
$maxExtent = 325.0

# 1. Master Icon (1024x1024) - Pure White background edge-to-edge
$masterBmp = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

for ($y = 0; $y -lt 1024; $y++) {
    for ($x = 0; $x -lt 1024; $x++) {
        $dx = $x - $centerX
        $dy = $y - $centerY
        $dist = [Math]::Sqrt($dx * $dx + $dy * $dy)

        # Check if we are inside the emblem area
        # Check angle to allow the red needle tip at 45 degrees (dx > 0, dy < 0)
        $allowedDist = $outerRingRadius
        $angle = [Math]::Atan2($dy, $dx) * 180.0 / [Math]::PI
        # Around -45 degrees (top-right), allow up to 326px for the red needle tip
        if ($angle -gt -65 -and $angle -lt -25) {
            $allowedDist = $maxExtent
        }
        # Around 135 degrees (bottom-left), allow up to 326px for the white needle tip
        if ($angle -gt 115 -and $angle -lt 155) {
            $allowedDist = $maxExtent
        }

        if ($dist -le $allowedDist) {
            # Keep original pixel
            $masterBmp.SetPixel($x, $y, $src.GetPixel($x, $y))
        } elseif ($dist -le ($allowedDist + 3.0)) {
            # 3px anti-aliased edge blend into pure white
            $factor = ($dist - $allowedDist) / 3.0
            $c = $src.GetPixel($x, $y)
            $r = [int]($c.R * (1.0 - $factor) + 255 * $factor)
            $g = [int]($c.G * (1.0 - $factor) + 255 * $factor)
            $b = [int]($c.B * (1.0 - $factor) + 255 * $factor)
            $masterBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        } else {
            # Pure white
            $masterBmp.SetPixel($x, $y, $white)
        }
    }
}
$masterBmp.Save("$assetsDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Generated clean: $assetsDir\icon.png"

# 2. Android Adaptive Background (1024x1024 pure white #ffffff)
$bgBmp = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgG = [System.Drawing.Graphics]::FromImage($bgBmp)
$bgG.Clear($white)
$bgG.Dispose()
$bgBmp.Save("$assetsDir\android-icon-background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bgBmp.Dispose()
Write-Output "Generated: $assetsDir\android-icon-background.png"

# 3. Android Adaptive Foreground (1024x1024)
# In Android adaptive icon specs:
# When background is white, foreground can either be full-bleed or scaled with safe margin.
# Since masterBmp is pure white edge-to-edge, it works natively on Android!
$masterBmp.Save("$assetsDir\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Generated: $assetsDir\android-icon-foreground.png"

# 4. Splash Screen Icon (512x512)
$splashBmp = New-Object System.Drawing.Bitmap 512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$splashG = [System.Drawing.Graphics]::FromImage($splashBmp)
$splashG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$splashG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$splashG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$splashG.Clear($white)
$splashG.DrawImage($masterBmp, 0, 0, 512, 512)
$splashG.Dispose()
$splashBmp.Save("$assetsDir\splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$splashBmp.Dispose()
Write-Output "Generated: $assetsDir\splash-icon.png"

# 5. Web Favicon (48x48)
$favBmp = New-Object System.Drawing.Bitmap 48, 48, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$favG = [System.Drawing.Graphics]::FromImage($favBmp)
$favG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$favG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$favG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$favG.Clear([System.Drawing.Color]::Transparent)
$favG.DrawImage($masterBmp, 0, 0, 48, 48)
$favG.Dispose()
$favBmp.Save("$assetsDir\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$favBmp.Dispose()
Write-Output "Generated: $assetsDir\favicon.png"

# 6. Android Monochrome Icon (1024x1024) - clean black/white silhouette for Material You
$monoBmp = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt 1024; $y++) {
    for ($x = 0; $x -lt 1024; $x++) {
        $c = $masterBmp.GetPixel($x, $y)
        # Check if pixel is part of the ring or needle
        # Blue ring and red needle have distinct non-white colors
        $diff = [Math]::Max([Math]::Abs($c.R - $c.G), [Math]::Abs($c.G - $c.B))
        $isColored = $diff -gt 18 -or ($c.R -lt 230 -or $c.G -lt 230 -or $c.B -lt 230)

        if ($isColored) {
            $monoBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        }
    }
}
$monoBmp.Save("$assetsDir\android-icon-monochrome.png", [System.Drawing.Imaging.ImageFormat]::Png)
$monoBmp.Dispose()
Write-Output "Generated: $assetsDir\android-icon-monochrome.png"

$masterBmp.Dispose()
$src.Dispose()
Write-Output "All clean minimal icons updated!"
