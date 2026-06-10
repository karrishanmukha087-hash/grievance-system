const { execSync } = require('child_process');
const https = require('https');

// Config
const API_KEY = 'rnd_QVkwm899WmGzRjLySIEnx9fVxFIc';
const OWNER_ID = 'tea-d8ko858g4nts73806300';
const SERVICE_NAME = 'public-grievance-system';

// Retrieve Git Remote URL
let repoUrl = '';
try {
  repoUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
} catch (err) {
  // Fallback to reading first argument
  repoUrl = process.argv[2] || '';
}

if (!repoUrl) {
  console.error('[DEPLOY ERROR] Please push your code to GitHub first using scratch/push_to_github.ps1, or pass the repository URL as an argument.');
  process.exit(1);
}

// Convert git SSH URL to HTTPS URL if needed (Render API prefers HTTPS repo URLs)
if (repoUrl.startsWith('git@github.com:')) {
  repoUrl = repoUrl.replace('git@github.com:', 'https://github.com/').replace(/\.git$/, '');
}

console.log(`[DEPLOYING] Deploying repository: ${repoUrl} to Render...`);

const payload = JSON.stringify({
  type: 'web_service',
  name: SERVICE_NAME,
  ownerId: OWNER_ID,
  repo: repoUrl,
  branch: 'main',
  autoDeploy: 'yes',
  serviceDetails: {
    env: 'node',
    buildCommand: 'npm install',
    startCommand: 'node server.js',
    plan: 'free',
    envVars: [
      {
        key: 'DB_TYPE',
        value: 'sqlite'
      },
      {
        key: 'JWT_SECRET',
        value: 'CitizenGrievanceSecuredTokenKey2026!@#'
      },
      {
        key: 'PORT',
        value: '10000'
      }
    ]
  }
});

const options = {
  hostname: 'api.render.com',
  port: 443,
  path: '/v1/services',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const response = JSON.parse(data);
    if (res.statusCode === 201) {
      console.log('\n==================================================');
      console.log('[SUCCESS] Web Service created on Render!');
      console.log(`Service Name: ${response.service.name}`);
      console.log(`Deployment URL: ${response.service.url}`);
      console.log(`Dashboard URL:  https://dashboard.render.com/web/${response.service.id}`);
      console.log('==================================================\n');
      console.log('Render is now downloading your code and building it.');
      console.log('The build process usually takes 2-3 minutes. You can check the URL above shortly!');
    } else {
      console.error('\n[DEPLOY FAILED] Render API returned an error:', response.message || response);
    }
  });
});

req.on('error', (error) => {
  console.error('[DEPLOY ERROR] HTTP request failed:', error.message);
});

req.write(payload);
req.end();
