# iPhone push notifications

ClearanceLink uses Expo push tokens. The app requests notification permission, saves each signed-in device's token with the API, and the API sends clearance updates through Expo. The `expo-notifications` config plugin and EAS project ID are already set in `app.json`.

The supplied Apple private key stays in Downloads. The ignored `.env` contains its path and Key ID, so the key bytes are not added to the repository.

The Apple Push Notifications key is uploaded and assigned in EAS to `@gideon-gfx/institution-clearance`, bundle identifier `com.gideongfx.clearancelink`, under Apple Team `89989AB75U`. EAS lists Developer Portal Key ID `86R4MM58J2`. The upload was performed without Apple account authentication, so EAS could not validate the key's capability. Confirm in Apple Developer that it is an Apple Push Notifications service key.

To receive notifications, create and install an iOS development or production build with signing credentials. No iOS build credentials were configured during the push-key upload. Expo Go cannot receive remote push notifications for this Expo SDK. Sign in on that build and allow notifications. The API must be reachable from the phone. Android requires its separate FCM V1 credentials in EAS.
