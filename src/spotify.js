import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// reads the active media session via Windows SMTC and dumps it as JSON.
// written to a temp file at runtime to dodge shell-quoting issues on Windows.
const PS_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]

function Await-Operation($op, $resultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  return $task.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

try {
  $managerOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
  $manager = Await-Operation $managerOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

  $session = $manager.GetCurrentSession()
  if ($null -eq $session) {
    Write-Output (@{ playing = $false } | ConvertTo-Json)
    exit
  }

  $appId = $session.SourceAppUserModelId
  $propsOp = $session.TryGetMediaPropertiesAsync()
  $props = Await-Operation $propsOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])

  $timeline = $session.GetTimelineProperties()
  $playback = $session.GetPlaybackInfo()

  $now = [DateTimeOffset]::Now
  $isPlaying = ($playback.PlaybackStatus -eq 4)
  $elapsedSinceUpdate = if ($isPlaying) { ($now - $timeline.LastUpdatedTime).TotalMilliseconds } else { 0 }

  $result = @{
    playing              = $isPlaying
    appId                = $appId
    title                = $props.Title
    artist               = $props.Artist
    positionMs           = [Math]::Round($timeline.Position.TotalMilliseconds)
    durationMs           = [Math]::Round($timeline.EndTime.TotalMilliseconds)
    elapsedSinceUpdateMs = [Math]::Round($elapsedSinceUpdate)
  }

  Write-Output ($result | ConvertTo-Json)
} catch {
  Write-Output (@{ playing = $false; error = $_.Exception.Message } | ConvertTo-Json)
}
`;

/**
 * Reads the currently playing track from Windows SMTC.
 * Returns null if nothing is playing, the session isn't Spotify, or it fails.
 */
export async function getCurrentTrack() {
  let tmpDir;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "dls-"));
    const scriptPath = join(tmpDir, "smtc.ps1");
    await writeFile(scriptPath, PS_SCRIPT, "utf-8");

    const { stdout } = await execAsync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { maxBuffer: 1024 * 1024 },
    );

    const data = JSON.parse(stdout.trim());
    if (!data.playing) return null;

    // ignore non-Spotify sessions (system sounds, other media players, etc)
    if (data.appId && !data.appId.toLowerCase().includes("spotify")) return null;

    return {
      title:                data.title,
      artist:               data.artist,
      positionMs:           data.positionMs,
      durationMs:           data.durationMs,
      elapsedSinceUpdateMs: data.elapsedSinceUpdateMs || 0,
    };
  } catch (err) {
    console.error("Failed to read SMTC data:", err.message);
    return null;
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
