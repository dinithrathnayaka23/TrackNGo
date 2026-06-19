# 🚍 TrackNGo

> **A Smart Transport Management Platform for Modern Public and Corporate Transportation**

TrackNGo is a comprehensive transport management system developed as a second-year software engineering project. It streamlines passenger bookings, fleet operations, route management, payments, corporate transport services, real-time communication, and emergency support through a modern, modular architecture.

---

# ✨ Features

## 👤 User Management
- Secure authentication and authorization
- Role-based access control
- Passenger management
- Driver management
- Corporate account management
- Administrator management
- Profile management

## 🚌 Booking & Transportation
- Seat booking system
- Trip booking
- Route management
- Bus management
- Fleet management
- Seat layout management
- Journey scheduling

## 📍 Real-Time Tracking
- Bus location tracking
- Route monitoring
- Live location updates
- GPS-based tracking support

## 💳 Payments
- Secure payment processing
- Payment history
- Refund management
- Promotion and discount handling
- Corporate invoicing

## 💬 Communication
- Real-time chat
- Notifications
- Complaint management
- Feedback and rating system

## 🚨 Safety Features
- SOS emergency alerts
- Emergency contacts
- Emergency hotline integration
- Incident reporting

## 🏢 Corporate Services
- Corporate transport contracts
- Company user management
- Billing and invoice management

---

# 🏗️ Architecture

TrackNGo follows a **Modular Monolith Architecture**, separating business domains into independent modules while deploying as a single Spring Boot application.

```
                    +----------------------+
                    |      Frontend        |
                    +----------+-----------+
                               |
                               |
                     REST APIs / WebSocket
                               |
                               ▼
                    +----------------------+
                    |  Spring Boot App      |
                    +----------+-----------+
                               |
      -------------------------------------------------------
      |        |         |         |        |               |
      ▼        ▼         ▼         ▼        ▼               ▼
   Auth     Booking   Tracking   Payment  Chat        Notifications
      |        |         |         |        |               |
      -------------------------------------------------------
                               |
                               ▼
                        MySQL Database
```

---

# 📦 Backend Modules

- `commons`
- `auth-user-module`
- `booking-module`
- `tracking-module`
- `driver-fleet-module`
- `payment-module`
- `notification-module`
- `complaint-module`
- `chat-module`
- `feedback-rating-module`
- `admin-module`
- `sos-module`
- `app` (Main Spring Boot Application)

---

# 🛠️ Technology Stack

## Backend
- Java 21
- Spring Boot 3
- Spring Security
- Spring Data JPA
- Spring Validation
- Spring WebSocket
- Maven
- JWT Authentication
- Lombok

## Database
- MySQL

## External Integrations
- Twilio SMS
- Stripe
- PayHere

## Frontend
- React / React Native
- Expo (Mobile)

---

# 🗄️ Database Highlights

The project contains a comprehensive MySQL schema supporting:

- Users
- Passengers
- Drivers
- Admins
- Corporate Users
- Routes
- Route Stops
- Buses
- Seat Layouts
- Seat Bookings
- Trip Bookings
- Payments
- Refunds
- Promotions
- Ratings
- Complaints
- Notifications
- Conversations
- Chat Messages
- SOS Alerts
- Emergency Contacts
- Corporate Contracts
- Corporate Invoices
- Bus Locations

---

# 📁 Project Structure

```text
TrackNGo/
│
├── backend/
│   └── trackngo-backend/
│       ├── commons/
│       ├── auth-user-module/
│       ├── booking-module/
│       ├── tracking-module/
│       ├── driver-fleet-module/
│       ├── payment-module/
│       ├── notification-module/
│       ├── complaint-module/
│       ├── chat-module/
│       ├── feedback-rating-module/
│       ├── admin-module/
│       ├── sos-module/
│       └── app/
│
├── frontend/
├── docs/
├── uploads/
├── trackngo_complete.sql
├── trackngo_sample_data.sql
└── README.md
```

---

# ⚙️ Prerequisites

Before running the project, ensure you have:

- Java 21
- Maven
- MySQL Server
- Node.js & npm
- Git

---

# 🚀 Backend Setup

### Clone the repository

```bash
git clone https://github.com/dinithrathnayaka23/TrackNGo.git
cd TrackNGo
```

### Switch to development branch

```bash
git checkout development
```

### Create the database

```sql
CREATE DATABASE trackngo;
```

### Import schema

```bash
mysql -u root -p trackngo < trackngo_complete.sql
```

### (Optional) Import sample data

```bash
mysql -u root -p trackngo < trackngo_sample_data.sql
```

### Navigate to backend

```bash
cd backend/trackngo-backend
```

### Build

```bash
mvn clean install
```

### Run

```bash
mvn spring-boot:run -pl app
```

The backend will start at:

```
http://localhost:8080
```

---

# 📱 Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the project:

```bash
npm start
```

For Expo-based development:

```bash
npx expo start
```

---

# 🔐 Environment Variables

Create a `.env` file and configure the following values:

```env
DB_URL=jdbc:mysql://localhost:3306/trackngo
DB_USERNAME=root
DB_PASSWORD=your_password

JWT_SECRET=your_secret_key

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_DEFAULT_COUNTRY_CODE=+94

SMS_PROVIDER=twilio

PAYHERE_MERCHANT_ID=
PAYHERE_MERCHANT_SECRET=
PAYHERE_SANDBOX=true

STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
```

---

# 🌟 Key Capabilities

- 🔐 JWT Authentication
- 👥 Multi-role User System
- 🚌 Smart Bus & Route Management
- 🎫 Seat Reservation
- 📍 Live Bus Tracking
- 💬 Real-Time Chat
- 🔔 Notification System
- 🚨 SOS Emergency Support
- 📞 Emergency Contact Management
- 💳 Payment & Refund Processing
- 🏢 Corporate Transport Services
- ⭐ Ratings & Reviews
- 📝 Complaint Management
- 🎁 Promotions & Discounts

---

# 🔮 Future Enhancements

- AI-powered ETA prediction
- Driver mobile application
- Passenger live tracking dashboard
- Push notifications
- Analytics dashboard
- Smart route optimization
- Digital ticket QR codes
- Multi-language support
- Cloud deployment
- CI/CD integration

---

# 🤝 Contributors

Developed as part of a **Second-Year Software Engineering Project**.

Contributions from project team members are welcome through pull requests and code reviews.

---

# 📄 License

This repository is intended for **educational and academic purposes**.

---

## ⭐ If you find this project useful, consider giving it a star on GitHub!
