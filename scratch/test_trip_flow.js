const http = require('http');

function post(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function put(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    http.get({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function run() {
  // Login user 4
  const userLogin = await post('http://localhost:8080/api/auth/login', {
    identifier: 'amara.silva@gmail.com',
    password: 'Test@1234'
  });
  const userToken = userLogin.data.token;
  const userHeaders = { 'Authorization': `Bearer ${userToken}` };

  console.log('1. User creating trip draft...');
  const trip1 = await post('http://localhost:8080/api/trips/book', {
    startLocation: 'Colombo Fort',
    destination: 'Galle',
    startDate: '2026-09-15',
    returnDate: '2026-09-17',
    passengerCount: 15,
    distanceKm: 120,
    requirement: 'Standard, AC'
  }, userHeaders);
  console.log('Created trip ID:', trip1.id);

  console.log('2. User creating another draft (should reuse existing draft without duplicating)...');
  const trip2 = await post('http://localhost:8080/api/trips/book', {
    startLocation: 'Colombo Fort',
    destination: 'Galle',
    startDate: '2026-09-15',
    returnDate: '2026-09-17',
    passengerCount: 20,
    distanceKm: 120,
    requirement: 'Standard, AC'
  }, userHeaders);
  console.log('Reused trip ID:', trip2.id, '(Should equal', trip1.id, ') -> Match?', trip1.id === trip2.id);

  console.log('3. User assigning Bus 8 to trip...');
  const assigned = await put(`http://localhost:8080/api/trips/book/${trip2.id}/bus?busId=8`, {}, userHeaders);
  console.log('Assigned bus:', assigned.busNumber, 'status:', assigned.bookingStatus);

  console.log('4. Checking Admin Trip Booking Requests...');
  const adminRequests = await get('http://localhost:8080/api/bookings/admin/trip-requests', userHeaders);
  console.log('Admin saw requests:', adminRequests.data.length);
  const foundAdmin = adminRequests.data.find(r => r.bookingId === `BK-${trip2.id}`);
  console.log(`Found BK-${trip2.id} in Admin Review Panel?`, !!foundAdmin, foundAdmin ? `Passenger: ${foundAdmin.passengerName} - Price: ${foundAdmin.amount}` : '');

  console.log('5. Checking Recent Bookings for User 4...');
  const recent = await get('http://localhost:8080/api/bookings/recent?userId=4', userHeaders);
  console.log('Total user recent bookings:', recent.data.length);
  recent.data.forEach(r => {
    console.log(` - [${r.bookingReference}] ${r.startLocation} -> ${r.endLocation} (${r.journeyDate}) status=${r.status} bus=${r.busNumber}`);
  });
}

run().catch(console.error);
