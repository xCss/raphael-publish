import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/mocks/virtualPwaRegisterReact.ts', import.meta.url))
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.ts']
    }
});
