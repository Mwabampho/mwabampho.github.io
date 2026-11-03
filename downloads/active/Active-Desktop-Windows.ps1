Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Active Desktop" Width="1180" Height="760"
        MinWidth="900" MinHeight="600"
        WindowStartupLocation="CenterScreen"
        Background="#EEF2F5" FontFamily="Segoe UI">
  <Grid>
    <Grid.ColumnDefinitions>
      <ColumnDefinition Width="365"/>
      <ColumnDefinition Width="*"/>
    </Grid.ColumnDefinitions>

    <Grid Grid.Column="0" Background="#122025">
      <Grid.RowDefinitions>
        <RowDefinition Height="72"/>
        <RowDefinition Height="58"/>
        <RowDefinition Height="*"/>
      </Grid.RowDefinitions>

      <Border Grid.Row="0" Background="#1F3036">
        <Grid Margin="22,0">
          <TextBlock Text="ACTIVE" Foreground="#25D366" FontWeight="Bold" FontSize="24" VerticalAlignment="Center"/>
          <TextBlock Text="●   +" Foreground="#DCE4E6" FontSize="20" HorizontalAlignment="Right" VerticalAlignment="Center"/>
        </Grid>
      </Border>

      <Border Grid.Row="1" Margin="18,10,18,8" CornerRadius="18" Background="#2B393E">
        <TextBox x:Name="SearchBox" Text="Search chats" Foreground="#A4B2B8" Background="Transparent"
                 BorderThickness="0" VerticalContentAlignment="Center" Padding="16,0" FontSize="14"/>
      </Border>

      <ListBox x:Name="ChatList" Grid.Row="2" Background="Transparent" BorderThickness="0"
               Foreground="White" ScrollViewer.HorizontalScrollBarVisibility="Disabled">
        <ListBox.Resources>
          <Style TargetType="ListBoxItem">
            <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
            <Setter Property="Padding" Value="0"/>
            <Setter Property="Margin" Value="0"/>
            <Setter Property="Background" Value="Transparent"/>
            <Setter Property="Template">
              <Setter.Value>
                <ControlTemplate TargetType="ListBoxItem">
                  <Border x:Name="Bd" Background="{TemplateBinding Background}" Padding="18,11">
                    <ContentPresenter/>
                  </Border>
                  <ControlTemplate.Triggers>
                    <Trigger Property="IsSelected" Value="True">
                      <Setter TargetName="Bd" Property="Background" Value="#2B393E"/>
                    </Trigger>
                    <Trigger Property="IsMouseOver" Value="True">
                      <Setter TargetName="Bd" Property="Background" Value="#243238"/>
                    </Trigger>
                  </ControlTemplate.Triggers>
                </ControlTemplate>
              </Setter.Value>
            </Setter>
          </Style>
        </ListBox.Resources>
      </ListBox>
    </Grid>

    <Grid Grid.Column="1">
      <Grid.RowDefinitions>
        <RowDefinition Height="72"/>
        <RowDefinition Height="*"/>
        <RowDefinition Height="82"/>
      </Grid.RowDefinitions>

      <Border Grid.Row="0" Background="#F7F9FA" BorderBrush="#DCE3E6" BorderThickness="0,0,0,1">
        <Grid Margin="22,0">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="52"/>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="120"/>
          </Grid.ColumnDefinitions>
          <Border Width="46" Height="46" CornerRadius="23" Background="#25D366" VerticalAlignment="Center">
            <TextBlock x:Name="HeaderInitial" Text="A" Foreground="#122025" FontWeight="Bold" FontSize="20"
                       HorizontalAlignment="Center" VerticalAlignment="Center"/>
          </Border>
          <StackPanel Grid.Column="1" Margin="14,0,0,0" VerticalAlignment="Center">
            <TextBlock x:Name="HeaderName" Text="Active Team" FontWeight="SemiBold" FontSize="18" Foreground="#1F2D32"/>
            <TextBlock Text="Active now" FontSize="12" Foreground="#3EAA6B" Margin="0,3,0,0"/>
          </StackPanel>
          <TextBlock Grid.Column="2" Text="☎    ⋯" Foreground="#526269" FontSize="20"
                     HorizontalAlignment="Right" VerticalAlignment="Center"/>
        </Grid>
      </Border>

      <ScrollViewer x:Name="MessageScroll" Grid.Row="1" VerticalScrollBarVisibility="Auto" Background="#EEF2F5">
        <StackPanel x:Name="MessagesPanel" Margin="28,28,28,20"/>
      </ScrollViewer>

      <Border Grid.Row="2" Background="#F7F9FA" BorderBrush="#DCE3E6" BorderThickness="0,1,0,0">
        <Grid Margin="20,14">
          <Grid.ColumnDefinitions>
            <ColumnDefinition Width="42"/>
            <ColumnDefinition Width="*"/>
            <ColumnDefinition Width="72"/>
          </Grid.ColumnDefinitions>
          <TextBlock Text="＋" FontSize="25" Foreground="#596A70" VerticalAlignment="Center"/>
          <Border Grid.Column="1" CornerRadius="24" Background="White" BorderBrush="#E1E6E8" BorderThickness="1">
            <TextBox x:Name="Composer" Background="Transparent" BorderThickness="0" Padding="16,0"
                     VerticalContentAlignment="Center" FontSize="15" Foreground="#1E2B30"/>
          </Border>
          <Button x:Name="SendButton" Grid.Column="2" Width="58" Height="50" HorizontalAlignment="Right"
                  Background="#25D366" Foreground="#122025" BorderThickness="0" FontWeight="Bold" FontSize="19"
                  Content="➤"/>
        </Grid>
      </Border>
    </Grid>
  </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

