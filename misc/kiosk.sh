#!/bin/bash

printf "%s" "waiting for ServerXY ..."
while ! timeout 0.2 ping -c 1 -n camilla.local &> /dev/null
do
    printf "%c" "."
done

xset s noblank
xset s off
xset -dpms
xset dpms force on

#screen inversion
xrandr --output HDMI-2 --rotate inverted
xinput set-prop "WingCool Inc. TouchScreen" --type=float "Coordinate Transformation Matrix" -1 0 1 0 -1 1 0 0 1

unclutter -idle 0.5 -root &

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/jaime/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/jaime/.config/chromium/Default/Preferences

killall chromium-browser
rm -rf /home/jaime/.cache/chromium

pushd /home/jaime/vumeters
git pull
git checkout add-controls
popd

/usr/bin/chromium-browser  --incognito --noerrdialogs --disable-infobars --kiosk http://localhost/vumeters/ &

while true; do
   xdotool keydown ctrl+Tab; xdotool keyup ctrl+Tab;
   sleep 10
done
