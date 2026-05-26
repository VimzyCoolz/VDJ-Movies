# Shared UI Setup Guide for CoolzTech Products

This document provides step-by-step instructions for implementing the unified CoolzTech login/signup interface across all company products. Following this guide ensures a consistent user experience and security posture across the entire ecosystem.

## 1. Directory Structure

To integrate the shared UI, copy the following folder from the `CoolzTechAuth` repository into your project's root or `public` directory:

```text
/your-project-root
└── coolz_auth_ui/
    ├── auth.js      # The Authentication Client SDK
    ├── index.js     # The UI Component Logic (Dynamic Mounting)
    └── style.css    # Unified Styling and Themes
```

## 2. Integration Steps

### Step 1: Include Assets
Add the following tags to your application's main HTML file (e.g., `index.html`). 

**CRITICAL**: You must include your `data-app-key`. The SDK will **fail to initialize** and block all functionality if this parameter is missing or invalid.

```html
<!-- CoolzTech Shared UI Styles -->
<link rel="stylesheet" href="https://authcoolztech.vercel.app/coolz_auth_ui/style.css">

<!-- CoolzTech Shared UI Scripts -->
<script 
  src="https://authcoolztech.vercel.app/coolz_auth_ui/auth.js" 
  data-app-key="ct_pub_x82js_example"
  data-app-name="My Project">
</script>
<script src="https://authcoolztech.vercel.app/coolz_auth_ui/index.js"></script>
```

| Parameter | Attribute | Required | Description |
|-----------|-----------|----------|-------------|
| **App Key** | `data-app-key` | **YES** | Your unique public identifier (e.g., `ct_pub_...`). |
| **App Name** | `data-app-name` | No | Optional display name for your application. |

### Step 2: Define a Mount Point
Create an empty container where the auth interface will be rendered:

```html
<div id="coolztech-auth-root"></div>
```

### Step 3: Initialize the UI
Call the `ctMount` function provided by `index.js` to render the interface:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  ctMount('#coolztech-auth-root', {
    baseUrl: 'https://authcoolztech.vercel.app' // Your Auth API base URL
  });
});
```

## 3. File Paths and Naming Conventions

| Component | Path | Description |
|-----------|------|-------------|
| **SDK Client** | `/coolz_auth_ui/auth.js` | Handles API requests, token persistence, and session management. |
| **UI Engine** | `/coolz_auth_ui/index.js` | Dynamically creates the DOM structure for login, signup, and OTP flows. |
| **Styles** | `/coolz_auth_ui/style.css` | Contains the "Scanline" theme, grid backgrounds, and responsive layouts. |
| **Assets** | Remote URLs | All images (logos, icons) are currently served via ImgBB to keep the package lightweight. |

## 4. Testing Procedures

To verify a successful integration, perform the following checks:

### Visual Consistency
- [ ] **Theme Check**: Verify the "Scanline" overlay and grid background are visible.
- [ ] **Brand Check**: Ensure the CoolzTech logo and "WELCOME TO COOLZTECH" title are correctly rendered.

### Functional Verification
- [ ] **Responsive Design**: Test the UI on Mobile (375px), Tablet (768px), and Desktop (1440px). The `.ct-card` should adapt its width accordingly.
- [ ] **Flow Test**: Complete a full "Signup -> OTP Verification" flow.
- [ ] **Persistence**: Log in, refresh the page, and verify the `ct_token` remains in `localStorage`.

## 5. Version Control Guidelines

- **Do Not Modify Directly**: Avoid making changes directly to files inside `coolz_auth_ui/`. These files should remain identical across all products.
- **Upstream Updates**: When the core `CoolzTechAuth` repository is updated, pull the latest changes and replace the `coolz_auth_ui/` folder in your project.
- **Feature Requests**: If a product requires a specific UI change, request a "Global UI Update" in the main auth repository to maintain consistency.

## 6. Troubleshooting

| Issue | Error Message | Solution |
|-------|---------------|----------|
| **Mount Failed** | `CoolzTechAuthUI target not found` | Ensure the ID provided to `ctMount` matches an existing element in your HTML. |
| **Missing App Key** | `Mandatory parameter 'data-app-key' is missing` | Add `data-app-key="your_key"` to the SDK script tag. |
| **Invalid App Key** | `Invalid 'data-app-key' format` | Ensure your key starts with `ct_pub_` followed by 24 hex characters. |
| **Missing SDK** | `window.CoolzAuthClient is not a constructor` | Ensure `auth.js` is loaded *before* `index.js`. |
| **CORS Error** | `Access to fetch... blocked by CORS policy` | Ensure your product's domain is whitelisted in the Auth Backend's CORS settings. |
| **Invalid Format** | `Invalid server response (Format Error)` | Check the `baseUrl` configuration. The backend might be returning an HTML error page instead of JSON. |
| **Timeout** | `Request timed out. Please check your connection.` | The network request exceeded the 15s limit. Check server status or network latency. |

## 7. Data Fetching & Management

The CoolzTech Auth SDK provides built-in methods for retrieving and managing user data. This ensures that all company products handle user information (like avatars and profiles) consistently.

### 7.1. SDK Availability & Initialization
The SDK is exposed as a global constructor on the `window` object. It automatically detects the `data-app-key` and `data-app-name` if provided in the script tag. 

**Note**: The SDK performs a strict validation check on the `appKey` format (`ct_pub_` + 24 hex characters).

```javascript
// Initialization (Automatic parameter detection)
// This will throw an error if data-app-key is missing from the script tag
const client = new window.CoolzAuthClient({ 
  baseUrl: 'https://auth.coolztech.com' 
});

