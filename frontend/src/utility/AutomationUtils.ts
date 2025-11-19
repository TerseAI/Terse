export function getDefaultAutomationName(
    totalCount: number = 0
): string {
    // If inputs or output are empty, generate "Automation #x"
    return `Automation #${totalCount + 1}`;
}
