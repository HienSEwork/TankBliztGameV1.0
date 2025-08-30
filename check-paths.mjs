import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    // Kiểm tra đường dẫn assets không bắt đầu bằng /
    const assetMatches = line.match(/["'](?!\/)([^"']*assets\/[^"']*)["']/g);
    if (assetMatches) {
      issues.push(`Line ${index + 1}: ${assetMatches.join(', ')}`);
    }

    // Kiểm tra đường dẫn styles.css không bắt đầu bằng /
    const styleMatches = line.match(/["'](?!\/)styles\.css["']/g);
    if (styleMatches) {
      issues.push(`Line ${index + 1}: ${styleMatches.join(', ')}`);
    }

    // Kiểm tra đường dẫn js không bắt đầu bằng /
    const jsMatches = line.match(/["'](?!\/)([^"']*js\/[^"']*)["']/g);
    if (jsMatches) {
      issues.push(`Line ${index + 1}: ${jsMatches.join(', ')}`);
    }
  });

  return issues;
}

function scanDirectory(dir, extensions = ['.html', '.js']) {
  const files = readdirSync(dir);
  let allIssues = [];

  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      allIssues = allIssues.concat(scanDirectory(fullPath, extensions));
    } else if (extensions.includes(extname(file))) {
      console.log(`Checking: ${fullPath}`);
      const issues = checkFile(fullPath);
      if (issues.length > 0) {
        console.log(`  Issues found in ${fullPath}:`);
        issues.forEach(issue => console.log(`    ${issue}`));
        allIssues = allIssues.concat(issues.map(issue => `${fullPath}: ${issue}`));
      }
    }
  }

  return allIssues;
}

console.log('🔍 Checking asset paths in public directory...\n');

const issues = scanDirectory('public');

if (issues.length === 0) {
  console.log('✅ All asset paths are correctly formatted!');
} else {
  console.log(`\n❌ Found ${issues.length} issues with asset paths:`);
  issues.forEach(issue => console.log(`  ${issue}`));
}
