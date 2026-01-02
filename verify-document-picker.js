#!/usr/bin/env node

/**
 * Simple verification script to check if document picker dependencies are properly installed
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Document Picker Setup...\n');

// Check if package.json has the required dependencies
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

const requiredDeps = [
  'expo-document-picker',
  'expo-file-system',
  'expo-haptics',
  'expo-sharing'
];

console.log('📦 Checking dependencies:');
let allDepsFound = true;

requiredDeps.forEach(dep => {
  if (dependencies[dep]) {
    console.log(`  ✅ ${dep}: ${dependencies[dep]}`);
  } else {
    console.log(`  ❌ ${dep}: NOT FOUND`);
    allDepsFound = false;
  }
});

// Check if app.json has proper configuration
console.log('\n⚙️  Checking app.json configuration:');
const appJsonPath = path.join(__dirname, 'app.json');
if (!fs.existsSync(appJsonPath)) {
  console.error('❌ app.json not found');
  process.exit(1);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const plugins = appJson.expo?.plugins || [];

const requiredPlugins = ['expo-document-picker', 'expo-file-system'];
let allPluginsFound = true;

requiredPlugins.forEach(plugin => {
  if (plugins.includes(plugin)) {
    console.log(`  ✅ ${plugin}: configured`);
  } else {
    console.log(`  ❌ ${plugin}: NOT CONFIGURED`);
    allPluginsFound = false;
  }
});

// Check iOS permissions
console.log('\n📱 Checking iOS permissions:');
const iosConfig = appJson.expo?.ios?.infoPlist || {};
const requiredIOSPermissions = [
  'NSDocumentsFolderUsageDescription',
  'UIFileSharingEnabled',
  'LSSupportsOpeningDocumentsInPlace'
];

let allIOSPermsFound = true;
requiredIOSPermissions.forEach(perm => {
  if (iosConfig[perm]) {
    console.log(`  ✅ ${perm}: ${iosConfig[perm]}`);
  } else {
    console.log(`  ❌ ${perm}: NOT CONFIGURED`);
    allIOSPermsFound = false;
  }
});

// Check Android permissions
console.log('\n🤖 Checking Android permissions:');
const androidPermissions = appJson.expo?.android?.permissions || [];
const requiredAndroidPermissions = [
  'READ_EXTERNAL_STORAGE',
  'WRITE_EXTERNAL_STORAGE'
];

let allAndroidPermsFound = true;
requiredAndroidPermissions.forEach(perm => {
  if (androidPermissions.includes(perm)) {
    console.log(`  ✅ ${perm}: configured`);
  } else {
    console.log(`  ❌ ${perm}: NOT CONFIGURED`);
    allAndroidPermsFound = false;
  }
});

// Summary
console.log('\n📋 Summary:');
if (allDepsFound && allPluginsFound && allIOSPermsFound && allAndroidPermsFound) {
  console.log('✅ All document picker requirements are properly configured!');
  console.log('\n💡 If you\'re still having issues:');
  console.log('   1. Try running: expo install expo-document-picker');
  console.log('   2. Clear cache: expo r -c');
  console.log('   3. Rebuild the app: expo run:ios or expo run:android');
  console.log('   4. Check device permissions in Settings');
} else {
  console.log('❌ Some requirements are missing. Please fix the issues above.');
  process.exit(1);
}

console.log('\n🚀 Ready to test document picker!');