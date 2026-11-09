import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleFromJSON } from '@sigstore/bundle';
import { toSignedEntity, toTrustMaterial, Verifier } from '@sigstore/verify';
import { getTrustedRoot } from '@sigstore/tuf';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const version = JSON.parse(await readFile(resolve(root, 'standalone/package.json'), 'utf8')).version;
const tag = `standalone-v${version}`;
const notes = resolve(root, `RELEASE_NOTES_STANDALONE_${version}.md`);
const downloadPage = await readFile(resolve(root, 'site/download/index.html'), 'utf8');
const releaseIndex = await readFile(resolve(root, 'docs/releases/README.md'), 'utf8');

function digestFrom(text, file) {
  const match = text.match(/[a-f0-9]{64}/);
  if (!match) throw new Error(`${file}: no SHA-256 digest found`);
  return match[0];
}

const pageDigest = digestFrom(downloadPage, 'site/download/index.html');
const indexDigest = digestFrom(releaseIndex, 'docs/releases/README.md');
const errors = [];
let signatureVerified = false;

if (!existsSync(notes)) errors.push(`missing ${notes}`);
if (pageDigest !== indexDigest) {
  errors.push(`download page digest ${pageDigest} != release index ${indexDigest}`);
}

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'InterestSeed release check',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};
const releaseResponse = await fetch(
  `https://api.github.com/repos/lxc248/-interestseed/releases/tags/${tag}`,
  { headers },
);
if (!releaseResponse.ok) {
  errors.push(`GitHub release ${tag}: HTTP ${releaseResponse.status}`);
} else {
  const release = await releaseResponse.json();
  const zip = release.assets.find((asset) => asset.name === `interestseed-standalone-v${version}.zip`);
  const checksum = release.assets.find(
    (asset) => asset.name === `interestseed-standalone-v${version}.sha256`,
  );
  if (!zip) errors.push(`missing release asset interestseed-standalone-v${version}.zip`);
  if (!checksum) errors.push(`missing release asset interestseed-standalone-v${version}.sha256`);
  if (zip) {
    const digest = String(zip.digest ?? '').replace(/^sha256:/, '');
    if (!zip.size) errors.push('release zip is empty');
    if (digest !== pageDigest) {
      errors.push(`release zip digest ${digest || '(missing)'} != page digest ${pageDigest}`);
    }
  }
  if (checksum && !checksum.size) errors.push('release checksum is empty');
  if (!process.env.GITHUB_TOKEN) {
    errors.push('GITHUB_TOKEN is required to verify the attestation');
  } else if (zip?.digest) {
    const attestationResponse = await fetch(
      `https://api.github.com/repos/lxc248/-interestseed/attestations/${zip.digest}`,
      { headers },
    );
    if (!attestationResponse.ok) {
      errors.push(`attestation lookup: HTTP ${attestationResponse.status}`);
    } else {
      const attestations = await attestationResponse.json();
      const first = attestations.attestations?.[0];
      if (!first) {
        errors.push('no build provenance attestation found');
      } else {
        try {
          const statement = JSON.parse(
            Buffer.from(first.bundle.dsseEnvelope.payload, 'base64').toString('utf8'),
          );
          const zipDigest = String(zip.digest).replace(/^sha256:/, '');
          const zipSubject = statement.subject?.find(
            (subject) => subject.name === zip.name && subject.digest?.sha256 === zipDigest,
          );
          if (!zipSubject) {
            errors.push('attestation subject does not match the release zip');
          }
          if (checksum?.digest) {
            const checksumDigest = String(checksum.digest).replace(/^sha256:/, '');
            const checksumSubject = statement.subject?.find(
              (subject) =>
                subject.name === checksum.name && subject.digest?.sha256 === checksumDigest,
            );
            if (!checksumSubject) {
              errors.push('attestation subject does not match the checksum asset');
            }
          }
          const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow;
          if (workflow?.ref !== `refs/tags/${tag}`) {
            errors.push(`attestation workflow ref ${workflow?.ref ?? '(missing)'} != refs/tags/${tag}`);
          }
          if (!String(workflow?.path ?? '').endsWith('release-standalone.yml')) {
            errors.push('attestation workflow is not release-standalone.yml');
          }
          const bundle = bundleFromJSON(first.bundle);
          const trustedRoot = await getTrustedRoot();
          const verifier = new Verifier(toTrustMaterial(trustedRoot));
          verifier.verify(toSignedEntity(bundle), {
            subjectAlternativeName: `https://github.com/lxc248/-interestseed/.github/workflows/release-standalone.yml@refs/tags/${tag}`,
          });
          signatureVerified = true;
        } catch {
          errors.push('attestation signature verification failed');
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`Release check failed for ${tag}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Release check passed: ${tag}, asset digest ${pageDigest}` +
      `${signatureVerified ? ', attestation signature verified.' : '.'}`,
  );
}
