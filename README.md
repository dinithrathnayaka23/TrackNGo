# TrackNGo

> A connected, AI-assisted transport management platform for passengers, drivers, operators, and corporate transport teams.

TrackNGo brings the complete public and corporate transport journey into one ecosystem: route discovery, seat booking, payments, digital tickets, live bus tracking, driver operations, communication, complaints, emergency support, and administrator analytics.

The platform includes three client applications backed by a modular Spring Boot system:

- A passenger mobile application for booking, tracking, payments, chat, AI assistance, complaints, and SOS support.
- A driver mobile application for allocations, route/location updates, earnings, notifications, and communication.
- An administrator web dashboard for managing users, buses, routes, bookings, complaints, corporate services, promotions, analytics, notifications, and AI-assisted operations.

## Why TrackNGo?

Transport information is often fragmented. Passengers may not know whether a bus is available or delayed, drivers need better operational communication, and transport administrators must manage bookings, fleet data, complaints, and emergencies across separate workflows.

TrackNGo addresses this by connecting the entire journey:

```text
Passenger searches and books
            |
            v
Driver receives route and trip information
            |
            v
Operator monitors bookings, buses, ETA, and complaints
            |
            v
Passenger receives tracking, notifications, support, and safety assistance
```

## Current capabilities

### Passenger experience

- Account registration, login, OTP verification, and role-aware access.
- Bus and route search by origin, destination, and travel date.
- Route details, route stops, bus details, availability, and seat layout.
- Seat selection and booking confirmation.
- Stripe and PayHere payment integration support.
- Digital tickets with QR code support.
- Booking history, cancellation, refund flow, ratings, and complaints.
- Live bus tracking with route geometry and location updates.
- Real-time chat and notifications.
- AI assistant for route search, booking help, ETA questions, reminders, refunds, and complaints.
- SOS alerts, emergency contacts, emergency numbers, and safety-related complaint escalation.
- Corporate transport registration, contracts, bus selection, negotiation, and billing flows.

### Driver experience

- Driver authentication and profile management.
- Assigned trip and route views.
- Route navigation and location sharing for live tracking.
- Seat and allocation information.
- Driver earnings view.
- Notifications and real-time passenger/admin chat.

### Administrator experience

- Dashboard overview and operational analytics.
- Passenger, driver, corporate user, and administrator management.
- Bus, fleet, seat layout, route, and route-stop management.
- Booking and payment-status management.
- Complaint review and resolution workflows.
- SOS alert and emergency notification handling.
- Real-time chat and admin presence status.
- Promotions and discounts management.
- Corporate contracts and invoice management.
- Search, notifications, reporting, and analytics views.
- AI operations assistant for summaries, complaints, ETA, route planning, notifications, recommendations, and booking support.

## AI assistant and agent architecture

TrackNGo includes a unified conversational assistant in both the passenger mobile application and administrator dashboard. The assistant is backed by a Spring AI-compatible orchestration layer and specialized domain agents.

### Six specialized AI agents

| Agent | Responsibility |
| --- | --- |
| `TripPlanningAgent` | Finds available routes and bus options between two locations for a selected date, category, and preferred time. |
| `BookingAgent` | Handles seat reservation requests and returns booking status, reference, seats, transaction details, and fare information. |
| `TrafficEtaAgent` | Uses bus location and traffic context to provide current location, estimated delay, ETA messaging, confidence, and source. |
| `NotificationAgent` | Sends or prepares ride reminders, delay alerts, and alternative-route notifications. |
| `ComplaintAgent` | Categorizes, summarizes, prioritizes, and routes complaints to the appropriate support workflow. |
| `RecommendationAgent` | Produces travel, promotion, and service recommendations using user and travel context. |

### How an AI request is handled

```text
Passenger or admin message
            |
            v
       ChatController
            |
            v
        AgentRouter
            |
     Intent detection and context
            |
   +--------+--------+--------+--------+--------+--------+
   |        |        |        |        |        |        |
 Routes  Booking    ETA   Notify  Complaint  Recommend  Admin Ops
   |        |        |        |        |        |        |
   +--------+--------+--------+--------+--------+--------+
            |
            v
 Grounded response using TrackNGo services and database data
```

