export function maskSecretValue(value: string) {
    if (!value.trim()) return '';

    if (value.length <= 4) {
        return `${value.slice(0, 1)}${'*'.repeat(Math.max(1, value.length - 2))}${value.slice(-1)}`;
    }

    const prefixLength = value.length > 10 ? 6 : 2;
    const suffixLength = value.length > 10 ? 4 : 2;
    const hiddenLength = Math.min(8, Math.max(1, value.length - prefixLength - suffixLength));

    return `${value.slice(0, prefixLength)}${'*'.repeat(hiddenLength)}${value.slice(value.length - suffixLength)}`;
}
