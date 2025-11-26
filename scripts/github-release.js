#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(process.cwd());
const androidDir = path.join(workspaceRoot, 'android');
const outputDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
const builtApk = path.join(outputDir, 'app-release.apk');

const packageJson = require(path.join(workspaceRoot, 'package.json'));
const versionRaw = String(packageJson.version ?? '').trim();
if (!versionRaw.length) {
  throw new Error('Missing version in package.json');
}

const version = versionRaw.startsWith('v') ? versionRaw.slice(1) : versionRaw;
const tagName = versionRaw.startsWith('v') ? versionRaw : `v${version}`;
const assetName = `tslscaner-${version}.apk`;
const assetPath = path.join(outputDir, assetName);

const gradleWrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const ghCommand = process.env.GH_CLI_PATH ?? 'gh';

const releaseTitle = `tslscaner ${tagName}`;
const releaseNotes = `Automated APK created on ${new Date().toISOString()} for ${tagName}.`;

const ensureApk = () => {
  if (!fs.existsSync(builtApk)) {
    throw new Error(`Gradle build did not produce ${builtApk}. Check gradle logs for errors.`);
  }
};

const buildRelease = () => {
  console.log('⚙️  Assembling Android release...');
  execFileSync(gradleWrapper, ['assembleRelease'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  ensureApk();
};

const prepareAsset = () => {
  fs.rmSync(assetPath, { force: true });
  fs.copyFileSync(builtApk, assetPath);
};

const execGh = (args) => {
  execFileSync(ghCommand, args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
};

const ensureGhCliAvailable = () => {
  try {
    execFileSync(ghCommand, ['--version'], {
      cwd: workspaceRoot,
      stdio: 'ignore',
    });
  } catch (err) {
    console.error(
      'GitHub CLI is required for publishing releases. Install it from https://cli.github.com/ or set GH_CLI_PATH to point to the binary.',
    );
    process.exit(1);
  }
};

const releaseExists = () => {
  try {
    execFileSync(ghCommand, ['release', 'view', tagName], {
      cwd: workspaceRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
};

const publishRelease = () => {
  ensureGhCliAvailable();
  if (releaseExists()) {
    console.log('📦 Release already exists, uploading fresh APK asset...');
    execGh(['release', 'upload', tagName, assetPath, '--clobber']);
    execGh(['release', 'edit', tagName, '--title', releaseTitle, '--notes', releaseNotes]);
  } else {
    console.log('🚀 Creating GitHub release...');
    execGh(['release', 'create', tagName, assetPath, '--title', releaseTitle, '--notes', releaseNotes]);
  }
};

const run = () => {
  buildRelease();
  prepareAsset();
  publishRelease();
};

run();