$chatList = $window.FindName("ChatList")
$messagesPanel = $window.FindName("MessagesPanel")
$composer = $window.FindName("Composer")
$sendButton = $window.FindName("SendButton")
$headerName = $window.FindName("HeaderName")
$headerInitial = $window.FindName("HeaderInitial")
$messageScroll = $window.FindName("MessageScroll")

$chats = @(
  @{ Name="Active Team"; Preview="Welcome to Active."; Time="Now" },
  @{ Name="Maya"; Preview="I’ll send the photos tonight."; Time="18:42" },
  @{ Name="Jordan"; Preview="Perfect, see you tomorrow."; Time="17:26" },
  @{ Name="Family"; Preview="Dinner is at 8 👌"; Time="16:03" },
  @{ Name="Studio"; Preview="New mix is ready to review."; Time="Yesterday" },
  @{ Name="Alex"; Preview="That works for me."; Time="Yesterday" }
)

$allMessages = @(
  [System.Collections.ArrayList]@(
    @{ Text="Welcome to Active — your conversations, on your computer."; Mine=$false; Time="18:31" },
    @{ Text="Desktop is looking clean."; Mine=$true; Time="18:33" },
    @{ Text="It is. Fast, focused and familiar."; Mine=$false; Time="18:34" }
  ),
  [System.Collections.ArrayList]@(
    @{ Text="Hey — are you free later?"; Mine=$false; Time="18:36" },
    @{ Text="Yeah, after 8 works."; Mine=$true; Time="18:39" },
    @{ Text="I’ll send the photos tonight."; Mine=$false; Time="18:42" }
  ),
  [System.Collections.ArrayList]@(
    @{ Text="Desktop build is ready to test."; Mine=$true; Time="17:21" },
    @{ Text="Perfect, see you tomorrow."; Mine=$false; Time="17:26" }
  ),
  [System.Collections.ArrayList]@(
    @{ Text="Dinner is at 8 👌"; Mine=$false; Time="16:03" }
  ),
  [System.Collections.ArrayList]@(
    @{ Text="New mix is ready to review."; Mine=$false; Time="Yesterday" }
  ),
  [System.Collections.ArrayList]@(
    @{ Text="That works for me."; Mine=$false; Time="Yesterday" }
  )
)

