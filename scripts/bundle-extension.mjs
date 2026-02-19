// Simple bundler to inline all imports for content script
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');

function inlineImports(filePath, processedFiles = new Set()) {
    if (processedFiles.has(filePath)) {
        return ''; // Avoid circular dependencies
    }
    processedFiles.add(filePath);

    if (!existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return '';
    }

    let content = readFileSync(filePath, 'utf-8');
    const importRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[2];
        const fullPath = resolve(dirname(filePath), importPath);

        // Recursively inline the imported file
        const importedContent = inlineImports(fullPath, processedFiles);

        // Remove the import statement
        content = content.replace(match[0], `// Inlined from ${importPath}\n${importedContent}`);
    }

    return content;
}

// Bundle content script
const contentScriptPath = resolve(distDir, 'src/extension/contentScript/index.js');
console.log('Bundling content script...');
const bundled = inlineImports(contentScriptPath);
writeFileSync(contentScriptPath, bundled);
console.log('✓ Content script bundled');

// Bundle background script
const backgroundPath = resolve(distDir, 'src/extension/background/index.js');
console.log('Bundling background script...');
const bundledBg = inlineImports(backgroundPath);
writeFileSync(backgroundPath, bundledBg);
console.log('✓ Background script bundled');
