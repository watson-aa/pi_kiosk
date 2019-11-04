set NODE_APP_INSTANCE=1
C:
cd\nodeApps\pi_kiosk\server
FOR /L %%N IN () DO "C:\Program Files\nodejs\node.exe" "C:\nodeApps\pi_kiosk\server\index.js" "c:\temp\01" 5
