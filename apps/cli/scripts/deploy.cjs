const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Adjusted paths for scripts/deploy.js (one level deeper)
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = require(packageJsonPath);

console.log(`Preparing to deploy ${packageJson.name} v${packageJson.version}...`);

// Function to run command with error handling
function runCommand(command) {
    try {
        console.log(`\n> ${command}`);
        // Run in rootDir
        execSync(command, { stdio: 'inherit', cwd: rootDir });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        process.exit(1);
    }
}

// Main deployment flow
async function deploy() {
    try {
        // 1. Clean
        console.log('\nStep 1: Cleaning...');
        const distDir = path.join(rootDir, 'dist');
        if (fs.existsSync(distDir)) {
            fs.rmSync(distDir, { recursive: true });
        }

        // 2. Install dependencies (ensure clean slate)
        console.log('\nStep 2: Installing dependencies...');
        runCommand('pnpm install');

        // 3. Build
        console.log('\nStep 3: Building...');
        runCommand('pnpm run build');

        // 4. Verify artifacts
        const distFile = path.join(rootDir, 'dist/index.js');
        const templatesDir = path.join(rootDir, 'templates');
        
        if (!fs.existsSync(distFile)) {
            throw new Error('Build failed: dist/index.js not found');
        }
        if (!fs.existsSync(templatesDir)) {
            throw new Error('Verification failed: templates directory not found');
        }

        // 5. Publish
        rl.question(`\nReady to publish version ${packageJson.version}. Continue? (y/N): `, (answer) => {
            if (answer.toLowerCase() === 'y') {
                console.log('\nStep 5: Publishing...');
                // Using --access public by default as configured in package.json
                runCommand('pnpm publish');
                console.log('\nSuccessfully published!');
            } else {
                console.log('\nAborted.');
            }
            rl.close();
        });

    } catch (error) {
        console.error('\nDeployment failed:', error.message);
        rl.close();
        process.exit(1);
    }
}

deploy();
