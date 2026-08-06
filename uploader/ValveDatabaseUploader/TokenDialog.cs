namespace ValveDatabaseUploader;

public sealed class TokenDialog : Form
{
    private readonly TextBox _token = new() { UseSystemPasswordChar = true, Dock = DockStyle.Top, Margin = new Padding(0, 8, 0, 18) };
    public string Token => _token.Text.Trim();

    public TokenDialog()
    {
        Text = "GitHub connection"; StartPosition = FormStartPosition.CenterParent; ClientSize = new Size(520, 245); BackColor = Color.FromArgb(37, 36, 41); ForeColor = Color.White; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false;
        var panel = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(28), RowCount = 5, ColumnCount = 1 };
        panel.Controls.Add(new Label { Text = "FINE-GRAINED GITHUB TOKEN", AutoSize = true, ForeColor = Color.FromArgb(8, 166, 179), Font = new Font("Segoe UI", 9, FontStyle.Bold) });
        panel.Controls.Add(new Label { Text = "Use a token limited to JosephSpratt-3D/Valve-Database with Contents read/write permission. It will be saved in Windows Credential Manager.", AutoSize = true, MaximumSize = new Size(450, 0), ForeColor = Color.FromArgb(190, 195, 197), Margin = new Padding(0, 8, 0, 8) });
        StyleTextBox(_token); panel.Controls.Add(_token);
        var buttons = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, Dock = DockStyle.Fill, AutoSize = true };
        var save = Button("Save token", true); save.DialogResult = DialogResult.OK;
        var cancel = Button("Cancel", false); cancel.DialogResult = DialogResult.Cancel;
        buttons.Controls.Add(save); buttons.Controls.Add(cancel); panel.Controls.Add(buttons);
        Controls.Add(panel); AcceptButton = save; CancelButton = cancel;
    }

    private static void StyleTextBox(TextBox box) { box.BackColor = Color.FromArgb(28, 28, 31); box.ForeColor = Color.White; box.BorderStyle = BorderStyle.FixedSingle; box.Font = new Font("Segoe UI", 10); }
    private static Button Button(string text, bool primary) => new() { Text = text, AutoSize = true, Padding = new Padding(12, 6, 12, 6), FlatStyle = FlatStyle.Flat, BackColor = primary ? Color.FromArgb(7, 157, 170) : Color.FromArgb(55, 54, 59), ForeColor = Color.White, Margin = new Padding(8) };
}
