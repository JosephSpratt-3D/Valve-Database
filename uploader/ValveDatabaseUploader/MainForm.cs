using System.Diagnostics;

namespace ValveDatabaseUploader;

public sealed class MainForm : Form
{
    private static readonly Color Charcoal = Color.FromArgb(37, 36, 41), PanelColor = Color.FromArgb(47, 46, 51), FieldColor = Color.FromArgb(30, 30, 33), Teal = Color.FromArgb(7, 157, 170), Muted = Color.FromArgb(166, 173, 176), Border = Color.FromArgb(70, 69, 75);
    private readonly AppConfig _config = AppConfig.Load();
    private readonly SyncService _sync;
    private readonly TextBox _hardwarePath = new(), _manufacturingPath = new(), _owner = new(), _repository = new(), _branch = new();
    private readonly NumericUpDown _interval = new(), _stable = new();
    private readonly CheckBox _automatic = new(), _startup = new();
    private readonly Label _hardwareStatus = new(), _manufacturingStatus = new(), _globalStatus = new();
    private readonly Button _syncAllButton;
    private readonly System.Windows.Forms.Timer _timer = new();
    private readonly NotifyIcon _tray;
    private bool _exitRequested, _busy, _loading;

    public MainForm()
    {
        _sync = new SyncService(_config);
        _sync.StatusChanged += message => Ui(() => SetGlobalStatus(message, false));
        AppLog.Written += line => Debug.WriteLine(line);
        Text = "CVS Controls · Valve Database Uploader"; MinimumSize = new Size(920, 700); ClientSize = new Size(1080, 760); StartPosition = FormStartPosition.CenterScreen; BackColor = Charcoal; ForeColor = Color.White; Font = new Font("Segoe UI", 9);
        Icon = Icon.ExtractAssociatedIcon(Environment.ProcessPath!) ?? SystemIcons.Application;

        var root = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1 };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 255)); root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        root.Controls.Add(BuildSidebar(), 0, 0); root.Controls.Add(BuildContent(), 1, 0); Controls.Add(root);
        _syncAllButton = FindControl<Button>(this, "syncAll")!;

        _tray = new NotifyIcon { Icon = Icon, Text = "CVS Controls Valve Database Uploader", Visible = true };
        var trayMenu = new ContextMenuStrip(); trayMenu.Items.Add("Open", null, (_, _) => RestoreWindow()); trayMenu.Items.Add("Sync now", null, async (_, _) => await RunSyncAllAsync(true)); trayMenu.Items.Add(new ToolStripSeparator()); trayMenu.Items.Add("Exit", null, (_, _) => { _exitRequested = true; Close(); });
        _tray.ContextMenuStrip = trayMenu; _tray.DoubleClick += (_, _) => RestoreWindow();
        _timer.Tick += async (_, _) => { if (_config.AutomaticSync) await RunSyncAllAsync(false); };
        FormClosing += OnClosing; Resize += (_, _) => { if (WindowState == FormWindowState.Minimized) HideToTray(); };
        Shown += async (_, _) => { LoadConfigIntoControls(); RestartTimer(); if (Environment.GetCommandLineArgs().Contains("--minimized")) HideToTray(); if (_config.AutomaticSync) await RunSyncAllAsync(false); };
    }

    private Control BuildSidebar()
    {
        var panel = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(54, 53, 58), Padding = new Padding(22) };
        var logoPanel = new Panel { Dock = DockStyle.Top, Height = 150, BackColor = Color.White, Padding = new Padding(14) };
        var logo = new PictureBox { Dock = DockStyle.Fill, SizeMode = PictureBoxSizeMode.Zoom, Image = LoadLogo() };
        logoPanel.Controls.Add(logo);
        var product = new Label { Dock = DockStyle.Top, Height = 56, Text = "VALVE DATABASE\nUPLOADER", Font = new Font("Segoe UI", 10, FontStyle.Bold), ForeColor = Color.White, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(2, 14, 0, 0) };
        var description = new Label { Dock = DockStyle.Top, Height = 120, Text = "Safely validates and synchronizes the hardware and manufacturing SQLite databases with the Valve Database Viewer.", ForeColor = Muted, Font = new Font("Segoe UI", 9), Padding = new Padding(2, 12, 4, 0) };
        var privacy = new Label { Dock = DockStyle.Bottom, Height = 72, Text = "TOKEN STORAGE\nWindows Credential Manager", ForeColor = Color.FromArgb(113, 215, 222), Font = new Font("Segoe UI", 8, FontStyle.Bold), Padding = new Padding(2, 12, 0, 0) };
        panel.Controls.Add(privacy); panel.Controls.Add(description); panel.Controls.Add(product); panel.Controls.Add(logoPanel); return panel;
    }

    private Control BuildContent()
    {
        var scroll = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Padding = new Padding(30, 24, 30, 30) };
        var content = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 1, RowCount = 8 };
        var title = new Label { Text = "Database synchronization", AutoSize = true, Font = new Font("Segoe UI", 22, FontStyle.Bold), Margin = new Padding(0, 0, 0, 4) };
        var subtitle = new Label { Text = "Select the live database files, validate them, and keep GitHub Pages current.", AutoSize = true, ForeColor = Muted, Margin = new Padding(0, 0, 0, 22) };
        content.Controls.Add(title); content.Controls.Add(subtitle);
        content.Controls.Add(DatabaseCard("Hardware database", "Valve configuration, actuator, and bracket source", _hardwarePath, _hardwareStatus, DatabaseKind.Hardware));
        content.Controls.Add(DatabaseCard("Manufacturing log", "Manufacturing history and job source", _manufacturingPath, _manufacturingStatus, DatabaseKind.Manufacturing));
        content.Controls.Add(GitHubCard()); content.Controls.Add(AutomationCard());

        var footer = new Panel { Height = 74, Dock = DockStyle.Top, Margin = new Padding(0, 10, 0, 0) };
        _globalStatus.AutoSize = false; _globalStatus.Location = new Point(0, 10); _globalStatus.Size = new Size(480, 48); _globalStatus.Text = "Ready"; _globalStatus.ForeColor = Muted; _globalStatus.TextAlign = ContentAlignment.MiddleLeft;
        var sync = StyledButton("Sync both now", true); sync.Name = "syncAll"; sync.Size = new Size(160, 44); sync.Anchor = AnchorStyles.Top | AnchorStyles.Right; sync.Location = new Point(570, 10); sync.Click += async (_, _) => await RunSyncAllAsync(true);
        footer.Resize += (_, _) => sync.Left = footer.ClientSize.Width - sync.Width;
        footer.Controls.Add(_globalStatus); footer.Controls.Add(sync); content.Controls.Add(footer);
        scroll.Controls.Add(content); scroll.Resize += (_, _) => content.Width = Math.Max(700, scroll.ClientSize.Width - 6); return scroll;
    }

    private Control DatabaseCard(string title, string subtitle, TextBox pathBox, Label status, DatabaseKind kind)
    {
        StyleTextBox(pathBox); pathBox.Dock = DockStyle.Fill;
        var card = Card(174); var inner = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 4 };
        inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 100)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 105));
        var heading = new Label { Text = title, AutoSize = true, Font = new Font("Segoe UI", 12, FontStyle.Bold), Margin = new Padding(0, 0, 0, 2) };
        var copy = new Label { Text = subtitle, AutoSize = true, ForeColor = Muted, Margin = new Padding(0, 0, 0, 12) };
        inner.Controls.Add(heading, 0, 0); inner.SetColumnSpan(heading, 3); inner.Controls.Add(copy, 0, 1); inner.SetColumnSpan(copy, 3);
        inner.Controls.Add(pathBox, 0, 2);
        var browse = StyledButton("Browse…", false); browse.Dock = DockStyle.Fill; browse.Margin = new Padding(8, 0, 0, 0); browse.Click += (_, _) => SelectDatabase(pathBox); inner.Controls.Add(browse, 1, 2);
        var validate = StyledButton("Validate", false); validate.Dock = DockStyle.Fill; validate.Margin = new Padding(8, 0, 0, 0); validate.Click += async (_, _) => await ValidateAsync(kind); inner.Controls.Add(validate, 2, 2);
        status.Text = "Not checked"; status.ForeColor = Muted; status.AutoSize = true; status.Margin = new Padding(0, 12, 0, 0); inner.Controls.Add(status, 0, 3); inner.SetColumnSpan(status, 3);
        card.Controls.Add(inner); return card;
    }

    private Control GitHubCard()
    {
        var card = Card(188); var inner = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 4 };
        inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 48)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 32)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 20)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
        var heading = new Label { Text = "GitHub connection", AutoSize = true, Font = new Font("Segoe UI", 12, FontStyle.Bold) }; inner.Controls.Add(heading, 0, 0); inner.SetColumnSpan(heading, 4);
        AddField(inner, "Owner", _owner, 0, 1); AddField(inner, "Repository", _repository, 1, 1); AddField(inner, "Branch", _branch, 2, 1);
        var token = StyledButton("Set token", true); token.Dock = DockStyle.Bottom; token.Margin = new Padding(8, 20, 0, 0); token.Click += (_, _) => SetToken(); inner.Controls.Add(token, 3, 1);
        var hint = new Label { Text = "Fine-grained token · selected repository only · Contents read/write", AutoSize = true, ForeColor = Muted, Margin = new Padding(0, 12, 0, 0) }; inner.Controls.Add(hint, 0, 3); inner.SetColumnSpan(hint, 3);
        var test = StyledButton("Test connection", false); test.Dock = DockStyle.Fill; test.Margin = new Padding(8, 10, 0, 0); test.Click += async (_, _) => await TestConnectionAsync(); inner.Controls.Add(test, 3, 3); card.Controls.Add(inner); return card;
    }

    private Control AutomationCard()
    {
        var card = Card(154); var inner = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 4, RowCount = 3 };
        inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24)); inner.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 10));
        var heading = new Label { Text = "Automatic synchronization", AutoSize = true, Font = new Font("Segoe UI", 12, FontStyle.Bold) }; inner.Controls.Add(heading, 0, 0); inner.SetColumnSpan(heading, 4);
        _automatic.Text = "Enable automatic sync"; StyleCheck(_automatic); _automatic.CheckedChanged += (_, _) => { if (!_loading) SaveControls(); }; inner.Controls.Add(_automatic, 0, 1);
        AddNumericField(inner, "Check every (minutes)", _interval, 1); _interval.Minimum = 1; _interval.Maximum = 1440;
        AddNumericField(inner, "Stable for (seconds)", _stable, 2); _stable.Minimum = 10; _stable.Maximum = 3600;
        _startup.Text = "Start with Windows"; StyleCheck(_startup); _startup.CheckedChanged += (_, _) => { if (!_loading) SaveControls(); }; inner.Controls.Add(_startup, 0, 2);
        var log = StyledButton("Open log", false); log.AutoSize = true; log.Margin = new Padding(0, 10, 0, 0); log.Click += (_, _) => { Directory.CreateDirectory(AppConfig.DataDirectory); if (!File.Exists(AppConfig.LogPath)) File.WriteAllText(AppConfig.LogPath, ""); Process.Start(new ProcessStartInfo(AppConfig.LogPath) { UseShellExecute = true }); }; inner.Controls.Add(log, 3, 2); card.Controls.Add(inner); return card;
    }

    private Panel Card(int height) => new() { Dock = DockStyle.Top, Height = height, BackColor = PanelColor, Padding = new Padding(20), Margin = new Padding(0, 0, 0, 14) };
    private static void StyleTextBox(TextBox box) { box.BackColor = FieldColor; box.ForeColor = Color.White; box.BorderStyle = BorderStyle.FixedSingle; box.Font = new Font("Segoe UI", 9); box.Margin = new Padding(0, 4, 0, 0); }
    private static void StyleCheck(CheckBox box) { box.ForeColor = Color.White; box.AutoSize = true; box.Margin = new Padding(0, 16, 0, 0); }
    private static Button StyledButton(string text, bool primary) => new() { Text = text, FlatStyle = FlatStyle.Flat, BackColor = primary ? Teal : Color.FromArgb(58, 57, 62), ForeColor = Color.White, FlatAppearance = { BorderColor = primary ? Teal : Border }, Cursor = Cursors.Hand, Padding = new Padding(8, 4, 8, 4) };
    private static void AddField(TableLayoutPanel panel, string label, TextBox box, int column, int row) { var wrapper = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 2, Margin = new Padding(0, 10, 8, 0) }; wrapper.Controls.Add(new Label { Text = label.ToUpperInvariant(), AutoSize = true, ForeColor = Muted, Font = new Font("Segoe UI", 8, FontStyle.Bold) }); StyleTextBox(box); box.Dock = DockStyle.Fill; wrapper.Controls.Add(box); panel.Controls.Add(wrapper, column, row); }
    private static void AddNumericField(TableLayoutPanel panel, string label, NumericUpDown input, int column) { var wrapper = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 2, Margin = new Padding(8, 8, 0, 0) }; wrapper.Controls.Add(new Label { Text = label.ToUpperInvariant(), AutoSize = true, ForeColor = Muted, Font = new Font("Segoe UI", 8, FontStyle.Bold) }); input.BackColor = FieldColor; input.ForeColor = Color.White; input.BorderStyle = BorderStyle.FixedSingle; input.Dock = DockStyle.Top; input.ValueChanged += (_, _) => { }; wrapper.Controls.Add(input); panel.Controls.Add(wrapper, column, 1); }

    private void LoadConfigIntoControls()
    {
        _loading = true;
        _hardwarePath.Text = _config.HardwareDatabasePath; _manufacturingPath.Text = _config.ManufacturingDatabasePath; _owner.Text = _config.RepositoryOwner; _repository.Text = _config.RepositoryName; _branch.Text = _config.Branch;
        _interval.Value = Math.Clamp(_config.CheckIntervalMinutes, 1, 1440); _stable.Value = Math.Clamp(_config.StableSeconds, 10, 3600); _automatic.Checked = _config.AutomaticSync; _startup.Checked = _config.StartWithWindows;
        _loading = false;
        UpdateLastStatuses();
    }

    private void SaveControls()
    {
        _config.HardwareDatabasePath = _hardwarePath.Text.Trim(); _config.ManufacturingDatabasePath = _manufacturingPath.Text.Trim(); _config.RepositoryOwner = _owner.Text.Trim(); _config.RepositoryName = _repository.Text.Trim(); _config.Branch = _branch.Text.Trim();
        _config.CheckIntervalMinutes = (int)_interval.Value; _config.StableSeconds = (int)_stable.Value; _config.AutomaticSync = _automatic.Checked;
        try { if (_config.StartWithWindows != _startup.Checked) StartupManager.SetEnabled(_startup.Checked); _config.StartWithWindows = _startup.Checked; } catch (Exception exception) { MessageBox.Show(this, exception.Message, "Startup setting", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        _config.Save(); RestartTimer();
    }

    private async Task RunSyncAllAsync(bool force)
    {
        if (_busy) return; SaveControls(); SetBusy(true); SetGlobalStatus("Preparing synchronization…", false);
        try
        {
            var results = await _sync.SyncAllAsync(force);
            UpdateLastStatuses();
            foreach (var result in results) { StatusLabel(result.Kind).Text = result.Message; StatusLabel(result.Kind).ForeColor = result.Message.Contains("failed", StringComparison.OrdinalIgnoreCase) ? Color.FromArgb(255, 155, 144) : Muted; }
            var errors = results.Where(result => !result.Uploaded && result.Message.Contains("failed", StringComparison.OrdinalIgnoreCase)).ToArray();
            SetGlobalStatus(errors.Length == 0 ? "Synchronization check complete." : "One or more databases could not be synchronized.", errors.Length > 0);
        }
        finally { SetBusy(false); }
    }

    private async Task ValidateAsync(DatabaseKind kind)
    {
        if (_busy) return; SaveControls(); SetBusy(true);
        try { var result = await _sync.ValidateOnlyAsync(kind); StatusLabel(kind).Text = result.Message; StatusLabel(kind).ForeColor = Color.FromArgb(113, 215, 222); }
        catch (Exception exception) { StatusLabel(kind).Text = exception.Message; StatusLabel(kind).ForeColor = Color.FromArgb(255, 155, 144); }
        finally { SetBusy(false); }
    }

    private async Task TestConnectionAsync()
    {
        SaveControls(); SetBusy(true);
        try { var repository = await _sync.TestGitHubAsync(); SetGlobalStatus($"Connected to {repository}.", false); }
        catch (Exception exception) { SetGlobalStatus(exception.Message, true); }
        finally { SetBusy(false); }
    }

    private void SetToken()
    {
        using var dialog = new TokenDialog();
        if (dialog.ShowDialog(this) != DialogResult.OK || string.IsNullOrWhiteSpace(dialog.Token)) return;
        try { CredentialStore.Save(dialog.Token); SetGlobalStatus("GitHub token saved securely in Windows Credential Manager.", false); }
        catch (Exception exception) { SetGlobalStatus(exception.Message, true); }
    }

    private void SelectDatabase(TextBox target)
    {
        using var dialog = new OpenFileDialog { Filter = "SQLite databases (*.db;*.sqlite;*.sqlite3)|*.db;*.sqlite;*.sqlite3|All files (*.*)|*.*", CheckFileExists = true, Title = "Select SQLite database" };
        if (File.Exists(target.Text)) dialog.InitialDirectory = Path.GetDirectoryName(target.Text);
        if (dialog.ShowDialog(this) == DialogResult.OK) { target.Text = dialog.FileName; SaveControls(); }
    }

    private void UpdateLastStatuses()
    {
        if (_config.LastHardwareUpload is not null) { _hardwareStatus.Text = $"Last uploaded {_config.LastHardwareUpload:MMM d, yyyy · h:mm tt}"; _hardwareStatus.ForeColor = Color.FromArgb(113, 215, 222); }
        if (_config.LastManufacturingUpload is not null) { _manufacturingStatus.Text = $"Last uploaded {_config.LastManufacturingUpload:MMM d, yyyy · h:mm tt}"; _manufacturingStatus.ForeColor = Color.FromArgb(113, 215, 222); }
    }

    private void SetBusy(bool value) { _busy = value; _syncAllButton.Enabled = !value; UseWaitCursor = value; }
    private void SetGlobalStatus(string text, bool error) { _globalStatus.Text = text; _globalStatus.ForeColor = error ? Color.FromArgb(255, 155, 144) : Muted; }
    private Label StatusLabel(DatabaseKind kind) => kind == DatabaseKind.Hardware ? _hardwareStatus : _manufacturingStatus;
    private void RestartTimer() { _timer.Stop(); _timer.Interval = Math.Max(1, _config.CheckIntervalMinutes) * 60 * 1000; if (_config.AutomaticSync) _timer.Start(); }
    private void HideToTray() { Hide(); _tray.ShowBalloonTip(1500, "Valve Database Uploader", "Synchronization continues in the background.", ToolTipIcon.Info); }
    private void RestoreWindow() { Show(); WindowState = FormWindowState.Normal; Activate(); }
    private void OnClosing(object? sender, FormClosingEventArgs eventArgs) { SaveControls(); if (!_exitRequested && _config.AutomaticSync && eventArgs.CloseReason == CloseReason.UserClosing) { eventArgs.Cancel = true; HideToTray(); } else { _timer.Stop(); _tray.Visible = false; } }
    private void Ui(Action action) { if (IsDisposed) return; if (InvokeRequired) BeginInvoke(action); else action(); }
    private static T? FindControl<T>(Control root, string name) where T : Control { foreach (Control child in root.Controls) { if (child is T match && match.Name == name) return match; var nested = FindControl<T>(child, name); if (nested is not null) return nested; } return null; }
    private static Image? LoadLogo() { using var stream = typeof(MainForm).Assembly.GetManifestResourceStream("ValveDatabaseUploader.Assets.cvs-controls-logo.png"); if (stream is null) return null; using var image = Image.FromStream(stream); return new Bitmap(image); }
}
