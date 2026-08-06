using Microsoft.Win32;

namespace ValveDatabaseUploader;

public static class StartupManager
{
    private const string KeyName = "CVS Controls Valve Database Uploader";
    public static void SetEnabled(bool enabled)
    {
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true) ?? throw new InvalidOperationException("Windows startup settings are unavailable.");
        if (enabled) key.SetValue(KeyName, $"\"{Environment.ProcessPath}\" --minimized"); else key.DeleteValue(KeyName, false);
    }
}
