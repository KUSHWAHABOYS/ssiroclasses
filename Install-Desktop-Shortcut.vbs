' Smart Studio Presenter Pro - Desktop Shortcut Creator
Option Explicit

Dim WshShell, fso, desktopPath, shortcut, scriptDir, iconPath, vbsTarget

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = WshShell.SpecialFolders("Desktop")
iconPath = scriptDir & "\public\favicon.ico"
vbsTarget = scriptDir & "\Launch-Smart-Studio.vbs"

Set shortcut = WshShell.CreateShortcut(desktopPath & "\Smart Studio Presenter Pro.lnk")
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & vbsTarget & """"
shortcut.WorkingDirectory = scriptDir
shortcut.IconLocation = iconPath & ", 0"
shortcut.Description = "Smart Studio Presenter Pro (SSIRO Classes) - 4K Teaching Studio"
shortcut.WindowStyle = 1
shortcut.Save

WScript.Echo "Desktop shortcut created successfully on your Desktop: Smart Studio Presenter Pro"
