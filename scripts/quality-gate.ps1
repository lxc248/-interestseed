param(
    [ValidateSet('docs', 'code', 'migration', 'release')]
    [string]$Scope = 'code'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Step {
    param([string]$Name, [scriptblock]$Action)
    Write-Host "== $Name =="
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

function Assert-File {
    param([string]$RelativePath)
    if (-not (Test-Path -LiteralPath (Join-Path $root $RelativePath))) {
        throw "Missing required file: $RelativePath"
    }
    Write-Host "ok: $RelativePath"
}

# Team infrastructure must exist for every scope.
$required = @(
    'AGENTS.md',
    '.codex/README.md',
    '.codex/PLAYBOOK.md',
    '.codex/QUALITY_GATES.md',
    '.codex/state/PROJECT_STATE.md',
    '.codex/state/DECISIONS.md',
    '.codex/state/EXPERIENCE.md',
    '.codex/state/REPORTS_INDEX.md',
    '.codex/roles/lead.md',
    '.codex/roles/reviewer.md',
    '.codex/templates/batch-report.md',
    'scripts/quality-gate.ps1'
)
foreach ($file in $required) { Assert-File $file }

if ($Scope -eq 'docs') {
    Write-Host '== Docs scope =='
    Write-Host 'No TypeScript/tests/build run: documentation-only scope.'
    Write-Host 'Check links and claims manually; never mark unrun checks as passed.'
    exit 0
}

if ($Scope -eq 'migration') {
    Invoke-Step 'typecheck' { npm run typecheck }
    Invoke-Step 'migration tests' {
        npx vitest run `
            tests/DiscoveryIdentity.test.ts `
            tests/DiscoveryEngine.test.ts `
            tests/DiscoveryRepository.test.ts `
            tests/DiscoveryApplication.test.ts
    }
    Invoke-Step 'lint' { npm run lint }
    Invoke-Step 'build' { npm run build }
    Write-Host 'Migration scope still requires an independent reviewer and an isolated Vault plan.'
    exit 0
}

Invoke-Step 'typecheck' { npm run typecheck }
Invoke-Step 'tests' { npm test }
Invoke-Step 'lint' { npm run lint }

if ($Scope -eq 'release') {
    Invoke-Step 'build' { npm run build }
}

exit 0
