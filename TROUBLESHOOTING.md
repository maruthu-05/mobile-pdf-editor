# File Picker Troubleshooting Guide

## "File picker not available in this device" Error

If you're seeing this error when trying to select PDF files, here are the steps to diagnose and fix the issue:

### 1. Check Platform Support

The file picker requires:
- **iOS**: iOS 11.0 or later
- **Android**: Android 6.0 (API level 23) or later

### 2. Verify App Configuration

Ensure your `app.json` includes the document picker plugin:

```json
{
  "expo": {
    "plugins": [
      "expo-document-picker",
      "expo-file-system"
    ]
  }
}
```

### 3. Check Permissions (Android)

For Android, ensure these permissions are in your `app.json`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "MANAGE_DOCUMENTS"
      ]
    }
  }
}
```

### 4. iOS Configuration

For iOS, ensure these permissions are in your `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSDocumentsFolderUsageDescription": "This app needs access to documents to manage PDF files",
        "UIFileSharingEnabled": true,
        "LSSupportsOpeningDocumentsInPlace": true
      }
    }
  }
}
```

### 5. Development vs Production

**Expo Go (Development):**
- File picker has limited functionality in Expo Go
- Some file types may not be accessible
- Consider using a development build for full functionality

**Development Build/Production:**
- Full file picker functionality available
- All file types accessible based on permissions

### 6. Device-Specific Issues

**iOS Simulator:**
- Limited file system access
- May not have access to Files app
- Test on physical device for accurate results

**Android Emulator:**
- May not have file manager installed
- Limited storage access
- Test on physical device for accurate results

### 7. Debugging Steps

1. **Check Console Logs:**
   ```javascript
   console.log('Platform:', Platform.OS);
   console.log('Document picker available:', DocumentPickerUtils.isAvailable());
   ```

2. **Test with Different File Types:**
   - Try selecting different file types to isolate PDF-specific issues
   - Use `type: '*/*'` to allow all file types temporarily

3. **Check App Permissions:**
   - Go to device Settings > Apps > [Your App] > Permissions
   - Ensure storage/file permissions are granted

4. **Restart App:**
   - Close and restart the app completely
   - Clear app cache if necessary

### 8. Common Solutions

**Solution 1: Rebuild the App**
```bash
# Clear Expo cache
expo r -c

# For development builds
expo run:ios --clear-cache
expo run:android --clear-cache
```

**Solution 2: Update Dependencies**
```bash
npm update expo-document-picker expo-file-system
```

**Solution 3: Use Development Build**
```bash
# Create development build
expo install expo-dev-client
expo run:ios
expo run:android
```

### 9. Alternative File Access Methods

If the document picker still doesn't work, consider these alternatives:

1. **Camera Roll Access** (for images converted to PDF)
2. **Cloud Storage Integration** (Google Drive, Dropbox)
3. **Email Attachments** (via deep linking)
4. **Web Upload** (if web version is available)

### 10. Testing Checklist

- [ ] App runs on physical device (not just simulator/emulator)
- [ ] Permissions granted in device settings
- [ ] Using development build (not Expo Go) for full functionality
- [ ] Latest versions of expo-document-picker and expo-file-system
- [ ] Correct plugin configuration in app.json
- [ ] Console shows no permission errors

### 11. Getting Help

If the issue persists:

1. **Check Console Logs:** Look for specific error messages
2. **Test on Different Devices:** Try iOS and Android devices
3. **Create Minimal Reproduction:** Test with a simple document picker example
4. **Check Expo Forums:** Search for similar issues
5. **File Bug Report:** Include device info, OS version, and error logs

### 12. Debug Mode

Enable debug logging by adding this to your app:

```javascript
// Add to your main App.js or index.js
if (__DEV__) {
  console.log('Debug mode enabled');
  console.log('Platform:', Platform.OS, Platform.Version);
  console.log('Expo version:', Constants.expoVersion);
}
```

This will help identify platform-specific issues and version compatibility problems.