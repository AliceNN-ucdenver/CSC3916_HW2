# CI/CD Setup Instructions

## GitHub Actions Workflow

Due to GitHub App permissions, the CI workflow YAML cannot be created automatically. Please follow these steps to enable CI/CD:

### Step 1: Configure GitHub Secrets

Navigate to repository Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

```
SECRET_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
UNIQUE_KEY=csc3916_hw2_unique_identifier
DEFAULT_USER=defaultUser
DEFAULT_PASSWORD=defaultPassword123!
```

**IMPORTANT**: `SECRET_KEY` must be ≥32 characters. Use the command above to generate a cryptographically secure key.

### Step 2: Create Workflow File

Create `.github/workflows/ci.yml` with the following content:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, claude/** ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Create .env from secrets
        run: |
          echo "SECRET_KEY=${{ secrets.SECRET_KEY }}" >> .env
          echo "UNIQUE_KEY=${{ secrets.UNIQUE_KEY }}" >> .env
          echo "DEFAULT_USER=${{ secrets.DEFAULT_USER }}" >> .env
          echo "DEFAULT_PASSWORD=${{ secrets.DEFAULT_PASSWORD }}" >> .env
          echo "PORT=3000" >> .env

      - name: Run tests
        run: npm test

      - name: Security audit
        run: npm audit --audit-level=high
        continue-on-error: false
```

### Step 3: Verify Workflow

1. Commit and push the workflow file
2. Navigate to Actions tab in GitHub repository
3. Verify the workflow runs on push/PR
4. All tests should pass (21/21)

## Security Features

- ✅ Secrets never exposed in logs (written to .env file only)
- ✅ `npm audit --audit-level=high` fails build on high/critical vulnerabilities
- ✅ `continue-on-error: false` ensures failures block merge
- ✅ Node 20.x LTS for stability and security

## Fitness Function: Dependency Security

The `npm audit` step serves as a fitness function per OWASP A06 (Vulnerable and Outdated Components):

- Blocks merges containing dependencies with high/critical CVEs
- Run `npm audit fix` locally to remediate before pushing
- Manual review required for breaking changes (`npm audit fix --force`)

## Local Testing

Before pushing, verify locally:

```bash
# Create .env file
cp .env.example .env
# Edit .env with your values

# Install dependencies
npm install

# Run tests
npm test

# Security audit
npm audit --audit-level=high
```

All tests must pass before merging.