The assistant is designed to be action-oriented rather than a generic chatbot:

- It uses authenticated passenger context where available.
- It grounds route and booking responses in TrackNGo data.
- It checks bus and seat availability before creating a booking.
- It requires explicit confirmation before completing important booking actions.
- It does not invent booking references or payment confirmations.
- It can triage safety-related complaints and move them into an admin review workflow.
- It provides a deterministic fallback response when the external AI provider is unavailable.
- It keeps a session conversation context using a chat ID.
- Administrators can ask for operational summaries such as open complaints, high-priority issues, safety complaints, bookings, revenue, and affected buses or drivers.

Example passenger prompts:

```text
Find buses from Colombo Fort to Kandy tomorrow morning
ETA for NB-0012
Book one seat from Colombo Fort to Galle
What should I do if my bus is late?
I want to report an unsafe driving incident for booking BK-20250501-ABCD
```

Example administrator prompts:

```text
Give me today's operations summary
Show unresolved high-priority complaints
Which buses are linked to recent safety complaints?
What promotions should we run for frequent passengers?
Send a delay notification to passengers on this route
```

See [AI_ASSISTANT_GUIDE.md](AI_ASSISTANT_GUIDE.md) for the AI implementation and testing notes.

## Architecture

TrackNGo uses a modular monolith architecture. Business domains are separated into independent Maven modules while the application is deployed as one Spring Boot service.

```text
Passenger Mobile App       Driver Mobile App       Admin Web App
          |                         |                    |
          +------------ REST / WebSocket ---------------+
                                      |
                             Spring Boot Application
                                      |
       +----------------------------------------------------------+
       | Auth | Booking | Tracking | Fleet | Payments | Chat      |
       | AI   | Complaints | Notifications | SOS | Admin | Ratings |
       +----------------------------------------------------------+
                                      |
                                   MySQL
```

### Backend modules

The backend is located in `backend/trackngo-backend` and currently contains:

- `commons` - shared models, utilities, and common backend functionality.
- `auth-user-module` - authentication, authorization, users, roles, passengers, drivers, and corporate users.
- `booking-module` - route search, trip booking, seat booking, cancellation, refunds, and booking flow APIs.
- `tracking-module` - bus location and live tracking support.
- `driver-fleet-module` - buses, fleet operations, and seat layouts.
- `driver-module` - driver-specific functionality.
- `payment-module` - payment-related services and transaction workflows.
- `notification-module` - notifications and alerts.
- `complaint-module` - complaints, categorization, status, priority, and resolution workflows.
- `chat-module` - real-time conversations, messages, media, delivery status, and presence.
- `feedback-rating-module` - passenger ratings and feedback.
- `admin-module` - administrator operations and audit-related functionality.
- `sos-module` - SOS alerts and emergency support.
- `ai-agent-module` - AI controller, intent routing, six specialized agents, grounding, conversation memory, and fallback handling.
- `app` - the main Spring Boot application and application configuration.

## Technology stack

### Backend

- Java 21
- Spring Boot 3.2.4
- Spring Security
- Spring Data JPA and Hibernate
- Spring Web and REST APIs
- Spring WebSocket and STOMP/SockJS support
- Spring AI-compatible chat integration
- JWT authentication
- Bean Validation
- Lombok
- Maven

### AI

- Spring AI-compatible model integration.
- OpenAI-compatible HTTP provider support.
- Gemini-compatible endpoint and environment variable support.
- Configurable primary and fallback models.
- Function/tool-oriented agent services for routes, bookings, ETA, notifications, complaints, and recommendations.
- Conversation context and TrackNGo data grounding.

### Passenger and driver applications

- React Native
- Expo SDK 54
- TypeScript
- Expo Router
- React Native Maps
- STOMP.js and SockJS for real-time messaging/tracking
- QR code generation
- Expo Location
- Expo Print, Sharing, Media Library, and WebView integrations

