/** Type declarations for the release tag checker used by the release workflows. */

export interface ReleaseVersions {
  plugin?: string;
  standalone?: string;
}

/** Returns human readable problems; an empty array means the tag is usable. */
export declare function validateTag(
  tag: string,
  kind: 'plugin' | 'standalone',
  versions?: ReleaseVersions,
): string[];

export declare function readVersions(root: string): Required<ReleaseVersions>;
