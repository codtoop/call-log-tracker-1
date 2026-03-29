echo Installing Firewall Rule for Next.js...
netsh advfirewall firewall add rule name="Next.js Port 3000" dir=in action=allow protocol=TCP localport=3000
echo Done!
pause
