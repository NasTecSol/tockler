import fs from 'fs-extra';
import { builtinModules } from 'module';
import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// Function to copy migrations to dist-electron
function copyMigrations() {
    return {
        name: 'copy-migrations',
        closeBundle() {
            const srcDir = resolve(__dirname, 'src/drizzle/migrations');
            const destDir = resolve(__dirname, 'dist-electron/drizzle/migrations');
            fs.copySync(srcDir, destDir, { overwrite: true });
            console.log('✓ Drizzle migrations copied to dist-electron');
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, resolve(__dirname, '..'), '');
    console.log('--- Vite LoadEnv Debug ---');
    console.log('Mode:', mode);
    console.log('EnvDir:', resolve(__dirname, '..'));
    console.log('HR_BACKEND_URL:', env.HR_BACKEND_URL);
    console.log('--- End Debug ---');

    return {
        envDir: '../',
        plugins: [
            electron([
                {
                    // Main process entry
                    entry: 'src/index.ts',
                    onstart(options) {
                        options.startup();
                    },
                    vite: {
                        define: {
                            'process.env.HR_BACKEND_URL': JSON.stringify(env.HR_BACKEND_URL),
                            'process.env.VITE_HR_BACKEND_URL': JSON.stringify(env.VITE_HR_BACKEND_URL),
                        },
                        build: {
                            rollupOptions: {
                                external: [...builtinModules, 'better-sqlite3', 'active-win'],
                            },
                        },
                    },
                },
                {
                    // Preload scripts
                    entry: 'src/preloadStuff.ts',
                },
                {
                    // Worker thread
                    entry: 'src/drizzle/worker/dbWorker.ts',
                    onstart(options) {
                        options.reload();
                    },
                    vite: {
                        define: {
                            'process.env.HR_BACKEND_URL': JSON.stringify(env.HR_BACKEND_URL),
                            'process.env.VITE_HR_BACKEND_URL': JSON.stringify(env.VITE_HR_BACKEND_URL),
                        },
                        build: {
                            rollupOptions: {
                                external: [...builtinModules, 'better-sqlite3'],
                            },
                        },
                    },
                },
            ]),
            renderer(),
            copyMigrations(),
        ],
    };
});
