param(
  [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

$results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Name,
    [bool]$Passed,
    [string]$Detail
  )

  $results.Add([pscustomobject]@{
    name = $Name
    passed = $Passed
    detail = $Detail
  }) | Out-Null

  if ($Passed) {
    Write-Host "[PASS] $Name - $Detail" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $Name - $Detail" -ForegroundColor Red
  }
}

function Parse-ErrorBody {
  param([System.Exception]$Exception)

  try {
    if ($null -eq $Exception.Response) {
      return $Exception.Message
    }

    $stream = $Exception.Response.GetResponseStream()
    if ($null -eq $stream) {
      return $Exception.Message
    }

    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($body)) {
      return $Exception.Message
    }

    return $body
  } catch {
    return $Exception.Message
  }
}

function Invoke-Api {
  param(
    [ValidateSet("GET", "POST", "PATCH")]
    [string]$Method,
    [string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [object]$Body,
    [int]$ExpectedStatus = 200
  )

  $uri = "$BaseUrl$Path"
  $headers = @{ "Content-Type" = "application/json" }

  try {
    $params = @{
      Method = $Method
      Uri = $uri
      Headers = $headers
    }

    if ($null -ne $Session) {
      $params.WebSession = $Session
    }

    if ($null -ne $Body) {
      $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    $response = Invoke-RestMethod @params
    return [pscustomobject]@{
      ok = ($ExpectedStatus -ge 200 -and $ExpectedStatus -lt 300)
      status = 200
      body = $response
      rawError = $null
    }
  } catch {
    $statusCode = 500

    if ($null -ne $_.Exception.Response) {
      try {
        $statusCode = [int]$_.Exception.Response.StatusCode
      } catch {
        $statusCode = 500
      }
    }

    $rawError = Parse-ErrorBody -Exception $_.Exception
    $errorObject = $null

    try {
      $errorObject = $rawError | ConvertFrom-Json
    } catch {
      $errorObject = [pscustomobject]@{ error = $rawError }
    }

    $isExpected = ($statusCode -eq $ExpectedStatus)

    return [pscustomobject]@{
      ok = $isExpected
      status = $statusCode
      body = $errorObject
      rawError = $rawError
    }
  }
}

function Ensure-Success {
  param(
    [string]$Step,
    [object]$Result
  )

  if (-not $Result.ok) {
    $message = if ($Result.body -and $Result.body.error) { $Result.body.error } else { "status $($Result.status)" }
    Add-Result -Name $Step -Passed $false -Detail $message
    throw "Step failed: $Step"
  }

  Add-Result -Name $Step -Passed $true -Detail "status $($Result.status)"
}

function New-TestUser {
  param(
    [string]$Prefix,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $rand = (Get-Random -Minimum 1000 -Maximum 9999)
  $email = "$Prefix.$stamp.$rand@test.local"
  $nickname = "$Prefix$rand"
  $password = "123456"

  $register = Invoke-Api -Method "POST" -Path "/api/auth/register" -Session $Session -Body @{
    nickname = $nickname
    email = $email
    password = $password
  }

  Ensure-Success -Step "register-$Prefix" -Result $register

  return [pscustomobject]@{
    email = $email
    nickname = $nickname
    password = $password
  }
}

Write-Host "Running backend integration test against $BaseUrl" -ForegroundColor Cyan

try {
  $u1Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $u2Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

  $u1 = New-TestUser -Prefix "u1" -Session $u1Session
  $u2 = New-TestUser -Prefix "u2" -Session $u2Session

  $createRoom = Invoke-Api -Method "POST" -Path "/api/rooms" -Session $u1Session -Body @{ name = "Sala Teste API" }
  Ensure-Success -Step "create-room" -Result $createRoom

  $room = $createRoom.body.data
  if ($null -eq $room -or [string]::IsNullOrWhiteSpace($room.id) -or [string]::IsNullOrWhiteSpace($room.code)) {
    Add-Result -Name "room-payload" -Passed $false -Detail "missing room id or code"
    throw "Invalid room payload"
  }
  Add-Result -Name "room-payload" -Passed $true -Detail "room_id=$($room.id), code=$($room.code)"

  $joinRoom = Invoke-Api -Method "POST" -Path "/api/rooms/join" -Session $u2Session -Body @{ code = $room.code }
  Ensure-Success -Step "join-room-u2" -Result $joinRoom

  $matches = Invoke-Api -Method "GET" -Path "/api/matches" -Session $u1Session -Body $null
  Ensure-Success -Step "list-matches" -Result $matches

  $openMatch = $matches.body.data | Where-Object { $_.status -eq "open" } | Select-Object -First 1
  if ($null -eq $openMatch) {
    Add-Result -Name "pick-open-match" -Passed $false -Detail "no match with status=open"
    throw "No open match available"
  }
  Add-Result -Name "pick-open-match" -Passed $true -Detail "match_id=$($openMatch.id), $($openMatch.home_abbr)x$($openMatch.away_abbr)"

  $u1PredictedQualifier = if ([string]::IsNullOrWhiteSpace($openMatch.home_abbr)) { "HOME" } else { $openMatch.home_abbr }
  if ($u1PredictedQualifier -eq "HOME") {
    Add-Result -Name "match-abbr-fallback" -Passed $true -Detail "home_abbr vazio no match; usando qualifier HOME no teste"
  }

  $u1Bet = Invoke-Api -Method "POST" -Path "/api/bets" -Session $u1Session -Body @{
    room_id = $room.id
    match_id = $openMatch.id
    predicted_home = 2
    predicted_away = 1
    predicted_qualifier = $u1PredictedQualifier
  }
  Ensure-Success -Step "bet-u1" -Result $u1Bet

  $u2Bet = Invoke-Api -Method "POST" -Path "/api/bets" -Session $u2Session -Body @{
    room_id = $room.id
    match_id = $openMatch.id
    predicted_home = 1
    predicted_away = 1
    predicted_qualifier = "DRAW"
  }
  Ensure-Success -Step "bet-u2" -Result $u2Bet

  $statsBefore = Invoke-Api -Method "GET" -Path "/api/bets/stats?room_id=$($room.id)" -Session $u1Session -Body $null
  Ensure-Success -Step "stats-before-finalize" -Result $statsBefore

  $finalize = Invoke-Api -Method "POST" -Path "/api/matches/finalize" -Session $null -Body @{
    match_id = $openMatch.id
    home_score = 2
    away_score = 1
  }
  Ensure-Success -Step "finalize-match" -Result $finalize

  $u1BetsResult = Invoke-Api -Method "GET" -Path "/api/bets?room_id=$($room.id)" -Session $u1Session -Body $null
  Ensure-Success -Step "list-bets-u1" -Result $u1BetsResult

  $u2BetsResult = Invoke-Api -Method "GET" -Path "/api/bets?room_id=$($room.id)" -Session $u2Session -Body $null
  Ensure-Success -Step "list-bets-u2" -Result $u2BetsResult

  $roomResult = Invoke-Api -Method "GET" -Path "/api/rooms/$($room.id)" -Session $u1Session -Body $null
  Ensure-Success -Step "room-leaderboard" -Result $roomResult

  $roomData = $roomResult.body.data
  $ptsExact = [int]$roomData.room.pts_exact
  $ptsWinner = [int]$roomData.room.pts_winner

  $expectedU1 = $ptsExact + $ptsWinner
  $expectedU2 = 0

  $u1BetFinal = $u1BetsResult.body.data | Where-Object { $_.match_id -eq $openMatch.id } | Select-Object -First 1
  $u2BetFinal = $u2BetsResult.body.data | Where-Object { $_.match_id -eq $openMatch.id } | Select-Object -First 1

  if ($null -eq $u1BetFinal -or $null -eq $u2BetFinal) {
    Add-Result -Name "bets-after-finalize" -Passed $false -Detail "bet not found after finalize"
    throw "Missing bets after finalize"
  }

  $u1PointsOk = ([int]$u1BetFinal.points_earned -eq $expectedU1)
  Add-Result -Name "u1-points" -Passed $u1PointsOk -Detail "expected=$expectedU1 actual=$($u1BetFinal.points_earned)"

  $u2PointsOk = ([int]$u2BetFinal.points_earned -eq $expectedU2)
  Add-Result -Name "u2-points" -Passed $u2PointsOk -Detail "expected=$expectedU2 actual=$($u2BetFinal.points_earned)"

  $leaderboard = $roomData.leaderboard
  $leaderU1 = $leaderboard | Where-Object { $_.nickname -eq $u1.nickname } | Select-Object -First 1
  $leaderU2 = $leaderboard | Where-Object { $_.nickname -eq $u2.nickname } | Select-Object -First 1

  if ($null -eq $leaderU1 -or $null -eq $leaderU2) {
    Add-Result -Name "leaderboard-members" -Passed $false -Detail "test users not found in leaderboard"
    throw "Missing users in leaderboard"
  }

  $rankOk = ([int]$leaderU1.total_points -ge [int]$leaderU2.total_points)
  Add-Result -Name "leaderboard-order" -Passed $rankOk -Detail "u1=$($leaderU1.total_points) u2=$($leaderU2.total_points)"

  $statsAfter = Invoke-Api -Method "GET" -Path "/api/bets/stats?room_id=$($room.id)" -Session $u1Session -Body $null
  Ensure-Success -Step "stats-after-finalize" -Result $statsAfter

  $matchStats = $statsAfter.body.data.($openMatch.id)
  if ($null -eq $matchStats) {
    Add-Result -Name "stats-match-entry" -Passed $false -Detail "missing stats for match"
  } else {
    $hasHomeQualifier = $matchStats.counts.PSObject.Properties.Name -contains $u1PredictedQualifier
    $hasDrawQualifier = $matchStats.counts.PSObject.Properties.Name -contains "DRAW"
    Add-Result -Name "stats-qualifiers" -Passed ($hasHomeQualifier -and $hasDrawQualifier) -Detail "u1Qualifier=$u1PredictedQualifier present=$hasHomeQualifier draw=$hasDrawQualifier"
  }

  $reFinalize = Invoke-Api -Method "POST" -Path "/api/matches/finalize" -Session $null -Body @{
    match_id = $openMatch.id
    home_score = 2
    away_score = 1
  } -ExpectedStatus 400

  if ($reFinalize.ok) {
    Add-Result -Name "refinalize-guard" -Passed $true -Detail "status 400 as expected"
  } else {
    Add-Result -Name "refinalize-guard" -Passed $false -Detail "expected status 400, got $($reFinalize.status)"
  }
} catch {
  Write-Host "Execution interrupted: $($_.Exception.Message)" -ForegroundColor Yellow
}

$passCount = @($results | Where-Object { $_.passed }).Count
$failCount = @($results | Where-Object { -not $_.passed }).Count
$totalCount = $results.Count

Write-Host ""
Write-Host "Summary: $passCount passed, $failCount failed, $totalCount total" -ForegroundColor Cyan

if ($failCount -gt 0) {
  exit 1
}

exit 0
