# Troubleshooting

## `429 rate limit (retry-after)`

The local model endpoint or its proxy is throttling requests.

```text
429 = Too Many Requests
retry-after = seconds to wait before retrying
```

Do not keep clicking the test button. Wait for the `retry-after` window, reduce
concurrency, or use a dedicated key/IP.

InterestSeed now shows:

```text
AI 服务限流（429），请 12 秒后重试。
```

## `Port 4173 is already in use`

Another local process owns the port. Start on another one:

```bash
node standalone/dist/cli.js serve --vault "<vault>" --port 4174
```

Ports must be integers between `0` and `65535`.

## `Missing API key`

Set the environment variable named in the config, or write the key locally:

```bash
export INTERESTSEED_AI_API_KEY="..."
# or
printf '%s' "..." > "<vault>/.interestseed/key"
```

The key is sent only to the configured local model endpoint.

## `Vault not found`

Pass the Markdown vault explicitly:

```bash
node standalone/dist/cli.js init --vault "/path/to/vault"
```

The standalone runtime does not create a vault for you.

## AI is disabled or consent is missing

Open Settings and enable:

```text
启用 AI 建议
我同意只发送节点 id、标题、标签
```

Without both, the provider stays disabled.

## `413 Request body too large`

The local API caps request bodies at 1 MiB. Capture shorter text or split the
operation.

## Local server warning

The server binds to `127.0.0.1` only:

```text
Local only: do not expose this port to a network.
```

There is no authentication layer. Do not reverse-proxy it publicly.

## Release digest mismatch

If the download page and release asset digest differ, stop and check:

```bash
npm run check:release
```

The release workflow now checks package/page digests before publish.
