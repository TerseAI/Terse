function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.style.colorScheme = savedTheme;
}

function toggleTheme() {
    const root = document.documentElement;
    const newTheme = root.style.colorScheme === 'dark' ? 'light' : 'dark';

    root.style.colorScheme = newTheme;
    localStorage.setItem('theme', newTheme);
}

export type Theme = 'dark' | 'light';

function CurrentTheme() {
    const root = document.documentElement;
    return root.style.colorScheme as Theme;
}

export { initTheme, toggleTheme, CurrentTheme };