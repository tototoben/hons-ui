-- Station III role wall: each display shows a dedicated panel (not a crop).
-- Measured Mac Studio layout.
--
-- Usage:
--   osascript scripts/blanket-station3-wall-measured.applescript

use scripting additions

on run
	set baseUrl to "https://house-of-negotiated-selves.vercel.app/"

	-- {x, y, width, height, role}
	set panels to {¬
		{-47, -3338, 1080, 1920, "code"}, ¬
		{1033, -3000, 1080, 1920, "status"}, ¬
		{2113, -1920, 1080, 1920, "avatar"}, ¬
		{-392, -1080, 1920, 1080, "debra"}, ¬
		{0, 0, 1080, 1920, "copy"}, ¬
		{1080, 305, 1920, 1080, "guide"}}

	tell application "Google Chrome"
		activate
	end tell
	delay 0.5

	repeat with p in panels
		set sx to item 1 of p
		set sy to item 2 of p
		set sw to item 3 of p
		set sh to item 4 of p
		set wallRole to item 5 of p
		set targetUrl to baseUrl & "?wallRole=" & wallRole & "#/photobash"

		tell application "Google Chrome"
			set newWin to make new window
			set URL of active tab of newWin to targetUrl
			set bounds of newWin to {sx, sy, sx + sw, sy + sh}
		end tell
		delay 0.7
	end repeat

	return "opened 6 role panels"
end run
