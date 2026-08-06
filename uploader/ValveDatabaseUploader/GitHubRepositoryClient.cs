using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ValveDatabaseUploader;

public sealed class GitHubRepositoryClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly AppConfig _config;

    public GitHubRepositoryClient(AppConfig config, string token)
    {
        _config = config;
        _http = new HttpClient { BaseAddress = new Uri("https://api.github.com/"), Timeout = TimeSpan.FromMinutes(3) };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("CVS-Controls-Valve-Database-Uploader/1.0");
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        _http.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
    }

    public async Task<string> TestConnectionAsync(CancellationToken token)
    {
        var response = await _http.GetAsync($"repos/{_config.RepositoryOwner}/{_config.RepositoryName}", token);
        await EnsureSuccess(response, "GitHub connection test", token);
        var root = await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: token);
        return root?["full_name"]?.GetValue<string>() ?? $"{_config.RepositoryOwner}/{_config.RepositoryName}";
    }

    public async Task TriggerPagesDeploymentAsync(CancellationToken token)
    {
        var payload = new JsonObject { ["event_type"] = "database-sync", ["client_payload"] = new JsonObject { ["branch"] = _config.Branch } };
        var response = await _http.PostAsJsonAsync($"repos/{_config.RepositoryOwner}/{_config.RepositoryName}/dispatches", payload, token);
        await EnsureSuccess(response, "start the website deployment", token);
    }

    public async Task<string> UploadDatabaseAndMetadataAsync(DatabaseKind kind, string snapshotPath, ValidationReport report, CancellationToken token)
    {
        var repositoryPath = kind == DatabaseKind.Hardware ? "client/public/data/active/hardware_configurator.db" : "client/public/data/active/manufacturing_log.db";
        var bytes = await File.ReadAllBytesAsync(snapshotPath, token);
        var fileName = Path.GetFileName(kind == DatabaseKind.Hardware ? _config.HardwareDatabasePath : _config.ManufacturingDatabasePath);
        string databaseSha = "";
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                databaseSha = await PutFileAsync(repositoryPath, bytes, $"Sync {fileName} from Windows uploader", token);
                await UpdateSettingsAsync(kind, fileName, bytes.LongLength, databaseSha, report, token);
                return databaseSha;
            }
            catch (GitHubConflictException) when (attempt < 3) { await Task.Delay(TimeSpan.FromSeconds(attempt * 2), token); }
        }
        throw new InvalidOperationException("GitHub changed repeatedly during synchronization. Try again in a moment.");
    }

    private async Task UpdateSettingsAsync(DatabaseKind kind, string fileName, long size, string databaseSha, ValidationReport report, CancellationToken token)
    {
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            var current = await GetFileAsync("client/public/data/settings.json", token);
            var settings = JsonNode.Parse(current.Bytes)!.AsObject();
            var sources = settings["databaseSources"]?.AsArray() ?? new JsonArray();
            settings["databaseSources"] = sources;
            var sourceType = kind == DatabaseKind.Hardware ? "hardware_configurator" : "manufacturing_log";
            foreach (var existing in sources.Where(node => node?["source_type"]?.GetValue<string>() == sourceType).ToArray()) sources.Remove(existing);
            var rowCounts = new JsonObject(); foreach (var pair in report.RowCounts) rowCounts[pair.Key] = pair.Value;
            sources.Add(new JsonObject
            {
                ["source_type"] = sourceType, ["original_file_name"] = fileName, ["file_size_bytes"] = size,
                ["uploaded_at"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), ["validation_status"] = "valid", ["sha"] = databaseSha,
                ["validationReport"] = new JsonObject { ["valid"] = true, ["sourceType"] = sourceType, ["integrityCheck"] = report.IntegrityCheck, ["rowCounts"] = rowCounts, ["issues"] = new JsonArray(), ["details"] = new JsonObject { ["windowsUploaderValidation"] = true } }
            });
            settings["updatedAt"] = DateTimeOffset.UtcNow.ToString("O");
            var audit = settings["auditLogs"]?.AsArray();
            audit?.Insert(0, new JsonObject { ["id"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), ["username"] = "Windows Uploader", ["action"] = "database.sync", ["entity_type"] = "database_source", ["details"] = JsonSerializer.Serialize(new { type = sourceType, name = fileName }), ["created_at"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") });
            while (audit?.Count > 200) audit.RemoveAt(audit.Count - 1);
            try { await PutFileAsync("client/public/data/settings.json", Encoding.UTF8.GetBytes(settings.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) + Environment.NewLine), $"Update {sourceType} sync metadata", token, current.Sha); return; }
            catch (GitHubConflictException) when (attempt < 3) { await Task.Delay(TimeSpan.FromSeconds(attempt * 2), token); }
        }
        throw new GitHubConflictException();
    }

    private async Task<(byte[] Bytes, string Sha)> GetFileAsync(string path, CancellationToken token)
    {
        var response = await _http.GetAsync($"repos/{_config.RepositoryOwner}/{_config.RepositoryName}/contents/{path}?ref={Uri.EscapeDataString(_config.Branch)}&v={Guid.NewGuid():N}", token);
        await EnsureSuccess(response, $"read {path}", token);
        var root = await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: token) ?? throw new InvalidDataException("GitHub returned an empty response.");
        return (Convert.FromBase64String((root["content"]?.GetValue<string>() ?? "").Replace("\n", "")), root["sha"]?.GetValue<string>() ?? throw new InvalidDataException("GitHub did not return a file SHA."));
    }

    private async Task<string> PutFileAsync(string path, byte[] bytes, string message, CancellationToken token, string? knownSha = null)
    {
        var sha = knownSha;
        if (sha is null) { try { sha = (await GetFileAsync(path, token)).Sha; } catch (GitHubNotFoundException) { } }
        var payload = new JsonObject { ["message"] = message, ["content"] = Convert.ToBase64String(bytes), ["branch"] = _config.Branch };
        if (sha is not null) payload["sha"] = sha;
        var response = await _http.PutAsJsonAsync($"repos/{_config.RepositoryOwner}/{_config.RepositoryName}/contents/{path}", payload, token);
        if ((int)response.StatusCode is 409 or 422) throw new GitHubConflictException();
        await EnsureSuccess(response, $"write {path}", token);
        var root = await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken: token);
        return root?["content"]?["sha"]?.GetValue<string>() ?? throw new InvalidDataException("GitHub did not return the uploaded file SHA.");
    }

    private static async Task EnsureSuccess(HttpResponseMessage response, string operation, CancellationToken token)
    {
        if (response.IsSuccessStatusCode) return;
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound) throw new GitHubNotFoundException();
        var body = await response.Content.ReadAsStringAsync(token);
        string? detail = null; try { detail = JsonNode.Parse(body)?["message"]?.GetValue<string>(); } catch { }
        throw new InvalidOperationException($"Could not {operation}: GitHub returned {(int)response.StatusCode} {detail ?? response.ReasonPhrase}. Check the token and Contents read/write permission.");
    }

    public void Dispose() => _http.Dispose();
    private sealed class GitHubConflictException : Exception;
    private sealed class GitHubNotFoundException : Exception;
}