function New-ChatRow($chat) {
  $grid = New-Object Windows.Controls.Grid
  $grid.Height = 58
  $avatar = New-Object Windows.Controls.Border
  $avatar.Width=46; $avatar.Height=46; $avatar.CornerRadius=23; $avatar.Background="#25D366"
  $avatar.HorizontalAlignment="Left"
  $initial = New-Object Windows.Controls.TextBlock
  $initial.Text=$chat.Name.Substring(0,1); $initial.Foreground="#122025"; $initial.FontWeight="Bold"
  $initial.FontSize=18; $initial.HorizontalAlignment="Center"; $initial.VerticalAlignment="Center"
  $avatar.Child=$initial
  $grid.Children.Add($avatar) | Out-Null

  $name = New-Object Windows.Controls.TextBlock
  $name.Text=$chat.Name; $name.Foreground="#F5F7F8"; $name.FontWeight="SemiBold"; $name.FontSize=16
  $name.Margin="62,2,74,0"; $name.VerticalAlignment="Top"
  $grid.Children.Add($name) | Out-Null

  $preview = New-Object Windows.Controls.TextBlock
  $preview.Text=$chat.Preview; $preview.Foreground="#B1BEC3"; $preview.FontSize=12
  $preview.Margin="62,28,70,0"; $preview.VerticalAlignment="Top"
  $grid.Children.Add($preview) | Out-Null

  $time = New-Object Windows.Controls.TextBlock
  $time.Text=$chat.Time; $time.Foreground="#81969D"; $time.FontSize=10
  $time.HorizontalAlignment="Right"; $time.VerticalAlignment="Top"; $time.Margin="0,4,0,0"
  $grid.Children.Add($time) | Out-Null
  return $grid
}

function Draw-Messages([int]$index) {
  $messagesPanel.Children.Clear()
  $headerName.Text = $chats[$index].Name
  $headerInitial.Text = $chats[$index].Name.Substring(0,1)
  foreach ($m in $allMessages[$index]) {
    $row = New-Object Windows.Controls.Grid
    $row.Margin="0,0,0,10"
    $bubble = New-Object Windows.Controls.Border
    $bubble.CornerRadius=14
    $bubble.Padding="14,10"
    $bubble.MaxWidth=470
    $bubble.Background = if ($m.Mine) { "#D3F8DF" } else { "#FFFFFF" }
    $bubble.HorizontalAlignment = if ($m.Mine) { "Right" } else { "Left" }

    $stack = New-Object Windows.Controls.StackPanel
    $body = New-Object Windows.Controls.TextBlock
    $body.Text=$m.Text; $body.TextWrapping="Wrap"; $body.Foreground="#1C282C"; $body.FontSize=14
    $stack.Children.Add($body) | Out-Null
    $stamp = New-Object Windows.Controls.TextBlock
    $stamp.Text=$m.Time; $stamp.Foreground="#657479"; $stamp.FontSize=9; $stamp.HorizontalAlignment="Right"
    $stamp.Margin="18,5,0,0"
    $stack.Children.Add($stamp) | Out-Null
    $bubble.Child=$stack
    $row.Children.Add($bubble) | Out-Null
    $messagesPanel.Children.Add($row) | Out-Null
  }
  $messageScroll.ScrollToEnd()
}

for ($i=0; $i -lt $chats.Count; $i++) {
  $chatList.Items.Add((New-ChatRow $chats[$i])) | Out-Null
}
$chatList.SelectedIndex = 0
Draw-Messages 0

$chatList.Add_SelectionChanged({
  if ($chatList.SelectedIndex -ge 0) { Draw-Messages $chatList.SelectedIndex }
})

$send = {
  $text = $composer.Text.Trim()
  if ($text.Length -gt 0 -and $chatList.SelectedIndex -ge 0) {
    $idx = $chatList.SelectedIndex
    [void]$allMessages[$idx].Add(@{ Text=$text; Mine=$true; Time="Now" })
    $chats[$idx].Preview=$text
    $chats[$idx].Time="Now"
    $composer.Clear()
    Draw-Messages $idx
  }
}
$sendButton.Add_Click($send)
$composer.Add_KeyDown({
  if ($_.Key -eq "Enter") {
    & $send
    $_.Handled = $true
  }
})

[void]$window.ShowDialog()
