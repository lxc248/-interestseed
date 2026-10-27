$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

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
    '.codex/roles/product.md',
    '.codex/roles/architect.md',
    '.codex/roles/implementer.md',
    '.codex/roles/reliability.md',
    '.codex/roles/reviewer.md',
    '.codex/roles/docs.md',
    '.codex/roles/performance.md',
    '.codex/skills/context-recovery.md',
    '.codex/skills/bug-root-cause.md',
    '.codex/skills/feature-delivery.md',
    '.codex/skills/migration-review.md',
    '.codex/skills/persistence-recovery-testing.md',
    '.codex/skills/independent-review.md',
    '.codex/skills/release-check.md',
    '.codex/templates/batch-report.md',
    '.codex/templates/review-report.md',
    'scripts/quality-gate.ps1'
)

$failed = @()
foreach ($relative in $required) {
    $path = Join-Path $root $relative
    if (Test-Path -LiteralPath $path) {
        Write-Host "ok: $relative"
    } else {
        $failed += $relative
        Write-Host "missing: $relative"
    }
}

if ($failed.Count -gt 0) {
    throw "Team infrastructure incomplete: $($failed -join ', ')"
}

Write-Host 'team infrastructure check passed'