### Administrator web application

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Font Awesome
- Jest and Testing Library

### External integrations

- Google Maps for route and map support.
- Stripe for card-payment flow support.
- PayHere for payment flow support.
- Twilio SMS support for notifications and emergency communication.
- Configurable OpenAI-compatible or Gemini-compatible AI provider.

## Repository structure

```text
TrackNGo/
├── backend/
│   └── trackngo-backend/
│       ├── commons/
│       ├── auth-user-module/
│       ├── booking-module/
│       ├── tracking-module/
│       ├── driver-fleet-module/
│       ├── driver-module/
│       ├── payment-module/
│       ├── notification-module/
│       ├── complaint-module/
│       ├── chat-module/
│       ├── feedback-rating-module/
│       ├── admin-module/
│       ├── sos-module/
│       ├── ai-agent-module/
│       └── app/
├── frontend/
│   ├── mobile-app/TrackNgo-Mobile/   # Passenger application
│   ├── driverapp/                    # Driver application
│   └── admin-web/my-react-app/       # Administrator dashboard
├── docker/
├── postman/
├── .postman/
├── trackngo_complete.sql
├── trackngo_sample_data.sql
├── AI_ASSISTANT_GUIDE.md
└── README.md
```

## Prerequisites

- Java 21
- Maven
- MySQL 8 or a compatible MySQL server
- Node.js and npm
- Android Studio and/or an Expo-compatible device/emulator for mobile development
- API credentials for the integrations you want to enable

## Configuration

Copy `.env.example` to `.env` in the repository root and update the values.

### Core configuration

```env
DB_URL=jdbc:mysql://localhost:3306/trackngo?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=root
DB_PASSWORD=your_db_password
JWT_SECRET=your-jwt-secret-at-least-32-characters-long
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### SMS configuration

```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_MESSAGING_SERVICE_SID=your_twilio_messaging_service_sid
TWILIO_DEFAULT_COUNTRY_CODE=+94
SMS_PROVIDER=twilio
```

The project also supports an Android SMS gateway through `SMS_ANDROID_GATEWAY_URL` and `SMS_ANDROID_GATEWAY_API_KEY`.

### Payments configuration

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
PAYHERE_MERCHANT_ID=your_payhere_merchant_id
PAYHERE_MERCHANT_SECRET=your_payhere_merchant_secret
PAYHERE_SANDBOX=true
```

### AI configuration

The current backend supports OpenAI-compatible providers and Gemini-compatible endpoints:

```env
AI_API_KEY=your_ai_provider_api_key
AI_BASE_URL=https://api.groq.com/openai/v1
AI_MODEL=llama-3.1-8b-instant
AI_FALLBACK_MODEL=llama-3.1-8b-instant
AI_MODEL_TIMEOUT_SECONDS=12
AI_MODEL_FUNCTIONS_ENABLED=false
AI_MODEL_DIRECT_HTTP_ENABLED=true
```

