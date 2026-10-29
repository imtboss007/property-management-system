# AXIVESTRA — one-scan phone sync

AXIVESTRA uses one Windows PC as the WhatsApp sender and shared local data host.

1. Start AXIVESTRA on Windows and keep the PC connected to the same Wi-Fi as the phone.
2. If WhatsApp is not already linked in AXIVESTRA, link the number once from the WhatsApp screen.
3. In **Settings → Sync WhatsApp + data**, scan the QR with AXIVESTRA on Android.

After linking, business records and document files sync automatically in both directions. Android also uses the Windows WhatsApp session and scheduled-message queue; there is no separate phone sender to configure.

The Windows app starts hidden at user login and keeps its scheduler in the system tray. The app windows may be closed, but the PC must remain powered on, awake, online and still running AXIVESTRA. Do not choose **Exit AXIVESTRA** if pending messages need to send. A shut-down or sleeping PC cannot send messages; delivery with the PC powered off requires a separately deployed always-on hosted sender.

The phone-link QR is short-lived and one-use. The phone receives a separate device token after pairing; the Windows master token is not embedded in the QR. Keep paired devices and the PC on a trusted network.
