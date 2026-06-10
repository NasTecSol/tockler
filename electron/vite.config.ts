import fs from 'fs-extra';
import { builtinModules } from 'module';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// Function to copy migrations to dist-electron
function copyMigrations() {
    const srcDir = resolve(__dirname, 'src/drizzle/migrations');
    const destDir = resolve(__dirname, 'dist-electron/drizzle/migrations');

    // Ensure destination directory exists
    fs.ensureDirSync(resolve(__dirname, 'dist-electron/drizzle'));

    console.log(`Copying migrations from ${srcDir} to ${destDir}`);
    try {
        if (fs.existsSync(srcDir)) {
            fs.copySync(srcDir, destDir, { overwrite: true });
            console.log('✓ Drizzle migrations copied to dist-electron');
        } else {
            console.warn('⚠ Migrations source directory not found:', srcDir);
        }
    } catch (err) {
        console.error('Failed to copy migrations:', err);
    }
}

function copyMigrationsPlugin() {
    return {
        name: 'copy-migrations',
        writeBundle() {
            copyMigrations();
        },
    };
}

export default defineConfig({
    plugins: [
        electron([
            {
                // Main process entry
                entry: 'src/index.ts',
                onstart(options) {
                    copyMigrations();
                    options.startup();
                },
                vite: {
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
                    copyMigrations();
                    options.reload();
                },
                vite: {
                    build: {
                        rollupOptions: {
                            external: [...builtinModules, 'better-sqlite3'],
                        },
                    },
                },
            },
        ]),
        renderer(),
        copyMigrationsPlugin(),
    ],
});