// Or Manual Initialization
const client = new window.CoolzAuthClient({ 
  baseUrl: 'https://auth.coolztech.com',
  appKey: 'ct_pub_x82js_example',
  appName: 'My Dashboard'
});
```

### 7.2. Authentication Methods
For developers building custom interfaces, the SDK provides direct methods for session management.

#### Login
Authenticates a user and automatically stores the session token in `localStorage`.
```javascript
async function handleLogin(email, password) {
  try {
    const data = await client.login({ identifier: email, password });
    console.log("Logged in successfully:", data.user);
  } catch (err) {
    alert(err.message); // e.g., "Invalid credentials"
  }
}
```

#### Logout
Clears the session token from `localStorage` and the client instance.
```javascript
function handleLogout() {
  client.logout();
  window.location.reload();
}
```

#### Signup
Creates a new user account.
```javascript
await client.signup({
  username: "johndoe",
  email: "john@example.com",
  password: "securepassword123",
  phone_number: "+1234567890",
  avatar_url: "https://..."
});
```

#### Google Authentication
If your product supports Google Login, you can pass the `idToken` received from Google directly to the SDK.
```javascript
async function handleGoogleLogin(googleResponse) {
  const data = await client.googleLogin(googleResponse.credential);
  console.log("Google Login Success:", data.user);
}
```

### 7.3. Retrieving User Profile
The `getProfile()` method returns the complete user object. This is useful for populating settings pages or navigation bars.

**Response Schema:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Unique user identifier. |
| `username` | String | User's display name. |
| `email` | String | User's registered email address. |
| `phone_number` | String | User's contact number (optional). |
| `avatar_url` | String | URL to the user's profile picture. |
| `two_factor_enabled` | Boolean | Whether 2FA is active for this account. |
| `has_password` | Boolean | `true` if the user has a local password (vs Google-only). |

```javascript
const user = await client.getProfile();
/* 
Example Response:
{
  "id": 42,
  "username": "coolz_dev",
  "email": "dev@coolztech.com",
  "phone_number": "+15550199",
  "avatar_url": "https://i.ibb.co/...",
  "two_factor_enabled": false,
  "has_password": true
}
*/
```

### 7.4. Managing Avatars
Avatars are managed through a secure proxy. The SDK handles the base64 conversion and secure upload to the CoolzTech image repository.

#### Uploading a New Avatar
```javascript
async function handleAvatarUpload(file) {
  try {
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });

    const res = await client.uploadAvatar(base64);
    console.log("Avatar Uploaded:", res.url);
    
    // The res.url can now be saved to the user profile
    await client.updateProfile({ avatar_url: res.url });
  } catch (err) {
    alert("Upload failed: " + err.message);
  }
}
```

### 7.5. Updating Profile Information
You can update user metadata (username, phone number, etc.) using the `updateProfile()` method.

```javascript
async function saveProfile(newData) {
  try {
    const updatedUser = await client.updateProfile({
      username: newData.username,
      phone_number: newData.phone,
      avatar_url: newData.avatarUrl
    });
    alert("Profile updated successfully!");
  } catch (err) {
    console.error("Update failed:", err.message);
  }
}
```

### 7.6. API Error Codes
The SDK throws descriptive errors. Catching these allows you to provide specific feedback to users.

| HTTP Status | Error String (`err.message`) | Context |
|-------------|------------------------------|---------|
| `400` | `Missing required fields` | Required data (e.g., email) was omitted in request. |
| `401` | `Invalid credentials` | Incorrect email/password combination. |
| `401` | `Session expired` | The auth token is no longer valid. |
| `404` | `User not found` | Attempting to fetch/update a non-existent user. |
| `409` | `User already exists` | Email or username is already taken during signup. |
| `429` | `Too many requests` | Rate limit hit (usually for OTP/Login attempts). |

### 7.7. Data Flow Pattern
1. **Request**: The SDK method (e.g., `getProfile`) is called.
2. **Authorization**: The SDK automatically attaches the `ct_token` from `localStorage` to the `Authorization: Bearer <token>` header.
3. **Fetching**: A `fetch` request is sent to the configured `baseUrl`.
4. **Handling**: The SDK parses the JSON response and handles common errors (timeouts, 401 Unauthorized, etc.).
5. **UI Update**: The application receives the data and updates its state/DOM.

## 8. Testing Guidelines for Data Retrieval

To ensure your data retrieval implementation is robust, verify the following:

- [ ] **Authenticated Requests**: Verify that `getProfile()` fails with a 401 error if no token is present.
- [ ] **Error Handling**: Simulate a network failure or server error to ensure the application handles the error gracefully without crashing.
- [ ] **Avatar Optimization**: Ensure that uploaded avatars are displayed correctly in different sizes across the UI.
- [ ] **Real-time Updates**: Verify that the UI reflects profile changes immediately after a successful `updateProfile()` call.

## 9. Sample Integration: Minimal Profile Widget

Building a custom "User Profile" widget is straightforward with the SDK. Below is a minimal implementation that displays the user's name, phone number, and avatar.

```html
<!-- HTML Structure -->
<div id="ct-profile-widget" style="padding: 1rem; border: 1px solid #333; border-radius: 8px;">
  <img id="ct-avatar" src="placeholder.png" width="40" style="border-radius: 50%;">
  <strong id="ct-username">Loading...</strong>
  <p id="ct-phone" style="font-size: 0.8rem; color: #888;"></p>
</div>

<script>
  // 1. Initialize SDK
  const client = new window.CoolzAuthClient({ baseUrl: 'https://auth.coolztech.com' });

  // 2. Fetch and Display Data
  async function loadProfileWidget() {
    try {
      const user = await client.getProfile();
      
      document.getElementById('ct-username').textContent = user.username;
      document.getElementById('ct-phone').textContent = user.phone_number || "No phone added";
      document.getElementById('ct-avatar').src = user.avatar_url || "default-avatar.png";
    } catch (err) {
      console.warn("User not logged in:", err.message);
      document.getElementById('ct-profile-widget').innerHTML = "<p>Please login to see your profile.</p>";
    }
  }

  loadProfileWidget();
</script>
```
