set NODE_APP_INSTANCE=2
C:
cd\nodeApps\pi_kiosk\server
FOR /L %%N IN () DO "C:\Program Files\nodejs\node.exe" "C:\nodeApps\pi_kiosk\server\index.js" "c:\temp\02" 60
