' Smart Studio Presenter Pro - Silent Native Desktop Launcher
' Runs the background offline server silently (no command prompt window) and launches in Full App mode
Option Explicit

Dim WshShell, fso, strDir, intReturn, edgePath, edgePath64, chromePath, chromePathUser

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if port 5173 is already running
intReturn = WshShell.Run("cmd /c netstat -ano | findstr :5173", 0, True)

If intReturn <> 0 Then
    ' Start preview server silently in background (0 = hidden, no console window)
    WshShell.CurrentDirectory = strDir
    WshShell.Run "cmd /c npx vite preview --port 5173 --host", 0, False
    WScript.Sleep 1800
End If

' Search for Edge or Chrome application paths
edgePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe")
edgePath64 = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Microsoft\Edge\Application\msedge.exe")
chromePath = WshShell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
chromePathUser = WshShell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")

If fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=http://localhost:5173/ --start-maximized", 1, False
ElseIf fso.FileExists(edgePath64) Then
    WshShell.Run """" & edgePath64 & """ --app=http://localhost:5173/ --start-maximized", 1, False
ElseIf fso.FileExists(chromePath) Then
    WshShell.Run """" & chromePath & """ --app=http://localhost:5173/ --start-maximized", 1, False
ElseIf fso.FileExists(chromePathUser) Then
    WshShell.Run """" & chromePathUser & """ --app=http://localhost:5173/ --start-maximized", 1, False
Else
    WshShell.Run "http://localhost:5173/", 1, False
End If
