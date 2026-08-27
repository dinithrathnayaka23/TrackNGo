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
  const res = await get('http://localhost:8080/api/trips/all');
  const trips = Array.isArray(res) ? res : (res.data || []);
  console.log('Total trips in DB:', trips.length);
  trips.forEach(t => {
    console.log(`Trip #${t.id}: ${t.startLocation} -> ${t.destination} | ${t.startDate} - ${t.returnDate} | status=${t.bookingStatus} | busId=${t.busId} | busNumber=${t.busNumber} | passId=${t.passengerId} | negotiatedAt=${t.negotiatedAt}`);
  });
}

run().catch(console.error);
