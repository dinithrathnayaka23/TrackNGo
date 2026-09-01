const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  const recent = await get('http://localhost:8080/api/bookings/recent?userId=4');
  console.log('Total recent items:', recent.data.length);
  recent.data.forEach((b, i) => {
    console.log(`${i + 1}. [${b.bookingReference}] ${b.startLocation} -> ${b.endLocation} (${b.journeyDate}) status=${b.status} bus=${b.busNumber}`);
  });
}

run().catch(console.error);
