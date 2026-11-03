#!/bin/zsh
set -euo pipefail

APP_NAME="Fionbo"
INSTALL_ROOT="$HOME/Applications"
APP_DIR="$INSTALL_ROOT/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$MACOS" "$RESOURCES"

cat > "$TMP/FionboApp.swift" <<'SWIFT'
import Cocoa
import WebKit

final class FionboViewController: NSViewController, WKNavigationDelegate {
    private let webView: WKWebView
    private let homeURL = URL(string: "https://shouldbe.media/fionbo")!

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.mediaTypesRequiringUserActionForPlayback = []
        self.webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
        self.webView.navigationDelegate = self
        self.webView.allowsBackForwardNavigationGestures = true
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func loadView() {
        let root = NSView()
        root.wantsLayer = true
        root.layer?.backgroundColor = NSColor.black.cgColor

        webView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ])

        self.view = root
        webView.load(URLRequest(url: homeURL))
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showOffline(error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showOffline(error.localizedDescription)
    }

    private func showOffline(_ detail: String) {
        let html = """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            body{margin:0;background:#05070b;color:white;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:grid;place-items:center;min-height:100vh}
            .card{max-width:520px;padding:36px;text-align:center}
            h1{font-size:32px;margin:0 0 10px}
            p{color:rgba(255,255,255,.55);line-height:1.6}
            button{margin-top:18px;border:0;border-radius:999px;padding:12px 20px;background:#67e8f9;color:#001018;font-weight:700}
          </style>
        </head>
        <body><div class="card"><h1>Fionbo</h1><p>Fionbo could not connect to ShouldBe right now.</p><p>(detail)</p><button onclick="location.href='https://shouldbe.media/fionbo'">Try again</button></div></body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: homeURL)
    }
}

final class FionboAppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let controller = FionboViewController()
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Fionbo"
        window.minSize = NSSize(width: 420, height: 560)
        window.center()
        window.contentViewController = controller
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        if let imageURL = URL(string: "https://shouldbe.media/fionbo-avatar.jpg"),
           let data = try? Data(contentsOf: imageURL),
           let image = NSImage(data: data) {
            NSApp.applicationIconImage = image
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

let app = NSApplication.shared
let delegate = FionboAppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()

SWIFT

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode Command Line Tools are required to install Fionbo."
  echo "Install them with: xcode-select --install"
  exit 1
fi

xcrun swiftc "$TMP/FionboApp.swift" -framework Cocoa -framework WebKit -o "$MACOS/Fionbo"
chmod +x "$MACOS/Fionbo"

cat > "$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Fionbo</string>
  <key>CFBundleDisplayName</key><string>Fionbo</string>
  <key>CFBundleIdentifier</key><string>media.shouldbe.fionbo</string>
  <key>CFBundleExecutable</key><string>Fionbo</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

mkdir -p "$INSTALL_ROOT"
touch "$APP_DIR"
open "$APP_DIR"

echo ""
echo "Fionbo has been installed to:"
echo "$APP_DIR"
echo ""
echo "If macOS blocks it because it is an unsigned local build, open System Settings > Privacy & Security and allow Fionbo."
