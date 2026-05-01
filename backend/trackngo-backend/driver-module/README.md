# Driver Module

The Driver Module provides REST endpoints for drivers to retrieve their profile information and current assignments after login.

## API Endpoints

### 1. Get Driver Profile
**Endpoint:** `GET /api/drivers/{driverId}/profile`

**Authorization:** Requires DRIVER role

**Description:** Retrieves the complete driver profile including personal information and professional details.

**Response:**
```json
{
  "success": true,
  "message": "Driver profile fetched successfully",
  "data": {
    "driverId": 1,
    "firstName": "Kamal",
    "lastName": "Perera",
    "email": "kamal@example.com",
    "phoneNumber": "0711356924",
    "profilePhoto": "url/to/photo",
    "licenseNumber": "B1234567",
    "licenceExpiry": "2026-12-31",
    "yearsOfExperience": 5,
    "joinedDate": "2021-01-15",
    "status": "active",
    "isVerified": true,
    "averageRating": 4.8,
    "driverEarnings": 50000.00,
    "accountNumber": "1234567890",
    "isPhoneVerified": true
  }
}
```

### 2. Get Current Assignment
**Endpoint:** `GET /api/drivers/{driverId}/assignment`

**Authorization:** Requires DRIVER role

**Description:** Retrieves the current bus assignment for the driver.

**Response:**
```json
{
  "success": true,
  "message": "Current assignment fetched successfully",
  "data": {
    "busId": 1,
    "busNumber": "TB-0001",
    "busBrand": "Mercedes",
    "registrationNumber": "WP CAB-0001",
    "startTime": "06:00:00",
    "endTime": "22:00:00",
    "seatCapacity": 45,
    "busCondition": "excellent",
    "busType": "long_distance",
    "status": "active",
    "insuranceExpDate": "2027-12-31",
    "amenities": "[\"ac\", \"wifi\", \"charging_ports\"]"
  }
}
```

### 3. Get Profile and Assignment (Combined)
**Endpoint:** `GET /api/drivers/{driverId}/profile-and-assignment`

**Authorization:** Requires DRIVER role

**Description:** Retrieves both driver profile and current assignment in a single API call.

**Response:**
```json
{
  "success": true,
  "message": "Profile and assignment fetched successfully",
  "data": {
    "profile": {
      "driverId": 1,
      "firstName": "Kamal",
      "lastName": "Perera",
      ...
    },
    "assignment": {
      "busId": 1,
      "busNumber": "TB-0001",
      ...
    }
  }
}
```

## Usage in Frontend

### Example: Fetch Driver Profile on Login

```typescript
// In UserContext.tsx or Login Screen
const fetchDriverProfile = async (driverId: number, token: string) => {
  try {
    const response = await fetch(
      `https://your-api.com/api/drivers/${driverId}/profile-and-assignment`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const result = await response.json();
    if (result.success) {
      // Store profile data in context
      const profileData = result.data.profile;
      const assignmentData = result.data.assignment;
      
      setUser({
        id: profileData.driverId,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        token: token,
      });
      
      // Store assignment data separately
      setCurrentAssignment(assignmentData);
    }
  } catch (error) {
    console.error('Failed to fetch driver profile:', error);
  }
};
```

### Example: Update Driver Profile Settings Page

```typescript
// In driverProfileSettings.tsx
import { useUser } from '@/context/UserContext';

export default function DriverProfileSettingsScreen() {
  const { user } = useUser();
  const [driverData, setDriverData] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchDriverProfile(user.id);
    }
  }, [user?.id]);

  const fetchDriverProfile = async (driverId: number) => {
    try {
      const response = await fetch(
        `https://your-api.com/api/drivers/${driverId}/profile`,
        {
          headers: {
            'Authorization': `Bearer ${user.token}`,
          },
        }
      );
      
      const result = await response.json();
      if (result.success) {
        setDriverData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch driver data:', error);
    }
  };

  return (
    <View>
      <Text>{driverData?.firstName} {driverData?.lastName}</Text>
      <Text>ID: DRV-{driverData?.driverId}</Text>
      <Text>License: {driverData?.licenseNumber}</Text>
      <Text>License Expiry: {driverData?.licenceExpiry}</Text>
      <Text>Email: {driverData?.email}</Text>
      <Text>Phone: {driverData?.phoneNumber}</Text>
      {/* ... other fields */}
    </View>
  );
}
```

## Database Schema

The module uses the following tables:
- **user**: Stores basic user information (first_name, last_name, email, etc.)
- **driver**: Stores driver-specific information (license, phone, earnings, etc.)
- **bus**: Stores bus information with driver_id foreign key for assignment

## Module Structure

```
driver-module/
├── pom.xml                          # Maven configuration
├── src/main/java/com/trackngo/driver/
│   ├── api/                         # Public API interfaces
│   │   ├── DriverService.java       # Service interface
│   │   └── dto/                     # Data Transfer Objects
│   │       ├── DriverProfileDto.java
│   │       └── BusAssignmentDto.java
│   ├── events/                      # Event handling (for future use)
│   └── internal/                    # Internal implementation
│       ├── controller/              # REST controllers
│       │   └── DriverController.java
│       ├── entity/                  # JPA entities
│       │   ├── Driver.java
│       │   ├── User.java
│       │   └── Bus.java
│       ├── repository/              # Data access layer
│       │   ├── DriverRepository.java
│       │   ├── UserRepository.java
│       │   └── BusRepository.java
│       └── service/                 # Business logic
│           └── DriverServiceImpl.java
```

## Dependencies

The module depends on:
- Spring Boot Web Starter
- Spring Boot Data JPA
- Spring Boot Validation
- Spring Boot Security
- Lombok
- Commons module (internal dependency)

## Error Handling

If a driver is not found, the API will return a 500 error with message: "Driver not found with ID: {id}"

If there is no current assignment, the `/assignment` endpoint will return `null` data with success=true.

## Security

All endpoints require the `DRIVER` role. The JWT token must be included in the Authorization header:
```
Authorization: Bearer {jwt_token}
```