Gemini-style fallback names are also supported:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-pro
GEMINI_FALLBACK_MODEL=gemini-1.5-flash
```

Never commit real credentials to the repository. Use test or sandbox credentials for development and demonstrations.

## Database setup

Create the database:

```sql
CREATE DATABASE trackngo;
```

Import the complete schema:

```bash
mysql -u root -p trackngo < trackngo_complete.sql
```

Optional sample data:

```bash
mysql -u root -p trackngo < trackngo_sample_data.sql
```

For an existing production database, run the seat-booking concurrency
migration in `backend/trackngo-backend/database/migrations` before deploying
the new backend build. It backfills the seat-level reservation index and adds
the database unique constraint that prevents two users from owning the same
seat for the same bus and date. Follow that directory's runbook and take a
backup first.

Run `V3__booking_disruption_refunds.sql` as well before enabling route or bus
removal/maintenance workflows. Those workflows preserve route and bus rows,
cancel future confirmed bookings, notify passengers, and create idempotent
refund requests. Stripe refunds are processed automatically when the Stripe
PaymentIntent ID is available; other payment providers remain pending until
their provider refund adapter is configured.

Run `V4__booking_restoration_notifications.sql` before deploying the workflow
that notifies passengers when a repaired bus or route becomes active again.
Run `V5__bus_disruption_database_guard.sql` as the final migration. It provides
a database-level guard for bus maintenance changes made by any admin client and
repairs previously missed cancellations.

The backend is configured with `spring.jpa.hibernate.ddl-auto=update` for local development. The SQL files remain useful for reproducible setup and demo data.

## Running the project

### 1. Start the backend

```bash
cd backend/trackngo-backend
mvn clean install
mvn spring-boot:run -pl app
```

The backend runs on:

```text
http://localhost:8080
```

### 2. Start the passenger mobile app

```bash
cd frontend/mobile-app/TrackNgo-Mobile
npm install
npx expo install --fix
npm start
```

The app detects the Expo development host automatically and uses port `8080` for the backend by default. To override it:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_BACKEND_HOST:8080
```

For an Android emulator, use the host address that is reachable from the emulator, commonly `http://10.0.2.2:8080`.

### 3. Start the driver app

```bash
cd frontend/driverapp
npm install
npx expo start
```

Optional driver configuration is available in `frontend/driverapp/.env.example`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_BACKEND_HOST:8080
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 4. Start the administrator web app

```bash
cd frontend/admin-web/my-react-app
npm install
npm run dev
```

Useful scripts:

```bash
npm run build
npm run typecheck
npm test
```

## Testing

Backend tests are organized within the Maven modules. Run the full backend test suite with:

```bash
cd backend/trackngo-backend
mvn test
```

Frontend checks can be run independently:

```bash
cd frontend/admin-web/my-react-app
npm run typecheck
npm test
```

```bash
cd frontend/mobile-app/TrackNgo-Mobile
npm run typecheck
npm test
```

```bash
cd frontend/driverapp
npm test
```

Postman collections and additional testing notes are available in the `postman/`, `.postman/`, and project testing guide files.

## Suggested ideathon demonstration flow

For a five-minute demonstration, focus on one connected passenger-to-operator story:

1. In the passenger app, ask TrackNGo AI to find buses from Colombo Fort to Kandy tomorrow morning.
2. Show route options, availability, seat selection, and a digital booking confirmation.
3. Open live tracking and show the route, bus location, ETA, and SOS entry point.
4. Switch to the administrator dashboard and ask the AI operations assistant for today's summary or unresolved high-priority complaints.
5. Open the relevant admin view to show that the AI response is connected to the platform's operational workflows.

The strongest message is that TrackNGo is not only a booking application and not only a chatbot. It is an action-oriented transport platform that connects passengers, drivers, and operators using real booking, route, tracking, complaint, and notification services.

## Current limitations and production considerations

- AI features require a configured external model provider and API key.
- Live ETA quality depends on the availability and freshness of GPS/location data.
- Stripe, PayHere, Twilio, and Google Maps should be configured with production credentials before deployment.
- Payment integrations should remain in sandbox/test mode during development and demonstrations.
- AI responses should be rate-limited, monitored, and audited before production use.
- Chat, location, payment, and emergency data require appropriate privacy and access controls.
- The project is currently intended for educational, prototyping, and ideathon use.

## Future enhancements

- AI-powered ETA prediction using historical traffic and trip data.
- Smarter route and fleet optimization.
- Push notifications and broader device support.
- Voice-enabled and multilingual passenger assistance.
- Advanced operator analytics and forecasting.
- QR validation and conductor/inspector workflows.
- Cloud deployment, CI/CD, observability, and production-grade audit controls.

## Project status

TrackNGo is an actively developed software engineering project with implemented passenger, driver, administrator, backend, real-time communication, payment, safety, and AI-agent workflows. Individual integrations may require local configuration, valid credentials, sample data, and an available backend service before they can be demonstrated end to end.

## License

This repository is intended for educational and academic purposes.
