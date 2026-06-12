require('dotenv').config();
const { notarize } = require('@electron/notarize');
const { join } = require('path');
const { existsSync } = require('fs');

exports.default = async function notarizing(context) {
    const { electronPlatformName, arch } = context;

    
    if (context.packager.platform.nodeName === 'mas' || process.env.IS_MAS_BUILD) {
    console.log('Skipping notarization for MAS build');
    return;
  }

    // ─────────────────────────────────────────
    // Skip: non-macOS builds
    // ─────────────────────────────────────────
    if (electronPlatformName !== 'darwin') {
        console.log('Skipping notarization: not a macOS build');
        return;
    }

    // ─────────────────────────────────────────
    // Skip: pull requests
    // ─────────────────────────────────────────
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
        console.log('Skipping notarization: pull request');
        return;
    }

    // ─────────────────────────────────────────
    // Skip: local builds
    // ─────────────────────────────────────────
    if (params.packager.config.extraMetadata?.local_build) {
        console.log('Skipping notarization: local build');
        return;
    }

    // ─────────────────────────────────────────
    // FIX: Skip MAS (Mac App Store) builds
    // MAS builds do NOT need notarization.
    // Apple handles verification on their side.
    // ─────────────────────────────────────────
    const appOutDir = params.appOutDir || '';
    if (appOutDir.includes('mas') || appOutDir.includes('-mas-')) {
        console.log('Skipping notarization: Mac App Store build (MAS)');
        return;
    }

    // ─────────────────────────────────────────
    // Skip: Apple credentials not configured
    // ─────────────────────────────────────────
    if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
        console.log('Skipping notarization: APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set');
        return;
    }

    // ─────────────────────────────────────────
    // FIX: Use appInfo.id not appInfo.appId
    // ─────────────────────────────────────────
    const appBundleId = params.packager.appInfo.id;
    const appPath = join(
        params.appOutDir,
        `${params.packager.appInfo.productFilename}.app`
    );

    console.log('App Path:', appPath);
    console.log('App Bundle ID:', appBundleId);

    if (!existsSync(appPath)) {
        throw new Error(`Cannot find application at: ${appPath}`);
    }

    console.info('Notarizing application...', {
        appBundleId,
        appPath,
        teamId: process.env.APPLE_TEAM_ID,
    });

    try {
        await notarize({
            tool: 'notarytool',
            appPath,
            teamId: process.env.APPLE_TEAM_ID,
            appleId: process.env.APPLE_ID,
            // FIX: was APPLE_ID_PASSWORD — correct name is APPLE_APP_SPECIFIC_PASSWORD
            appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        });

        console.info('Notarization completed successfully');
    } catch (error) {
        console.error('Notarization failed:', error);
        throw error;
    }
};