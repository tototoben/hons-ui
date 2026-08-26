-- Station III wall launcher hardcoded from measured Mac Studio layout.
-- Wall canvas: 3585 x 5258
--
-- Usage:
--   osascript scripts/blanket-station3-wall-measured.applescript

use scripting additions

on run
	set baseUrl to "https://house-of-negotiated-selves.vercel.app/"
	set wallW to 3585
	set wallH to 5258

	-- {x, y, width, height, panelX, panelY}
	set panels to {¬
		{0, 0, 1080, 1920, 392, 3338}, ¬
		{-47, -3338, 1080, 1920, 345, 0}, ¬
		{2113, -1920, 1080, 1920, 2505, 1418}, ¬
		{-392, -1080, 1920, 1080, 0, 2258}, ¬
		{1033, -3000, 1080, 1920, 1425, 338}, ¬
		{1080, 305, 1920, 1080, 1472, 3643}}

	tell application "Google Chrome"
		activate
	end tell
	delay 0.5

	repeat with p in panels
		set sx to item 1 of p
		set sy to item 2 of p
		set sw to item 3 of p
		set sh to item 4 of p
		set panelX to item 5 of p
		set panelY to item 6 of p
		set targetUrl to baseUrl & "?quality=kiosk&wall=1&wallW=" & wallW & "&wallH=" & wallH & "&panelX=" & panelX & "&panelY=" & panelY & "&panelW=" & sw & "&panelH=" & sh & "#/mirror"

		tell application "Google Chrome"
			set newWin to make new window
			set URL of active tab of newWin to targetUrl
			set bounds of newWin to {sx, sy, sx + sw, sy + sh}
		end tell
		delay 0.7
	end repeat

	return "opened 6 measured wall panels"
end run
