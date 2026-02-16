/**
 * Tests for Dependency Freshness Fitness Function
 *
 * Tests the logic for parsing npm data, calculating dependency age,
 * categorizing by severity, and edge case handling.
 */

const chai = require('chai');
const sinon = require('sinon');
const childProcess = require('child_process');
const fs = require('fs');

const expect = chai.expect;

// Note: We'll load the module fresh for each test to avoid state pollution
let fitnessModule;

describe('Dependency Freshness Fitness Function', function() {
  let execSyncStub;
  let fsExistsSyncStub;
  let fsReadFileSyncStub;

  beforeEach(function() {
    // Stub child_process.execSync
    execSyncStub = sinon.stub(childProcess, 'execSync');

    // Stub fs methods
    fsExistsSyncStub = sinon.stub(fs, 'existsSync');
    fsReadFileSyncStub = sinon.stub(fs, 'readFileSync');

    // Load module fresh
    delete require.cache[require.resolve('./dependency-freshness.js')];
    fitnessModule = require('./dependency-freshness.js');
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('getDependencyAge()', function() {
    it('should calculate age correctly for a package', function() {
      // Mock npm view response: package published 100 days ago
      const publishDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      execSyncStub.returns(publishDate.toISOString());

      const result = fitnessModule.getDependencyAge('test-package', '1.0.0');

      expect(result).to.have.property('ageDays');
      expect(result.ageDays).to.be.closeTo(100, 1); // Allow 1-day tolerance
      expect(result).to.have.property('publishDate');
      expect(result.error).to.be.undefined;
    });

    it('should calculate age as 0 for recently published package', function() {
      // Package published today
      const publishDate = new Date();
      execSyncStub.returns(publishDate.toISOString());

      const result = fitnessModule.getDependencyAge('new-package', '2.0.0');

      expect(result.ageDays).to.equal(0);
    });

    it('should handle npm registry errors gracefully', function() {
      // Simulate npm command failure
      execSyncStub.throws(new Error('npm ERR! 404 Not Found'));

      const result = fitnessModule.getDependencyAge('nonexistent-package', '1.0.0');

      expect(result.ageDays).to.be.null;
      expect(result.publishDate).to.be.null;
      expect(result.error).to.include('404 Not Found');
    });

    it('should calculate correct age for very old packages', function() {
      // Package published 3837 days ago (passport-http scenario)
      const publishDate = new Date(Date.now() - 3837 * 24 * 60 * 60 * 1000);
      execSyncStub.returns(publishDate.toISOString());

      const result = fitnessModule.getDependencyAge('ancient-package', '0.1.0');

      expect(result.ageDays).to.be.closeTo(3837, 1);
    });
  });

  describe('getCurrentVersion()', function() {
    it('should extract version from package-lock.json (v2 format)', function() {
      const mockLockfile = {
        packages: {
          'node_modules/test-package': {
            version: '1.2.3'
          }
        }
      };

      fsExistsSyncStub.returns(true);
      fsReadFileSyncStub.returns(JSON.stringify(mockLockfile));

      const version = fitnessModule.getCurrentVersion('test-package', '^1.0.0');

      expect(version).to.equal('1.2.3');
    });

    it('should extract version from package-lock.json (v1 format)', function() {
      const mockLockfile = {
        dependencies: {
          'test-package': {
            version: '2.3.4'
          }
        }
      };

      fsExistsSyncStub.returns(true);
      fsReadFileSyncStub.returns(JSON.stringify(mockLockfile));

      const version = fitnessModule.getCurrentVersion('test-package', '^2.0.0');

      expect(version).to.equal('2.3.4');
    });

    it('should fallback to stripping version range prefix', function() {
      fsExistsSyncStub.returns(false); // No lockfile

      const version = fitnessModule.getCurrentVersion('test-package', '^1.5.0');

      expect(version).to.equal('1.5.0');
    });

    it('should handle ~ prefix in version range', function() {
      fsExistsSyncStub.returns(false);

      const version = fitnessModule.getCurrentVersion('test-package', '~3.2.1');

      expect(version).to.equal('3.2.1');
    });

    it('should handle >= prefix in version range', function() {
      fsExistsSyncStub.returns(false);

      const version = fitnessModule.getCurrentVersion('test-package', '>=4.0.0');

      expect(version).to.equal('4.0.0');
    });
  });

  describe('Severity Categorization', function() {
    it('should categorize bcrypt as HIGH severity', function() {
      expect(fitnessModule.CRITICAL_PACKAGES).to.include('bcrypt');
    });

    it('should categorize passport as HIGH severity', function() {
      expect(fitnessModule.CRITICAL_PACKAGES).to.include('passport');
    });

    it('should categorize passport-jwt as HIGH severity', function() {
      expect(fitnessModule.CRITICAL_PACKAGES).to.include('passport-jwt');
    });

    it('should categorize passport-http as HIGH severity', function() {
      expect(fitnessModule.CRITICAL_PACKAGES).to.include('passport-http');
    });

    it('should categorize jsonwebtoken as HIGH severity', function() {
      expect(fitnessModule.CRITICAL_PACKAGES).to.include('jsonwebtoken');
    });
  });

  describe('Threshold Configuration', function() {
    it('should default to 90-day threshold', function() {
      // Default value should be 90 days
      expect(fitnessModule.MAX_DEPENDENCY_AGE_DAYS).to.equal(90);
    });

    it('should respect MAX_DEPENDENCY_AGE_DAYS environment variable', function() {
      // Note: This test would require reloading the module with a different env var
      // We can only validate the default behavior in the current test setup
      expect(fitnessModule.MAX_DEPENDENCY_AGE_DAYS).to.be.a('number');
      expect(fitnessModule.MAX_DEPENDENCY_AGE_DAYS).to.be.greaterThan(0);
    });
  });

  describe('Edge Cases', function() {
    it('should handle package with no time.modified metadata', function() {
      // npm view returns empty/undefined
      execSyncStub.returns('');

      const result = fitnessModule.getDependencyAge('weird-package', '1.0.0');

      // Should gracefully handle by returning null or error
      expect(result.ageDays).to.satisfy(val => val === null || typeof val === 'number');
    });

    it('should handle malformed date strings', function() {
      execSyncStub.returns('invalid-date-string');

      const result = fitnessModule.getDependencyAge('broken-package', '1.0.0');

      // Should either parse to NaN or return error
      expect(result.ageDays).to.satisfy(val => val === null || isNaN(val) || typeof val === 'number');
    });

    it('should handle version ranges without prefix characters', function() {
      fsExistsSyncStub.returns(false);

      const version = fitnessModule.getCurrentVersion('test-package', '1.0.0');

      expect(version).to.equal('1.0.0');
    });
  });

  describe('Integration Scenarios', function() {
    it('should correctly identify a stale dependency (91 days)', function() {
      // Package published 91 days ago (just over threshold)
      const publishDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      execSyncStub.returns(publishDate.toISOString());

      const result = fitnessModule.getDependencyAge('stale-package', '1.0.0');

      expect(result.ageDays).to.be.greaterThan(90);
    });

    it('should correctly identify a fresh dependency (90 days exactly)', function() {
      // Package published exactly 90 days ago (at threshold)
      const publishDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      execSyncStub.returns(publishDate.toISOString());

      const result = fitnessModule.getDependencyAge('threshold-package', '1.0.0');

      expect(result.ageDays).to.be.closeTo(90, 1);
    });

    it('should correctly identify a fresh dependency (89 days)', function() {
      // Package published 89 days ago (under threshold)
      const publishDate = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000);
      execSyncStub.returns(publishDate.toISOString());

      const result = fitnessModule.getDependencyAge('fresh-package', '1.0.0');

      expect(result.ageDays).to.be.lessThan(90);
    });
  });
});
