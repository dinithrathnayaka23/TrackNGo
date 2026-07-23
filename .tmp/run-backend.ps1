Set-Location -LiteralPath "D:\L2S2\Software Development Project\TrackNGo Agent\TrackNGo\backend\trackngo-backend"
$cp = Get-Content -Raw "app\app\target\runtime-classpath.txt"
$cp = "app\target\classes;$cp"
& "C:\Program Files\Java\jdk-21\bin\java.exe" -cp $cp com.trackngo.app.TrackNGoApplication *> "D:\L2S2\Software Development Project\TrackNGo Agent\TrackNGo\backend-run.combined.log"
