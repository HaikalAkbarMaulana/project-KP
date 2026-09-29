# Mencetak alamat komputer ini di Wi-Fi/LAN, untuk dibuka dari HP.
#
# Yang dipilih adalah adapter yang punya gerbang bawaan (default gateway)
# dan sedang aktif. Syarat itu menyingkirkan adapter virtual seperti
# VirtualBox atau VMware, yang punya alamat IP tapi tidak tersambung ke
# Wi-Fi mana pun sehingga tidak akan bisa dijangkau HP.

$konfigurasi = Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } |
  Select-Object -First 1

if ($konfigurasi -and $konfigurasi.IPv4Address) {
  Write-Output $konfigurasi.IPv4Address.IPAddress
}
