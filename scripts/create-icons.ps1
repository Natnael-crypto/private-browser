Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\waymo\.gemini\antigravity-ide\brain\c9f7bcad-7327-4cb5-893c-8dfa428a441d\browser_app_icon_1793107707917.jpg"
$assetsDir = "c:\Users\waymo\Documents\dev\Projects\browser\assets"

$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

function Save-ResizedImage {
    param(
        [System.Drawing.Image]$src,
        [int]$width,
        [int]$height,
        [string]$destPath,
        [System.Drawing.Color]$bgColor = [System.Drawing.Color]::Transparent,
        [float]$scale = 1.0
    )
    $bmp = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgColor -ne [System.Drawing.Color]::Transparent) {
        $brush = New-Object System.Drawing.SolidBrush $bgColor
        $g.FillRectangle($brush, 0, 0, $width, $height)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $destW = [int]($width * $scale)
    $destH = [int]($height * $scale)
    $destX = [int](($width - $destW) / 2)
    $destY = [int](($height - $destH) / 2)

    $g.DrawImage($src, $destX, $destY, $destW, $destH)
    $g.Dispose()

    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $destPath"
}

# 1. Master Icon (1024x1024) - used for iOS and default app icon
Save-ResizedImage -src $sourceImg -width 1024 -height 1024 -destPath "$assetsDir\icon.png"

# 2. Android Adaptive Foreground (1024x1024 full bleed so Android masks it cleanly)
Save-ResizedImage -src $sourceImg -width 1024 -height 1024 -destPath "$assetsDir\android-icon-foreground.png" -scale 1.0

# 3. Android Adaptive Background (1024x1024 dark #090a0e matching the icon outer tone)
$bgBmp = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgG = [System.Drawing.Graphics]::FromImage($bgBmp)
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 9, 10, 14))
$bgG.FillRectangle($bgBrush, 0, 0, 1024, 1024)
$bgBrush.Dispose()
$bgG.Dispose()
$bgBmp.Save("$assetsDir\android-icon-background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bgBmp.Dispose()
Write-Output "Generated: $assetsDir\android-icon-background.png"

# 4. Splash Screen Icon (512x512)
Save-ResizedImage -src $sourceImg -width 512 -height 512 -destPath "$assetsDir\splash-icon.png" -scale 1.0

# 5. Web Favicon (48x48)
Save-ResizedImage -src $sourceImg -width 48 -height 48 -destPath "$assetsDir\favicon.png"

# 6. Android Monochrome Themed Icon (1024x1024 white silhouette on transparent, isolated central emblem)
$srcBmp = New-Object System.Drawing.Bitmap $sourceImg
$monoBmp = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$centerX = 512.0
$centerY = 512.0
# Radius for keeping only central shield and rings (approx 360px radius)
$maxRadius = 365.0

for ($y = 0; $y -lt 1024; $y++) {
    for ($x = 0; $x -lt 1024; $x++) {
        $dx = $x - $centerX
        $dy = $y - $centerY
        $dist = [Math]::Sqrt($dx * $dx + $dy * $dy)

        if ($dist -lt $maxRadius) {
            $c = $srcBmp.GetPixel($x, $y)
            $lum = [int](($c.R * 0.299) + ($c.G * 0.587) + ($c.B * 0.114))
            if ($lum -gt 55) {
                # Edge feathering near maxRadius
                $edgeFactor = 1.0
                if ($dist -gt ($maxRadius - 20)) {
                    $edgeFactor = ($maxRadius - $dist) / 20.0
                }
                $alpha = [int]([Math]::Min(255, ($lum - 55) * 1.8 * $edgeFactor))
                if ($alpha -gt 5) {
                    $monoBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
                }
            }
        }
    }
}
$srcBmp.Dispose()
$monoBmp.Save("$assetsDir\android-icon-monochrome.png", [System.Drawing.Imaging.ImageFormat]::Png)
$monoBmp.Dispose()
Write-Output "Generated: $assetsDir\android-icon-monochrome.png"

$sourceImg.Dispose()
Write-Output "All asset icons successfully regenerated!"
