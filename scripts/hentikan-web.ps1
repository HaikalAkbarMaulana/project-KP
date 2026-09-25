# Menghentikan backend dan frontend LabPinjam. Dipanggil oleh hentikan-web.bat.
#
# Proses dicari dari port yang dipakainya, bukan dari judul jendela, karena
# server bisa saja dinyalakan dari terminal VS Code atau berjalan tanpa
# jendela yang kelihatan.
#
# Dari proses pemegang port, penelusuran naik selama induknya masih node.exe,
# lalu seluruh cabang itu dihentikan. Tujuannya agar nodemon ikut berhenti:
# kalau hanya servernya yang dimatikan, nodemon akan menunggu lalu
# menyalakannya lagi. Penelusuran berhenti di proses pertama yang bukan
# node.exe (cmd atau terminal), jadi jendela terminal Anda tidak ikut ditutup.

param(
  [int]$PortBackend = 4000,
  [int]$PortFrontend = 5173
)

$daftar = @(
  @{ Port = $PortBackend; Nama = 'Backend' },
  @{ Port = $PortFrontend; Nama = 'Frontend' }
)

foreach ($item in $daftar) {
  $koneksi = Get-NetTCPConnection -LocalPort $item.Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if (-not $koneksi) {
    Write-Host ('  [-]  {0} memang tidak sedang berjalan.' -f $item.Nama)
    continue
  }

  $idPuncak = $koneksi.OwningProcess
  while ($true) {
    $proses = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $idPuncak)
    if (-not $proses) { break }

    $induk = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $proses.ParentProcessId)
    if ($induk -and $induk.Name -eq 'node.exe') {
      $idPuncak = $induk.ProcessId
    } else {
      break
    }
  }

  taskkill /PID $idPuncak /T /F | Out-Null
  Write-Host ('  [OK] {0} di port {1} dihentikan.' -f $item.Nama, $item.Port)
}
