# InterestSeed Community Plugin Submission Notes

This repository is prepared for an Obsidian community-plugin submission.

## Release checklist

- [x] `manifest.json` with stable `id`, `version`, `minAppVersion`, author and description
- [x] `versions.json`
- [x] MIT `LICENSE`
- [x] README with user install instructions and screenshot
- [x] Build output includes `main.js`, `manifest.json`, `styles.css`
- [x] Local Git repository, commit and `0.1.0` tag
- [x] GitHub Actions release workflow
- [ ] Public GitHub repository
- [ ] GitHub release `0.1.0` with assets
- [ ] PR to `obsidianmd/obsidian-releases`

## GitHub release assets

The tag `0.1.0` should publish:

```text
main.js
manifest.json
styles.css
```

The local package is:

```text
release/interestseed-0.1.0.zip
```

## Submission entry template

Replace `YOUR_GITHUB_USER` with the public repository owner:

```json
{
  "id": "interestseed",
  "name": "InterestSeed",
  "author": "InterestSeed",
  "description": "Turn scattered notes into a living interest graph: seeds, relations and next-step insights for Obsidian.",
  "repo": "YOUR_GITHUB_USER/interestseed"
}
```

The entry must be added to the community plugin registry through the official
Obsidian release process. Do not invent a repository URL or submit without the
public source repository and release assets.

## Remaining external steps

1. Create a public GitHub repository named `interestseed`;
2. Push `main` and tag `0.1.0`;
3. Let the release workflow publish the three assets, or upload them manually;
4. Fork `obsidianmd/obsidian-releases`;
5. Add the entry to `community-plugins.json`;
6. Open the submission PR and respond to review.

These steps require a GitHub account/token and cannot be completed from the local
workspace alone.
