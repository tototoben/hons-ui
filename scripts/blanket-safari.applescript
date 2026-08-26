-- Span Safari across every connected display (one window, full video wall).
-- Requires: "Displays have separate Spaces" OFF (System Settings → Desktop & Dock).
--
-- Usage:
--   osascript scripts/blanket-safari.applescript
--   osascript scripts/blanket-safari.applescript "http://localhost:5176/#/station-1"

use framework "AppKit"
use scripting additions

on run argv
	set targetUrl to "http://localhost:5176/?quality=kiosk#/"
	if (count of argv) > 0 then set targetUrl to item 1 of argv

	set screenBounds to my unionScreenBounds()

	tell application "Safari"
		activate
		if (count of windows) = 0 then make new document
		set URL of current tab of front window to targetUrl
		delay 0.6
		tell front window
			set bounds to screenBounds
		end tell
	end tell

	my hideSafariToolbar()

	return screenBounds
end run

on unionScreenBounds()
	set screens to current application's NSScreen's screens()
	set primaryFrame to current application's NSScreen's mainScreen()'s frame()
	set primaryHeight to (current application's NSHeight(primaryFrame)) as integer

	set minX to 999999
	set maxX to -999999
	set minY to 999999
	set maxY to -999999

	repeat with aScreen in screens
		set f to aScreen's frame()
		set sx to (current application's NSMinX(f)) as integer
		set sy to (current application's NSMinY(f)) as integer
		set sw to (current application's NSWidth(f)) as integer
		set sh to (current application's NSHeight(f)) as integer
		set minX to min(minX, sx)
		set maxX to max(maxX, sx + sw)
		set minY to min(minY, sy)
		set maxY to max(maxY, sy + sh)
	end repeat

	-- Cocoa uses a bottom-left origin; AppleScript window bounds use top-left.
	set left to minX
	set top to primaryHeight - maxY
	set right to maxX
	set bottom to primaryHeight - minY

	return {left, top, right, bottom}
end unionScreenBounds

on hideSafariToolbar()
	tell application "System Events"
		if not (exists process "Safari") then return
		tell process "Safari"
			try
				click menu item "Hide Toolbar" of menu "View" of menu bar 1
			end try
		end tell
	end tell
end hideSafariToolbar
