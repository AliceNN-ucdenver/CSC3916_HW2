#!/usr/bin/env node
/**
 * Dependency Freshness Fitness Function
 *
 * OWASP A06:2021 - Vulnerable and Outdated Components Prevention
 *
 * Validates that all npm dependencies are within the configured age threshold
 * to prevent accumulation of known CVEs and security vulnerabilities.
 *
 * Exit codes:
 *   0 - All dependencies are fresh
 *   1 - One or more dependencies exceed age threshold
 *
 * Environment variables:
 *   MAX_DEPENDENCY_AGE_DAYS - Maximum allowed dependency age (default: 90)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_DEPENDENCY_AGE_DAYS = parseInt(process.env.MAX_DEPENDENCY_AGE_DAYS || '90', 10);

// Security-critical packages (HIGH severity when stale)
const CRITICAL_PACKAGES = [
  'bcrypt',
  'passport',
  'passport-jwt',
  'passport-http',
  'jsonwebtoken',
  'express'
];

/**
 * Get the publish date and calculate age for a specific package version
 * @param {string} packageName - The package name
 * @param {string} version - The package version
 * @returns {object} Object containing ageDays, publishDate, and optional error
 */
function getDependencyAge(packageName, version) {
  try {
    // Query npm registry for publish date
    const timeOutput = execSync(
      `npm view ${packageName}@${version} time.modified`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();

    const publishDate = new Date(timeOutput);
    const ageDays = Math.floor(
      (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      ageDays,
      publishDate: publishDate.toISOString().split('T')[0]
    };
  } catch (error) {
    return {
      ageDays: null,
      publishDate: null,
      error: error.message
    };
  }
}

/**
 * Extract current version from package-lock.json for a given package
 * Falls back to version range from package.json
 * @param {string} packageName - The package name
 * @param {string} versionRange - The version range from package.json
 * @returns {string} The current installed version
 */
function getCurrentVersion(packageName, versionRange) {
  try {
    // Try package-lock.json first
    const lockfilePath = path.join(process.cwd(), 'package-lock.json');
    if (fs.existsSync(lockfilePath)) {
      const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));

      // Check top-level packages in v2+ lockfile format
      if (lockfile.packages) {
        const pkgKey = `node_modules/${packageName}`;
        if (lockfile.packages[pkgKey]) {
          return lockfile.packages[pkgKey].version;
        }
      }

      // Check dependencies in v1 lockfile format
      if (lockfile.dependencies && lockfile.dependencies[packageName]) {
        return lockfile.dependencies[packageName].version;
      }
    }

    // Fallback: use npm ls
    const lsOutput = execSync(`npm ls ${packageName} --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    const lsData = JSON.parse(lsOutput);
    if (lsData.dependencies && lsData.dependencies[packageName]) {
      return lsData.dependencies[packageName].version;
    }
  } catch {
    // Fallback: strip version range prefix
  }

  return versionRange.replace(/^[\^~>=<]/, '');
}

/**
 * Main fitness function - checks all dependencies for freshness
 */
function checkDependencyFreshness() {
  console.log(`\n🔍 Dependency Freshness Check (threshold: ${MAX_DEPENDENCY_AGE_DAYS} days)\n`);

  // Load package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ Error: package.json not found in current directory');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Combine dependencies and devDependencies
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  if (Object.keys(allDeps).length === 0) {
    console.log('✅ No dependencies to check');
    process.exit(0);
  }

  const violations = [];
  const warnings = [];

  // Check each dependency
  for (const [name, versionRange] of Object.entries(allDeps)) {
    const currentVersion = getCurrentVersion(name, versionRange);
    const { ageDays, publishDate, error } = getDependencyAge(name, currentVersion);

    if (error) {
      warnings.push(`⚠️  Could not check ${name}@${currentVersion}: ${error}`);
      continue;
    }

    if (ageDays > MAX_DEPENDENCY_AGE_DAYS) {
      const severity = CRITICAL_PACKAGES.includes(name) ? 'HIGH' : 'MEDIUM';
      const isDevDep = packageJson.devDependencies && packageJson.devDependencies[name];

      violations.push({
        name,
        version: currentVersion,
        ageDays,
        publishDate,
        severity,
        type: isDevDep ? 'dev' : 'prod'
      });
    }
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log('Warnings:\n');
    warnings.forEach(w => console.log(w));
    console.log();
  }

  // Report violations
  if (violations.length > 0) {
    // Sort by age descending (oldest first)
    violations.sort((a, b) => b.ageDays - a.ageDays);

    console.error('❌ Dependency Freshness Check Failed\n');
    console.error('┌─────────────────────────────┬────────────┬────────────┬──────────┬──────┐');
    console.error('│ Package                     │ Version    │ Age (days) │ Severity │ Type │');
    console.error('├─────────────────────────────┼────────────┼────────────┼──────────┼──────┤');

    violations.forEach(v => {
      const pkg = v.name.padEnd(27);
      const ver = v.version.padEnd(10);
      const age = v.ageDays.toString().padStart(10);
      const sev = v.severity.padEnd(8);
      const type = v.type.padEnd(4);
      console.error(`│ ${pkg} │ ${ver} │ ${age} │ ${sev} │ ${type} │`);
    });

    console.error('└─────────────────────────────┴────────────┴────────────┴──────────┴──────┘\n');

    // Categorize violations
    const highSeverity = violations.filter(v => v.severity === 'HIGH');
    const mediumSeverity = violations.filter(v => v.severity === 'MEDIUM');

    if (highSeverity.length > 0) {
      console.error(`🔴 ${highSeverity.length} security-critical package(s) are stale:`);
      highSeverity.forEach(v => {
        console.error(`   - ${v.name}@${v.version} (${v.ageDays} days old, published ${v.publishDate})`);
      });
      console.error();
    }

    if (mediumSeverity.length > 0) {
      console.error(`🟡 ${mediumSeverity.length} package(s) exceed threshold:`);
      mediumSeverity.forEach(v => {
        console.error(`   - ${v.name}@${v.version} (${v.ageDays} days old, published ${v.publishDate})`);
      });
      console.error();
    }

    console.error('📋 Remediation Steps:');
    console.error('   1. Review changelogs: npm view <package> versions');
    console.error('   2. Update packages: npm install <package>@latest');
    console.error('   3. Run tests after each update to isolate breaking changes');
    console.error('   4. For unmaintained packages, evaluate alternatives\n');

    // Write report for CI artifact
    const report = {
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'local',
      threshold: MAX_DEPENDENCY_AGE_DAYS,
      violations: violations,
      totalDependencies: Object.keys(allDeps).length,
      staleCount: violations.length,
      highSeverityCount: highSeverity.length,
      mediumSeverityCount: mediumSeverity.length
    };

    fs.writeFileSync(
      'freshness-report.json',
      JSON.stringify(report, null, 2)
    );

    process.exit(1);
  }

  console.log(`✅ All ${Object.keys(allDeps).length} dependencies are within ${MAX_DEPENDENCY_AGE_DAYS}-day threshold\n`);
  process.exit(0);
}

// Execute if run directly
if (require.main === module) {
  checkDependencyFreshness();
}

// Export for testing
module.exports = {
  getDependencyAge,
  getCurrentVersion,
  checkDependencyFreshness,
  CRITICAL_PACKAGES,
  MAX_DEPENDENCY_AGE_DAYS
};
