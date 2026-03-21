export function normalizeRuntimeEnv(value?: string | null): string {
    if (!value) return '';

    const trimmed = value.trim().replace(/[\r\n]+/g, '');

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1).trim();
    }

    return trimmed;
}
