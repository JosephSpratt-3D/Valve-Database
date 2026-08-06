using System.Text.Json;

namespace ValveDatabaseUploader;

public sealed class AppConfig
{
    public string HardwareDatabasePath { get; set; } = @"C:\Users\Joseph\OneDrive - CVS Controls\Documents\Hardware Configurator\SOURCE FILES\Addin\Valve Configuration\hardware_configurator.db";
    public string ManufacturingDatabasePath { get; set; } = @"C:\Users\Joseph\OneDrive - CVS Controls\Documents\Hardware Configurator\SOURCE FILES\Addin\MFG\manufacturing_log.db";
    public string RepositoryOwner { get; set; } = "JosephSpratt-3D";
    public string RepositoryName { get; set; } = "Valve-Database";
    public string Branch { get; set; } = "main";
    public int CheckIntervalMinutes { get; set; } = 5;
    public int StableSeconds { get; set; } = 60;
    public bool AutomaticSync { get; set; }
    public bool StartWithWindows { get; set; }
    public string? LastHardwareHash { get; set; }
    public string? LastManufacturingHash { get; set; }
    public DateTimeOffset? LastHardwareUpload { get; set; }
    public DateTimeOffset? LastManufacturingUpload { get; set; }

    public static string DataDirectory => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CVS Controls", "Valve Database Uploader");
    public static string ConfigPath => Path.Combine(DataDirectory, "config.json");
    public static string LogPath => Path.Combine(DataDirectory, "uploader.log");

    public static AppConfig Load()
    {
        Directory.CreateDirectory(DataDirectory);
        try { return File.Exists(ConfigPath) ? JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(ConfigPath)) ?? new() : new(); }
        catch { return new(); }
    }

    public void Save()
    {
        Directory.CreateDirectory(DataDirectory);
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
    }
}
