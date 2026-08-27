const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: resData }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing Seat Booking Cancellation Request (< 3 days -> 75% refund) ---');
  // BK-25 is on 2026-08-28 (which is today/tomorrow, < 3 days)
  const seatCancel = await post('http://localhost:8080/api/trips/book/25/cancellation-request', {
    reason: 'Change of plans last minute.',
    requesterType: 'user',
  });
  console.log('User cancel < 3 days status:', seatCancel.status);
  console.log('User cancel < 3 days body:', seatCancel.data);

  console.log('\n--- 2. Testing Admin Reject with Reason ---');
  const adminReject = await post('http://localhost:8080/api/trips/book/25/cancellation-response', {
    accept: false,
    rejectReason: 'Bus has already been dispatched and fuel allocated.',
    responderType: 'admin',
  });
  console.log('Admin reject status:', adminReject.status);
  console.log('Admin reject body:', adminReject.data);
}

run().catch(console.error);
