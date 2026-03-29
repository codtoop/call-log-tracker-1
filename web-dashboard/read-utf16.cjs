const fs = require('fs');
const content = fs.readFileSync('ip_status.txt', 'utf16le');
const lines = content.split('\n');
let found = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Wireless LAN adapter Wi-Fi')) {
    found = true;
    for (let j = i; j < Math.min(i + 15, lines.length); j++) {
      if (lines[j].includes('IPv4')) {
        console.log(lines[j].trim());
      }
    }
    // Also log the adapter header for context
    console.log('--- FOUND IN ---\n', lines[i].trim());
  }
}
if (!found) console.log('Wireless LAN adapter Wi-Fi not found in file');
