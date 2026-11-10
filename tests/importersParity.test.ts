import { describe, expect, it } from 'vitest';

import { parseImport } from '../src/services/importers';

/**
 * The plugin bundle cannot import `mcp/importers.mjs` at runtime, so the parser
 * exists twice: TypeScript for the plugin, plain JS for the MCP server. This
 * suite feeds identical fixtures to both and fails the moment they disagree.
 */
const fixtures: Array<{ name: string; text: string }> = [
  {
    name: 'bookmark html',
    text: '<DL><DT><A HREF="https://b23.tv/abc">三秒抓人的开场</A><DT><A HREF="https://a.example/?x=1&amp;y=2">实体 &amp;lt; 测试</A></DL>',
  },
  {
    name: 'bilibili json',
    text: JSON.stringify({ data: { medias: [{ title: '手冲', bvid: 'BV1aa411c7mD' }, { title: '构图', link: 'https://b23.tv/x' }] } }),
  },
  { name: 'csv', text: 'title,url\n陶艺,https://x.example/1\n剪辑,https://x.example/2\n空,,x' },
  { name: 'urls', text: 'https://x.example/1 会议纪要\nhttps://x.example/2\nhttps://x.example/1 重复' },
  { name: 'empty', text: '   ' },
  { name: 'unknown', text: '一段没有链接的话' },
  { name: 'broken json', text: '{ not json' },
  { name: 'nested markup', text: '<DL><DT><A HREF="https://x.example/9"><b>粗体</b> <i>斜体</i></A></DL>' },
];

describe('importer parity between the plugin and the MCP server', () => {
  it('produces identical results for every fixture', async () => {
    const mcp = (await import('../mcp/importers.mjs')) as {
      parseImport: (text: string, options?: { maxItems?: number }) => {
        format: string;
        items: Array<{ title: string; url: string | null }>;
        duplicates: number;
        truncated: boolean;
      };
      detectFormat: (text: string) => string;
    };

    for (const fixture of fixtures) {
      const pluginResult = parseImport(fixture.text);
      const serverResult = mcp.parseImport(fixture.text);
      expect(pluginResult, fixture.name).toEqual(serverResult);
      expect(pluginResult.format, fixture.name).toBe(mcp.detectFormat(fixture.text));
    }
  });

  it('agrees on the item cap', async () => {
    const mcp = (await import('../mcp/importers.mjs')) as {
      parseImport: (text: string, options?: { maxItems?: number }) => { items: unknown[]; truncated: boolean };
    };
    const text = Array.from({ length: 12 }, (_v, index) => `https://e.example/${index}`).join('\n');
    expect(parseImport(text, { maxItems: 4 })).toEqual(mcp.parseImport(text, { maxItems: 4 }));
  });
});
