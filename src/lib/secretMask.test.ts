import { describe, expect, test } from 'vitest';
import { maskSecretValue } from './secretMask';

describe('secret mask', () => {
    test('masks long secrets while preserving edges', () => {
        expect(maskSecretValue('sk-fjk1234567890basd')).toBe('sk-fjk********basd');
    });

    test('returns empty text for blank secrets', () => {
        expect(maskSecretValue('   ')).toBe('');
    });
});
