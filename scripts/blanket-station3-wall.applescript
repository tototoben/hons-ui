-- Station III wall mode: one Chrome window per display, each cropped to its slice.
--
-- Usage:
--   osascript scripts/blanket-station3-wall.applescript
--   osascript scripts/blanket-station3-wall.applescript "https://house-of-negotiated-selves.vercel.app/"

use framework "AppKit"
use scripting additions

on run argv
	set baseUrl to "http://localhost:5176/"
	if (count of argv) > 0 then set baseUrl to item 1 of argv
	if baseUrl does not end with "/" then set baseUrl to baseUrl & "/"

	set chromeBin to "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
	set bounds to my unionScreenBounds()
	set wallLeft to item 1 of bounds
	set wallTop to item 2 of bounds
	set wallRight to item 3 of bounds
	set wallBottom to item 4 of bounds
	set wallW to wallRight - wallLeft
	set wallH to wallBottom - wallTop
	set primaryH to (current application's NSHeight((current application's NSScreen's mainScreen())'s frame()))) as integer

	repeat with scr in (current application's NSScreen's screens())
		set f to scr's frame()
		set sx to (current application's NSMinX(f)) as integer
		set sy to (current application's NSMinY(f)) as integer
		set sw to (current application's NSWidth(f)) as integer
		set sh to (current application's NSHeight(f)) as integer
		set screenTop to primaryH - (sy + sh)
		set panelX to sx - wallLeft
		set panelY to screenTop - wallTop
		set chromeTop to screenTop
		set targetUrl to baseUrl & "?quality=kiosk&wall=1&wallW=" & wallW & "&wallH=" & wallH & "&panelX=" & panelX & "&panelY=" & panelY & "&panelW=" & sw & "&panelH=" & sh & "#/photobash"
		do shell script chromeBin & " --new-window --window-position=" & sx & "," & chromeTop & " --window-size=" & sw & "," & sh & " --app=" & quoted form of targetUrl & " >/dev/null 2>&1 &"
		delay 0.8
	end repeat

	return {wallW, wallH}
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

	set left to minX
	set top to primaryHeight - maxY
	set right to maxX
	set bottom to primaryHeight - minY

	return {left, top, right, bottom}
end unionScreenBounds
