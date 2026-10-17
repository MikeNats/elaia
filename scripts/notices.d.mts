export interface BundledPackage {
  name: string;
  version: string;
  license: string;
  licenseText: string;
}

export interface Metafile {
  inputs: Record<string, unknown>;
}

export function packageDir(input: string): string | null;
export function bundledPackages(metafiles: Metafile[], root: string): BundledPackage[];
export function noticesText(packages: BundledPackage[]): string;
