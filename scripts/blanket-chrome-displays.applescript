-- One Chrome window per display, each filling its screen (same URL on all).
-- Works when a single window cannot span irregular multi-monitor layouts.
--
-- Usage:
--   osascript scripts/blanket-chrome-displays.applescript
--   osascript scripts/blanket-chrome-displays.applescript "https://house-of-negotiated-selves.vercel.app/?quality=kiosk#/"

use framework "AppKit"
use scripting additions

on run argv
	set targetUrl to "http://localhost:5176/?quality=kiosk#/"
	if (count of argv) > 0 then set targetUrl to item 1 of argv

	set chromeBin to "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
	set primaryH to (current application's NSHeight((current application's NSScreen's mainScreen())'s frame()))) as integer

	repeat with scr in (current application's NSScreen's screens())
		set f to scr's frame()
		set x to (current application's NSMinX(f)) as integer
		set sy to (current application's NSMinY(f)) as integer
		set w to (current application's NSWidth(f)) as integer
		set h to (current application's NSHeight(f)) as integer
		set y to primaryH - (sy + h)
		do shell script chromeBin & " --new-window --window-position=" & x & "," & y & " --window-size=" & w & "," & h & " --app=" & quoted form of targetUrl & " >/dev/null 2>&1 &"
		delay 0.8
	end repeat
end run
