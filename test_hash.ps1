$md5 = [System.Security.Cryptography.MD5]::Create()
$secretA = "OTQ5NjA5ODgwMzgyMzI5MDcxMTI0MTM2Mjg3NDExMzY2NjEyOTcx"

# Option A: using base64 string as-is (current implementation)
$shA = [BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($secretA))).Replace("-","").ToUpper()
$rawA = "1235197" + "TEST-001" + "650.00" + "LKR" + $shA
$hashA = [BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($rawA))).Replace("-","").ToUpper()
Write-Host "Option A (base64 as-is):"
Write-Host "  secretHash = $shA"
Write-Host "  hash       = $hashA"

# Option B: decode base64 first, then use decoded value
$secretB = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secretA))
Write-Host ""
Write-Host "Decoded secret: $secretB (length=$($secretB.Length))"
$shB = [BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($secretB))).Replace("-","").ToUpper()
$rawB = "1235197" + "TEST-001" + "650.00" + "LKR" + $shB
$hashB = [BitConverter]::ToString($md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($rawB))).Replace("-","").ToUpper()
Write-Host ""
Write-Host "Option B (base64 decoded):"
Write-Host "  secretHash = $shB"
Write-Host "  hash       = $hashB"
