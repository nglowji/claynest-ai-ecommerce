$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
& python (Join-Path $PSScriptRoot 'configure.py')
if ($LASTEXITCODE -ne 0) { throw 'Configuration failed.' }
$settings = @{}
foreach ($line in [System.IO.File]::ReadAllLines((Join-Path $workspace '.env'))) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") }
}
$connection = New-Object System.Data.Common.DbConnectionStringBuilder
$connection['Host'] = '127.0.0.1'
$connection['Port'] = $settings['POSTGRES_PORT']
$connection['Database'] = $settings['POSTGRES_DB']
$connection['Username'] = 'commerce_app'
$connection['Password'] = $settings['COMMERCE_DB_PASSWORD']
$previousConnection = $env:ConnectionStrings__Commerce
try {
    $env:ConnectionStrings__Commerce = $connection.ConnectionString
    & dotnet run --project (Join-Path $workspace 'backend/src/ClayNest.API/ClayNest.API.csproj')
    if ($LASTEXITCODE -ne 0) { throw 'API stopped with an error.' }
} finally {
    $env:ConnectionStrings__Commerce = $previousConnection
}
