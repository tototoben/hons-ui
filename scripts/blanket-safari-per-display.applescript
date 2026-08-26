-- Open one Safari window per display (useful for 6 portrait mirror stations).
--
-- Usage:
--   osascript scripts/blanket-safari-per-display.applescript
--   osascript scripts/blanket-safari-per-display.applescript "http://localhost:5176/#/station-1"

use framework "AppKit"
use scripting additions

on run argv
	set targetUrl to "http://localhost:5176/?quality=kiosk#/"
	if (count of argv) > 0 then set targetUrl to item 1 of argv

	set displayBounds to my allScreenBounds()

	tell application "Safari"
		activate
		repeat with i from 1 to count of displayBounds
			set b to item i of displayBounds
			if i = 1 then
				if (count of windows) = 0 then make new document
				set URL of current tab of front window to targetUrl
				delay 0.4
				set bounds of front window to b
			else
				make new document with properties {URL:targetUrl}
				delay 0.4
				set bounds of front window to b
			end if
		end repeat
	end tell

	my hideSafariToolbar()

	return displayBounds
end run

on allScreenBounds()
	set screens to current application's NSScreen's screens()
	set primaryFrame to current application's NSScreen's mainScreen()'s frame()
	set primaryHeight to (current application's NSHeight(primaryFrame)) as integer
	set boundsList to {}

	repeat with aScreen in screens
		set f to aScreen's frame()
		set sx to (current application's NSMinX(f)) as integer
		set sy to (current application's NSMinY(f)) as integer
		set sw to (current application's NSWidth(f)) as integer
		set sh to (current application's NSHeight(f)) as integer
		set end of boundsList to {sx, primaryHeight - (sy + sh), sx + sw, primaryHeight - sy}
	end repeat

	return boundsList
end allScreenBounds

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
